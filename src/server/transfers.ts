import type Database from "better-sqlite3";
import { DomainError } from "@/domain/errors";
import { assertAccountAccess } from "@/domain/access";
import { canBusiness, canPlatform, type BusinessRole } from "@/domain/rbac";
import type { SessionUser } from "@/domain/identity";
import {
  accountBalance,
  createHold,
  getHold,
  postJournal,
  recordAudit,
  resolveHold,
  reverseJournal,
  writeTransaction,
} from "@/domain/ledger";
import { bpsFee } from "@/domain/money";
import { calculateSandboxQuote, sandboxRate } from "@/domain/fx";
import { newId, reference } from "@/lib/utils";

export interface CreateQuoteResult {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  feeMinor: number;
  targetAmountMinor: number;
  convertibleMinor: number;
  effectiveRate: string;
  expiresAt: string;
  asOf: string;
  sourceAmountMinor: number;
}

export function createQuote(
  db: Database.Database,
  user: SessionUser,
  accountId: string,
  targetCurrency: string,
  amountMinor: number,
): CreateQuoteResult {
  const account = assertAccountAccess(db, user, accountId, "account:transfer");
  if (account.status !== "active") throw new DomainError("ACCOUNT_FROZEN", "Account is not active");
  if (account.currency === targetCurrency) {
    throw new DomainError("VALIDATION_ERROR", "Choose a different target currency");
  }
  const quote = calculateSandboxQuote(amountMinor, account.currency, targetCurrency);
  const id = newId("fxq");
  db.prepare(
    `INSERT INTO fx_quotes
      (id, user_id, from_currency, to_currency, rate, source_amount_minor, target_amount_minor,
       fee_minor, fee_currency, expires_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run(
    id,
    user.id,
    account.currency,
    targetCurrency,
    quote.rate,
    amountMinor,
    quote.targetMinor,
    quote.feeMinor,
    account.currency,
    quote.expiresAt,
    new Date().toISOString(),
  );
  return {
    id,
    fromCurrency: account.currency,
    toCurrency: targetCurrency,
    rate: quote.rate,
    feeMinor: quote.feeMinor,
    targetAmountMinor: quote.targetMinor,
    convertibleMinor: quote.convertibleMinor,
    effectiveRate: quote.effectiveRate,
    expiresAt: quote.expiresAt,
    asOf: quote.asOf,
    sourceAmountMinor: amountMinor,
  };
}

export interface CreateTransferInput {
  user: SessionUser;
  sourceAccountId: string;
  direction: "internal" | "external" | "fx";
  amountMinor: number;
  destinationAccountId?: string;
  beneficiaryId?: string;
  targetCurrency?: string;
  quoteId?: string;
  note?: string;
  idempotencyKey: string;
  requestHash: string;
  pinVerified: boolean;
}

export interface TransferResult {
  transferId: string;
  reference: string;
  status: string;
  feeMinor: number;
  feeCurrency: string;
  targetAmountMinor: number;
  targetCurrency: string;
  journalId: string | null;
  providerRef: string | null;
  idempotentReplay: boolean;
}

export function externalFeeMinor(amountMinor: number, _currency: string): number {
  return Math.max(100, bpsFee(amountMinor, 25));
}

function addNotification(
  db: Database.Database,
  userId: string,
  title: string,
  body: string,
  kind: string,
  href: string,
): void {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, kind, href, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(newId("ntf"), userId, title, body, kind, href, new Date().toISOString());
}

function addWebhook(db: Database.Database, type: string, payload: Record<string, unknown>): void {
  db.prepare(
    `INSERT INTO webhook_events (id, type, payload, status, attempts, last_attempt_at, created_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?)`,
  ).run(newId("wh"), type, JSON.stringify(payload), new Date().toISOString());
}

function evaluateRisk(
  db: Database.Database,
  userId: string,
  amountMinor: number,
  currency: string,
  beneficiaryId: string | null,
  transferId: string,
): void {
  const flags: Array<{ severity: string; title: string; detail: string; type: string }> = [];
  if (amountMinor >= 500_000) {
    flags.push({
      severity: "medium",
      type: "large_amount",
      title: "Large outgoing transfer",
      detail: `A ${currency} ${(amountMinor / 100).toFixed(2)} transfer exceeded the $5,000 review threshold.`,
    });
  }
  if (beneficiaryId) {
    const beneficiary = db
      .prepare("SELECT created_at FROM beneficiaries WHERE id = ?")
      .get(beneficiaryId) as { created_at: string } | undefined;
    if (beneficiary && Date.now() - new Date(beneficiary.created_at).getTime() < 24 * 3_600_000) {
      flags.push({
        severity: "high",
        type: "beneficiary_change",
        title: "Payout to a newly added beneficiary",
        detail: "The beneficiary was added less than 24 hours before this transfer.",
      });
    }
  }
  const velocity = db
    .prepare("SELECT COUNT(*) AS count FROM transfers WHERE user_id = ? AND created_at >= ?")
    .get(userId, new Date(Date.now() - 10 * 60_000).toISOString()) as { count: number };
  if (velocity.count >= 3) {
    flags.push({
      severity: "medium",
      type: "velocity",
      title: "Transfer velocity above baseline",
      detail: `${velocity.count} transfers initiated within ten minutes.`,
    });
  }
  for (const flag of flags) {
    db.prepare(
      `INSERT INTO risk_events
        (id, user_id, org_id, type, severity, status, title, detail, transfer_id, assigned_to, created_at, resolved_at)
       VALUES (?, ?, NULL, ?, ?, 'open', ?, ?, ?, NULL, ?, NULL)`,
    ).run(
      newId("rsk"),
      userId,
      flag.type,
      flag.severity,
      flag.title,
      flag.detail,
      transferId,
      new Date().toISOString(),
    );
  }
}

function insertTransferRow(
  db: Database.Database,
  input: {
    id: string;
    reference: string;
    userId: string;
    sourceAccountId: string;
    beneficiaryId?: string | null;
    destinationAccountId?: string | null;
    direction: string;
    status: string;
    sourceAmountMinor: number;
    sourceCurrency: string;
    targetAmountMinor?: number | null;
    targetCurrency?: string | null;
    feeMinor: number;
    feeCurrency: string;
    rate?: string | null;
    quoteId?: string | null;
    holdId?: string | null;
    journalId?: string | null;
    providerRef?: string | null;
    note?: string | null;
    idempotencyKey: string;
    createdAt: string;
    settledAt?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO transfers
      (id, reference, user_id, source_account_id, beneficiary_id, destination_account_id, direction, status,
       source_amount_minor, source_currency, target_amount_minor, target_currency, fee_minor, fee_currency,
       rate, quote_id, hold_id, journal_id, provider_ref, failure_reason, note, idempotency_key, created_at, updated_at, settled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.reference,
    input.userId,
    input.sourceAccountId,
    input.beneficiaryId ?? null,
    input.destinationAccountId ?? null,
    input.direction,
    input.status,
    input.sourceAmountMinor,
    input.sourceCurrency,
    input.targetAmountMinor ?? null,
    input.targetCurrency ?? null,
    input.feeMinor,
    input.feeCurrency,
    input.rate ?? null,
    input.quoteId ?? null,
    input.holdId ?? null,
    input.journalId ?? null,
    input.providerRef ?? null,
    input.note ?? null,
    input.idempotencyKey,
    input.createdAt,
    input.createdAt,
    input.settledAt ?? null,
  );
}

function insertTransaction(
  db: Database.Database,
  input: {
    accountId: string;
    journalId?: string | null;
    transferId: string;
    direction: "credit" | "debit";
    amountMinor: number;
    currency: string;
    status: string;
    category: string;
    description: string;
    counterparty: string;
    occurredAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO transactions
      (id, account_id, journal_id, transfer_id, card_id, direction, amount_minor, currency, status,
       category, merchant, description, counterparty, occurred_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    newId("txn"),
    input.accountId,
    input.journalId ?? null,
    input.transferId,
    input.direction,
    input.amountMinor,
    input.currency,
    input.status,
    input.category,
    input.description,
    input.counterparty,
    input.occurredAt,
    input.occurredAt,
  );
}

function checkIdempotency(
  db: Database.Database,
  userId: string,
  key: string,
  requestHash: string,
): TransferResult | null {
  const existing = db
    .prepare(
      "SELECT request_hash, response_json FROM idempotency_keys WHERE user_id = ? AND scope = 'transfer' AND key = ?",
    )
    .get(userId, key) as { request_hash: string; response_json: string } | undefined;
  if (!existing) return null;
  if (existing.request_hash !== requestHash) {
    throw new DomainError(
      "IDEMPOTENCY_MISMATCH",
      "This idempotency key was already used with different transfer details",
    );
  }
  return { ...(JSON.parse(existing.response_json) as TransferResult), idempotentReplay: true };
}

export function createTransfer(db: Database.Database, input: CreateTransferInput): TransferResult {
  if (!input.pinVerified) {
    throw new DomainError("FORBIDDEN", "Sensitive action authorization is required");
  }
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw new DomainError("VALIDATION_ERROR", "A valid idempotency key is required");
  }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Transfer amount must be positive");
  }

  return writeTransaction(db, () => {
    const replay = checkIdempotency(db, input.user.id, input.idempotencyKey, input.requestHash);
    if (replay) return replay;

    const source = assertAccountAccess(db, input.user, input.sourceAccountId, "account:transfer");
    if (source.status !== "active") {
      throw new DomainError("ACCOUNT_FROZEN", "Source account is not active");
    }
    const balance = accountBalance(db, input.sourceAccountId);
    const transferId = newId("trf");
    const ref = reference("TRF");
    const createdAt = new Date().toISOString();
    const note = input.note?.trim() || null;

    // Claim the idempotency key inside the same transaction that posts money.
    db.prepare(
      `INSERT INTO idempotency_keys (id, user_id, scope, key, request_hash, response_json, created_at)
       VALUES (?, ?, 'transfer', ?, ?, '{}', ?)`,
    ).run(newId("idm"), input.user.id, input.idempotencyKey, input.requestHash, createdAt);

    let result: TransferResult;

    if (input.direction === "internal") {
      let destinationId = input.destinationAccountId;
      let beneficiaryName = "Atlas account";
      if (input.beneficiaryId) {
        const beneficiary = db
          .prepare(
            `SELECT id, name, type, linked_account_id, owner_type, owner_id, status
             FROM beneficiaries WHERE id = ?`,
          )
          .get(input.beneficiaryId) as
          | {
              id: string;
              name: string;
              type: string;
              linked_account_id: string | null;
              owner_type: string;
              owner_id: string;
              status: string;
            }
          | undefined;
        if (!beneficiary || beneficiary.owner_id !== input.user.id || beneficiary.status !== "active") {
          throw new DomainError("NOT_FOUND", "Beneficiary not found");
        }
        if (beneficiary.type !== "internal" || !beneficiary.linked_account_id) {
          throw new DomainError("VALIDATION_ERROR", "This beneficiary is not an Atlas peer");
        }
        destinationId = beneficiary.linked_account_id;
        beneficiaryName = beneficiary.name;
      }
      if (!destinationId) throw new DomainError("VALIDATION_ERROR", "Choose a destination account");
      const destination = db
        .prepare("SELECT id, owner_type, owner_id, currency, status, name FROM accounts WHERE id = ?")
        .get(destinationId) as
        | { id: string; owner_type: string; owner_id: string; currency: string; status: string; name: string }
        | undefined;
      if (!destination) throw new DomainError("NOT_FOUND", "Destination account not found");
      if (destination.id === source.id) {
        throw new DomainError("VALIDATION_ERROR", "Source and destination accounts must differ");
      }
      if (destination.status !== "active") throw new DomainError("ACCOUNT_FROZEN", "Destination account is not active");
      if (destination.currency !== source.currency) {
        throw new DomainError("VALIDATION_ERROR", "Use the FX flow for cross-currency transfers");
      }
      const isOwn = destination.owner_type === "user" && destination.owner_id === input.user.id;
      const isPeer = Boolean(input.beneficiaryId);
      if (!isOwn && !isPeer) {
        throw new DomainError("FORBIDDEN", "Destination account is not accessible");
      }
      if (balance.availableMinor < input.amountMinor) {
        throw new DomainError("INSUFFICIENT_FUNDS", "Available balance is insufficient");
      }
      const journal = postJournal(db, {
        description: `Transfer to ${beneficiaryName}`,
        kind: "transfer",
        transferId,
        actorId: input.user.id,
        postings: [
          { ledgerAccountId: `led_${source.id}`, amountMinor: input.amountMinor },
          { ledgerAccountId: `led_${destination.id}`, amountMinor: -input.amountMinor },
        ],
      });
      insertTransferRow(db, {
        id: transferId,
        reference: ref,
        userId: input.user.id,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        direction: "internal",
        status: "posted",
        sourceAmountMinor: input.amountMinor,
        sourceCurrency: source.currency,
        targetAmountMinor: input.amountMinor,
        targetCurrency: destination.currency,
        feeMinor: 0,
        feeCurrency: source.currency,
        rate: "1",
        journalId: journal.journalId,
        note,
        idempotencyKey: input.idempotencyKey,
        createdAt,
        settledAt: createdAt,
      });
      insertTransaction(db, {
        accountId: source.id,
        journalId: journal.journalId,
        transferId,
        direction: "debit",
        amountMinor: input.amountMinor,
        currency: source.currency,
        status: "posted",
        category: "Transfers",
        description: `Transfer to ${beneficiaryName}`,
        counterparty: beneficiaryName,
        occurredAt: createdAt,
      });
      insertTransaction(db, {
        accountId: destination.id,
        journalId: journal.journalId,
        transferId,
        direction: "credit",
        amountMinor: input.amountMinor,
        currency: destination.currency,
        status: "posted",
        category: "Transfers",
        description: `Transfer from ${source.name}`,
        counterparty: source.name,
        occurredAt: createdAt,
      });
      result = {
        transferId,
        reference: ref,
        status: "posted",
        feeMinor: 0,
        feeCurrency: source.currency,
        targetAmountMinor: input.amountMinor,
        targetCurrency: destination.currency,
        journalId: journal.journalId,
        providerRef: null,
        idempotentReplay: false,
      };
    } else if (input.direction === "external") {
      if (!input.beneficiaryId) throw new DomainError("VALIDATION_ERROR", "Choose a beneficiary");
      const beneficiary = db
        .prepare(
          `SELECT id, name, type, currency, owner_type, owner_id, status
           FROM beneficiaries WHERE id = ?`,
        )
        .get(input.beneficiaryId) as
        | { id: string; name: string; type: string; currency: string; owner_type: string; owner_id: string; status: string }
        | undefined;
      if (!beneficiary || beneficiary.owner_id !== input.user.id || beneficiary.status !== "active") {
        throw new DomainError("NOT_FOUND", "Beneficiary not found");
      }
      if (beneficiary.type === "internal") {
        throw new DomainError("VALIDATION_ERROR", "Use an internal transfer for Atlas peers");
      }
      if (beneficiary.currency !== source.currency) {
        throw new DomainError("VALIDATION_ERROR", "Beneficiary currency must match the source wallet");
      }
      const fee = externalFeeMinor(input.amountMinor, source.currency);
      if (balance.availableMinor < input.amountMinor + fee) {
        throw new DomainError("INSUFFICIENT_FUNDS", "Available balance does not cover the amount and fee");
      }
      insertTransferRow(db, {
        id: transferId,
        reference: ref,
        userId: input.user.id,
        sourceAccountId: source.id,
        beneficiaryId: beneficiary.id,
        direction: "external",
        status: "processing",
        sourceAmountMinor: input.amountMinor,
        sourceCurrency: source.currency,
        targetAmountMinor: input.amountMinor,
        targetCurrency: beneficiary.currency,
        feeMinor: fee,
        feeCurrency: source.currency,
        rate: "1",
        providerRef: `prov_${newId("p").slice(2, 12)}`,
        note,
        idempotencyKey: input.idempotencyKey,
        createdAt,
      });
      const holdId = createHold(db, {
        accountId: source.id,
        amountMinor: input.amountMinor + fee,
        currency: source.currency,
        transferId,
        reason: "Outbound payment reservation",
      });
      db.prepare("UPDATE transfers SET hold_id = ? WHERE id = ?").run(holdId, transferId);
      const providerRef = (
        db.prepare("SELECT provider_ref FROM transfers WHERE id = ?").get(transferId) as {
          provider_ref: string;
        }
      ).provider_ref;
      insertTransaction(db, {
        accountId: source.id,
        transferId,
        direction: "debit",
        amountMinor: input.amountMinor,
        currency: source.currency,
        status: "processing",
        category: "Transfers",
        description: `Transfer to ${beneficiary.name} — processing`,
        counterparty: beneficiary.name,
        occurredAt: createdAt,
      });
      db.prepare(
        `INSERT INTO provider_events (id, transfer_id, provider_ref, event_type, amount_minor, currency, status, created_at)
         VALUES (?, ?, ?, 'payout.processing', ?, ?, 'processing', ?)`,
      ).run(newId("pe"), transferId, providerRef, input.amountMinor, source.currency, createdAt);
      result = {
        transferId,
        reference: ref,
        status: "processing",
        feeMinor: fee,
        feeCurrency: source.currency,
        targetAmountMinor: input.amountMinor,
        targetCurrency: beneficiary.currency,
        journalId: null,
        providerRef,
        idempotentReplay: false,
      };
    } else {
      if (!input.quoteId) throw new DomainError("VALIDATION_ERROR", "An FX quote is required");
      const quote = db
        .prepare("SELECT * FROM fx_quotes WHERE id = ? AND user_id = ?")
        .get(input.quoteId, input.user.id) as
        | {
            id: string;
            from_currency: string;
            to_currency: string;
            rate: string;
            source_amount_minor: number;
            target_amount_minor: number;
            fee_minor: number;
            expires_at: string;
            status: string;
          }
        | undefined;
      if (!quote) throw new DomainError("NOT_FOUND", "FX quote not found");
      if (quote.status !== "active") throw new DomainError("QUOTE_EXPIRED", "This FX quote is no longer active");
      if (new Date(quote.expires_at).getTime() < Date.now()) {
        db.prepare("UPDATE fx_quotes SET status = 'expired' WHERE id = ?").run(quote.id);
        throw new DomainError("QUOTE_EXPIRED", "This FX quote has expired. Request a new quote.");
      }
      if (quote.from_currency !== source.currency || quote.source_amount_minor !== input.amountMinor) {
        throw new DomainError("VALIDATION_ERROR", "Transfer amount does not match the FX quote");
      }
      if (balance.availableMinor < input.amountMinor) {
        throw new DomainError("INSUFFICIENT_FUNDS", "Available balance is insufficient");
      }
      if (input.beneficiaryId) {
        throw new DomainError(
          "VALIDATION_ERROR",
          "External FX payouts are not enabled in this sandbox. Convert into an Atlas wallet, then send from that wallet.",
        );
      }
      const destinationId = input.destinationAccountId;
      const beneficiaryName = `FX to ${quote.to_currency}`;
      if (destinationId) {
        const destination = db
          .prepare("SELECT id, owner_type, owner_id, currency, status FROM accounts WHERE id = ?")
          .get(destinationId) as
          | { id: string; owner_type: string; owner_id: string; currency: string; status: string }
          | undefined;
        if (
          !destination ||
          destination.owner_type !== "user" ||
          destination.owner_id !== input.user.id ||
          destination.currency !== quote.to_currency ||
          destination.status !== "active"
        ) {
          throw new DomainError("FORBIDDEN", "Destination wallet is not available for this quote");
        }
      }
      if (!destinationId) {
        throw new DomainError("VALIDATION_ERROR", "Choose a destination wallet");
      }
      const convertible = input.amountMinor - quote.fee_minor;
      const sourceJournal = postJournal(db, {
        description: `FX conversion ${quote.from_currency} → ${quote.to_currency}`,
        kind: "fx",
        transferId,
        actorId: input.user.id,
        postings: [
          { ledgerAccountId: `led_${source.id}`, amountMinor: convertible },
          { ledgerAccountId: `led_fx_${quote.from_currency}`, amountMinor: -convertible },
        ],
      });
      const targetLedgerId = `led_${destinationId}`;
      postJournal(db, {
        description: `FX conversion ${quote.from_currency} → ${quote.to_currency} (target leg)`,
        kind: "fx",
        transferId,
        actorId: input.user.id,
        postings: [
          { ledgerAccountId: `led_fx_${quote.to_currency}`, amountMinor: quote.target_amount_minor },
          { ledgerAccountId: targetLedgerId, amountMinor: -quote.target_amount_minor },
        ],
      });
      if (quote.fee_minor > 0) {
        postJournal(db, {
          description: `FX fee ${quote.from_currency} → ${quote.to_currency}`,
          kind: "fee",
          transferId,
          actorId: input.user.id,
          postings: [
            { ledgerAccountId: `led_${source.id}`, amountMinor: quote.fee_minor },
            { ledgerAccountId: `led_fee_${quote.from_currency}`, amountMinor: -quote.fee_minor },
          ],
        });
      }
      db.prepare("UPDATE fx_quotes SET status = 'used' WHERE id = ?").run(quote.id);
      insertTransferRow(db, {
        id: transferId,
        reference: ref,
        userId: input.user.id,
        sourceAccountId: source.id,
        beneficiaryId: input.beneficiaryId ?? null,
        destinationAccountId: destinationId ?? null,
        direction: "fx",
        status: "posted",
        sourceAmountMinor: input.amountMinor,
        sourceCurrency: quote.from_currency,
        targetAmountMinor: quote.target_amount_minor,
        targetCurrency: quote.to_currency,
        feeMinor: quote.fee_minor,
        feeCurrency: quote.from_currency,
        rate: quote.rate,
        quoteId: quote.id,
        journalId: sourceJournal.journalId,
        note,
        idempotencyKey: input.idempotencyKey,
        createdAt,
        settledAt: createdAt,
      });
      insertTransaction(db, {
        accountId: source.id,
        journalId: sourceJournal.journalId,
        transferId,
        direction: "debit",
        amountMinor: input.amountMinor,
        currency: quote.from_currency,
        status: "posted",
        category: "Transfers",
        description: `FX transfer to ${beneficiaryName}`,
        counterparty: beneficiaryName,
        occurredAt: createdAt,
      });
      if (destinationId) {
        insertTransaction(db, {
          accountId: destinationId,
          journalId: sourceJournal.journalId,
          transferId,
          direction: "credit",
          amountMinor: quote.target_amount_minor,
          currency: quote.to_currency,
          status: "posted",
          category: "Transfers",
          description: `FX transfer from ${source.name}`,
          counterparty: source.name,
          occurredAt: createdAt,
        });
      }
      result = {
        transferId,
        reference: ref,
        status: "posted",
        feeMinor: quote.fee_minor,
        feeCurrency: quote.from_currency,
        targetAmountMinor: quote.target_amount_minor,
        targetCurrency: quote.to_currency,
        journalId: sourceJournal.journalId,
        providerRef: null,
        idempotentReplay: false,
      };
    }

    db.prepare("UPDATE idempotency_keys SET response_json = ? WHERE user_id = ? AND scope = 'transfer' AND key = ?").run(
      JSON.stringify(result),
      input.user.id,
      input.idempotencyKey,
    );

    recordAudit(db, {
      actorId: input.user.id,
      actorRole: input.user.platformRole,
      action: "transfer.created",
      resourceType: "transfer",
      resourceId: transferId,
      metadata: {
        direction: input.direction,
        amountMinor: input.amountMinor,
        sourceCurrency: source.currency,
        status: result.status,
        reference: ref,
      },
    });
    addNotification(
      db,
      input.user.id,
      result.status === "processing" ? "Transfer is processing" : "Transfer complete",
      result.status === "processing"
        ? `Your ${result.reference} transfer is with the payment network. Funds are held until settlement.`
        : `Your ${result.reference} transfer has posted.`,
      "transfer",
      `/app/transfers/${transferId}`,
    );
    addWebhook(db, "transfer.created", {
      id: transferId,
      reference: ref,
      status: result.status,
      amount_minor: input.amountMinor,
      currency: source.currency,
    });
    evaluateRisk(db, input.user.id, input.amountMinor, source.currency, input.beneficiaryId ?? null, transferId);

    return result;
  });
}

/**
 * Authorization for operating on an existing transfer. The initiator always
 * qualifies; an active organization member with transfer rights may act on an
 * organization transfer; platform operators need explicit ledger authority.
 * Platform staff are never granted implicit customer fund-movement rights, so
 * a platform role must hold `ops:ledger` and the action is always audited.
 */
function assertTransferOperator(
  db: Database.Database,
  actor: SessionUser,
  transfer: { user_id: string; source_account_id: string },
): void {
  if (transfer.user_id === actor.id) return;
  const source = db
    .prepare("SELECT owner_type, owner_id FROM accounts WHERE id = ?")
    .get(transfer.source_account_id) as { owner_type: string; owner_id: string } | undefined;
  if (source?.owner_type === "org") {
    const membership = db
      .prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'")
      .get(source.owner_id, actor.id) as { role: BusinessRole } | undefined;
    if (membership && canBusiness(membership.role, "account:transfer")) return;
  }
  if (canPlatform(actor.platformRole, "ops:ledger")) return;
  throw new DomainError("FORBIDDEN", "You are not authorized to operate on this transfer");
}

export function settleTransfer(
  db: Database.Database,
  transferId: string,
  actor: SessionUser,
): void {
  writeTransaction(db, () => {
    const transfer = db.prepare("SELECT * FROM transfers WHERE id = ?").get(transferId) as
      | {
          id: string;
          user_id: string;
          source_account_id: string;
          status: string;
          source_amount_minor: number;
          source_currency: string;
          fee_minor: number;
          hold_id: string | null;
          provider_ref: string | null;
          direction: string;
        }
      | undefined;
    if (!transfer) throw new DomainError("NOT_FOUND", "Transfer not found");
    assertTransferOperator(db, actor, transfer);
    if (transfer.status !== "processing") {
      throw new DomainError("CONFLICT", "Only processing transfers can be settled");
    }
    const hold = transfer.hold_id ? getHold(db, transfer.hold_id) : null;
    if (hold && hold.status !== "active") {
      throw new DomainError("HOLD_STATE", "Transfer hold is not active");
    }
    const now = new Date().toISOString();
    const journal = postJournal(db, {
      description: `Settlement of ${transfer.id}`,
      kind: "transfer",
      transferId: transfer.id,
      actorId: actor.id,
      postings: [
        {
          ledgerAccountId: `led_${transfer.source_account_id}`,
          amountMinor: transfer.source_amount_minor + transfer.fee_minor,
        },
        { ledgerAccountId: `led_settlement_${transfer.source_currency}`, amountMinor: -transfer.source_amount_minor },
        ...(transfer.fee_minor > 0
          ? [
              {
                ledgerAccountId: `led_fee_${transfer.source_currency}`,
                amountMinor: -transfer.fee_minor,
              },
            ]
          : []),
      ],
    });
    if (hold) resolveHold(db, hold.id, "captured");
    db.prepare(
      "UPDATE transfers SET status = 'posted', journal_id = ?, settled_at = ?, updated_at = ? WHERE id = ?",
    ).run(journal.journalId, now, now, transfer.id);
    db.prepare(
      "UPDATE transactions SET status = 'posted', journal_id = ? WHERE transfer_id = ? AND status = 'processing'",
    ).run(journal.journalId, transfer.id);
    if (transfer.provider_ref) {
      db.prepare(
        "UPDATE provider_events SET status = 'settled' WHERE transfer_id = ? AND status = 'processing'",
      ).run(transfer.id);
    }
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "transfer.settled",
      resourceType: "transfer",
      resourceId: transfer.id,
      metadata: { journalId: journal.journalId },
    });
    addNotification(
      db,
      transfer.user_id,
      "Transfer settled",
      "Your outbound transfer has settled and the receipt is available.",
      "transfer",
      `/app/transfers/${transfer.id}`,
    );
    addWebhook(db, "transfer.posted", {
      id: transfer.id,
      status: "posted",
      journal_id: journal.journalId,
    });
  });
}

export function failTransfer(
  db: Database.Database,
  transferId: string,
  actor: SessionUser,
  reason: string,
): void {
  writeTransaction(db, () => {
    const transfer = db.prepare("SELECT * FROM transfers WHERE id = ?").get(transferId) as
      | {
          id: string;
          user_id: string;
          source_account_id: string;
          status: string;
          hold_id: string | null;
        }
      | undefined;
    if (!transfer) throw new DomainError("NOT_FOUND", "Transfer not found");
    assertTransferOperator(db, actor, transfer);
    if (!["processing", "pending_authorization"].includes(transfer.status)) {
      throw new DomainError("CONFLICT", "This transfer cannot be failed in its current state");
    }
    if (transfer.hold_id) {
      const hold = getHold(db, transfer.hold_id);
      if (hold.status === "active") resolveHold(db, hold.id, "released");
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE transfers SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?",
    ).run(reason, now, transfer.id);
    db.prepare(
      "UPDATE transactions SET status = 'failed' WHERE transfer_id = ? AND status IN ('processing','pending')",
    ).run(transfer.id);
    db.prepare("UPDATE provider_events SET status = 'failed' WHERE transfer_id = ?").run(transfer.id);
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "transfer.failed",
      resourceType: "transfer",
      resourceId: transfer.id,
      metadata: { reason },
    });
    addNotification(
      db,
      transfer.user_id,
      "Transfer failed",
      "Your transfer could not be completed. Held funds have been released.",
      "transfer",
      `/app/transfers/${transfer.id}`,
    );
    addWebhook(db, "transfer.failed", { id: transfer.id, reason });
  });
}

export function reverseTransfer(
  db: Database.Database,
  transferId: string,
  actor: SessionUser,
  reason: string,
): void {
  writeTransaction(db, () => {
    const transfer = db.prepare("SELECT * FROM transfers WHERE id = ?").get(transferId) as
      | {
          id: string;
          user_id: string;
          status: string;
          journal_id: string | null;
          source_account_id: string;
          source_currency: string;
        }
      | undefined;
    if (!transfer) throw new DomainError("NOT_FOUND", "Transfer not found");
    assertTransferOperator(db, actor, transfer);
    if (transfer.status !== "posted" || !transfer.journal_id) {
      throw new DomainError("CONFLICT", "Only posted transfers can be reversed");
    }
    const reversal = reverseJournal(db, transfer.journal_id, {
      actorId: actor.id,
      description: `Reversal of transfer ${transfer.id}`,
    });
    const now = new Date().toISOString();
    db.prepare("UPDATE transfers SET status = 'reversed', updated_at = ? WHERE id = ?").run(now, transfer.id);
    db.prepare(
      "UPDATE transactions SET status = 'reversed' WHERE transfer_id = ? AND status = 'posted'",
    ).run(transfer.id);
    recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.platformRole,
      action: "transfer.reversed",
      resourceType: "transfer",
      resourceId: transfer.id,
      metadata: { reversalJournalId: reversal.journalId, reason },
    });
    addNotification(
      db,
      transfer.user_id,
      "Transfer reversed",
      "A compensating ledger entry has reversed the transfer.",
      "transfer",
      `/app/transfers/${transfer.id}`,
    );
    addWebhook(db, "transfer.reversed", { id: transfer.id, reversal_journal_id: reversal.journalId });
  });
}

export interface TransferDetail {
  transfer: {
    id: string;
    reference: string;
    status: string;
    direction: string;
    sourceAmountMinor: number;
    sourceCurrency: string;
    targetAmountMinor: number | null;
    targetCurrency: string | null;
    feeMinor: number;
    feeCurrency: string | null;
    rate: string | null;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    settledAt: string | null;
    failureReason: string | null;
    providerRef: string | null;
    userId: string;
  };
  sourceAccount: { id: string; name: string; currency: string; masked: string | null };
  destinationAccount: { id: string; name: string; currency: string; masked: string | null } | null;
  beneficiary: { id: string; name: string; type: string; currency: string; bankName: string | null; masked: string | null } | null;
  journal: {
    id: string;
    reference: string;
    description: string;
    createdAt: string;
    postings: Array<{
      ledgerCode: string;
      ledgerName: string;
      type: string;
      currency: string;
      amountMinor: number;
      side: "debit" | "credit";
      isCustomer: boolean;
    }>;
  } | null;
  feeJournal: {
    id: string;
    reference: string;
    postings: Array<{ ledgerName: string; currency: string; amountMinor: number; side: "debit" | "credit" }>;
  } | null;
  hold: { id: string; amountMinor: number; currency: string; status: string; createdAt: string } | null;
  providerEvents: Array<{ id: string; type: string; status: string; amountMinor: number; currency: string; createdAt: string; providerRef: string }>;
  transactions: Array<{ id: string; accountId: string; direction: string; amountMinor: number; currency: string; status: string; description: string; occurredAt: string }>;
  timeline: Array<{ key: string; label: string; detail: string; at: string | null; state: "complete" | "current" | "pending" }>;
}

export function getTransferDetail(
  db: Database.Database,
  transferId: string,
  user: SessionUser,
): TransferDetail | null {
  const row = db.prepare("SELECT * FROM transfers WHERE id = ?").get(transferId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const transferUserId = row.user_id as string;
  const sourceAccountId = row.source_account_id as string;
  const source = db
    .prepare("SELECT a.*, a.account_number_masked AS masked FROM accounts a WHERE a.id = ?")
    .get(sourceAccountId) as { id: string; name: string; currency: string; masked: string | null; owner_type: string; owner_id: string } | undefined;
  if (!source) return null;
  const isOwner = transferUserId === user.id;
  const isOrgMember =
    source.owner_type === "org" &&
    Boolean(
      db
        .prepare("SELECT 1 FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'active'")
        .get(source.owner_id, user.id),
    );
  if (!isOwner && !isOrgMember) return null;

  const destinationId = row.destination_account_id as string | null;
  const destination = destinationId
    ? (db
        .prepare("SELECT id, name, currency, account_number_masked AS masked FROM accounts WHERE id = ?")
        .get(destinationId) as { id: string; name: string; currency: string; masked: string | null } | undefined)
    : null;
  const beneficiaryId = row.beneficiary_id as string | null;
  const beneficiary = beneficiaryId
    ? (db
        .prepare("SELECT id, name, type, currency, bank_name AS bankName, account_masked AS masked FROM beneficiaries WHERE id = ?")
        .get(beneficiaryId) as { id: string; name: string; type: string; currency: string; bankName: string | null; masked: string | null } | undefined)
    : null;

  const journalId = row.journal_id as string | null;
  let journal: TransferDetail["journal"] = null;
  if (journalId) {
    const entry = db
      .prepare("SELECT id, reference, description, created_at FROM journal_entries WHERE id = ?")
      .get(journalId) as { id: string; reference: string; description: string; created_at: string } | undefined;
    if (entry) {
      const postings = db
        .prepare(
          `SELECT la.code, la.name, la.type, la.currency, p.amount_minor, la.account_id
           FROM postings p JOIN ledger_accounts la ON la.id = p.ledger_account_id
           WHERE p.journal_id = ? ORDER BY p.amount_minor DESC`,
        )
        .all(journalId) as Array<{
        code: string;
        name: string;
        type: string;
        currency: string;
        amount_minor: number;
        account_id: string | null;
      }>;
      journal = {
        id: entry.id,
        reference: entry.reference,
        description: entry.description,
        createdAt: entry.created_at,
        postings: postings.map((p) => ({
          ledgerCode: p.code,
          ledgerName: p.name,
          type: p.type,
          currency: p.currency,
          amountMinor: Math.abs(p.amount_minor),
          side: p.amount_minor > 0 ? "debit" : "credit",
          isCustomer: Boolean(p.account_id),
        })),
      };
    }
  }

  const feeEntry = db
    .prepare(
      "SELECT id, reference FROM journal_entries WHERE transfer_id = ? AND kind = 'fee' LIMIT 1",
    )
    .get(transferId) as { id: string; reference: string } | undefined;
  let feeJournal: TransferDetail["feeJournal"] = null;
  if (feeEntry) {
    const postings = db
      .prepare(
        `SELECT la.name, la.currency, p.amount_minor FROM postings p
         JOIN ledger_accounts la ON la.id = p.ledger_account_id WHERE p.journal_id = ?`,
      )
      .all(feeEntry.id) as Array<{ name: string; currency: string; amount_minor: number }>;
    feeJournal = {
      id: feeEntry.id,
      reference: feeEntry.reference,
      postings: postings.map((p) => ({
        ledgerName: p.name,
        currency: p.currency,
        amountMinor: Math.abs(p.amount_minor),
        side: p.amount_minor > 0 ? "debit" : "credit",
      })),
    };
  }

  const holdId = row.hold_id as string | null;
  const hold = holdId
    ? (db
        .prepare("SELECT id, amount_minor, currency, status, created_at FROM holds WHERE id = ?")
        .get(holdId) as { id: string; amount_minor: number; currency: string; status: string; created_at: string } | undefined)
    : null;
  const providerEvents = db
    .prepare(
      "SELECT id, event_type, status, amount_minor, currency, created_at, provider_ref FROM provider_events WHERE transfer_id = ? ORDER BY created_at ASC",
    )
    .all(transferId) as Array<{
    id: string;
    event_type: string;
    status: string;
    amount_minor: number;
    currency: string;
    created_at: string;
    provider_ref: string;
  }>;
  const transactions = db
    .prepare(
      "SELECT id, account_id, direction, amount_minor, currency, status, description, occurred_at FROM transactions WHERE transfer_id = ? ORDER BY occurred_at ASC",
    )
    .all(transferId) as Array<{
    id: string;
    account_id: string;
    direction: string;
    amount_minor: number;
    currency: string;
    status: string;
    description: string;
    occurred_at: string;
  }>;

  const status = row.status as string;
  const settledAt = (row.settled_at as string | null) ?? null;
  const createdAt = row.created_at as string;
  const isInternal = (row.direction as string) === "internal";
  const timeline: TransferDetail["timeline"] = [
    { key: "initiated", label: "Initiated", detail: "Request validated and idempotency key claimed", at: createdAt, state: "complete" },
    {
      key: "authorized",
      label: "Authorized",
      detail: "Step-up PIN verified; server-side balance check passed",
      at: createdAt,
      state: "complete",
    },
    {
      key: "hold",
      label: "Funds held",
      detail: hold ? `${hold.currency} ${(hold.amount_minor / 100).toFixed(2)} reserved from available balance` : "Not required for immediate internal settlement",
      at: hold?.created_at ?? null,
      state: isInternal ? "complete" : hold?.status === "active" ? "current" : "complete",
    },
    {
      key: "ledger",
      label: "Ledger posted",
      detail: journal ? `Balanced journal ${journal.reference}` : "Awaiting settlement posting",
      at: journal?.createdAt ?? null,
      state: journal ? "complete" : "current",
    },
    {
      key: "provider",
      label: "Provider processing",
      detail: providerEvents[0] ? `Provider reference ${providerEvents[0].provider_ref}` : "Internal ledger transfer — no external provider",
      at: providerEvents[0]?.created_at ?? null,
      state: isInternal ? "complete" : providerEvents.some((p) => p.status === "settled") ? "complete" : "current",
    },
    {
      key: "settlement",
      label: "Settled",
      detail: settledAt ? "Funds settled" : "Not settled",
      at: settledAt,
      state: status === "posted" ? "complete" : "pending",
    },
  ];

  return {
    transfer: {
      id: row.id as string,
      reference: row.reference as string,
      status,
      direction: row.direction as string,
      sourceAmountMinor: row.source_amount_minor as number,
      sourceCurrency: row.source_currency as string,
      targetAmountMinor: row.target_amount_minor as number | null,
      targetCurrency: row.target_currency as string | null,
      feeMinor: row.fee_minor as number,
      feeCurrency: row.fee_currency as string | null,
      rate: row.rate as string | null,
      note: row.note as string | null,
      createdAt,
      updatedAt: row.updated_at as string,
      settledAt,
      failureReason: row.failure_reason as string | null,
      providerRef: row.provider_ref as string | null,
      userId: transferUserId,
    },
    sourceAccount: source,
    destinationAccount: destination ?? null,
    beneficiary: beneficiary ?? null,
    journal,
    feeJournal,
    hold: hold
      ? {
          id: hold.id,
          amountMinor: hold.amount_minor,
          currency: hold.currency,
          status: hold.status,
          createdAt: hold.created_at,
        }
      : null,
    providerEvents: providerEvents.map((p) => ({
      id: p.id,
      type: p.event_type,
      status: p.status,
      amountMinor: p.amount_minor,
      currency: p.currency,
      createdAt: p.created_at,
      providerRef: p.provider_ref,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      accountId: t.account_id,
      direction: t.direction,
      amountMinor: t.amount_minor,
      currency: t.currency,
      status: t.status,
      description: t.description,
      occurredAt: t.occurred_at,
    })),
    timeline,
  };
}

export function listTransfers(
  db: Database.Database,
  userId: string,
  limit = 10,
): Array<{
  id: string;
  reference: string;
  status: string;
  direction: string;
  sourceAmountMinor: number;
  sourceCurrency: string;
  targetAmountMinor: number | null;
  targetCurrency: string | null;
  feeMinor: number;
  createdAt: string;
  beneficiaryName: string | null;
  destinationName: string | null;
}> {
  const rows = db
    .prepare(
      `SELECT t.id, t.reference, t.status, t.direction, t.source_amount_minor, t.source_currency,
              t.target_amount_minor, t.target_currency, t.fee_minor, t.created_at,
              b.name AS beneficiary_name, a.name AS destination_name
       FROM transfers t
       LEFT JOIN beneficiaries b ON b.id = t.beneficiary_id
       LEFT JOIN accounts a ON a.id = t.destination_account_id
       WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as Array<{
    id: string;
    reference: string;
    status: string;
    direction: string;
    source_amount_minor: number;
    source_currency: string;
    target_amount_minor: number | null;
    target_currency: string | null;
    fee_minor: number;
    created_at: string;
    beneficiary_name: string | null;
    destination_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    status: row.status,
    direction: row.direction,
    sourceAmountMinor: row.source_amount_minor,
    sourceCurrency: row.source_currency,
    targetAmountMinor: row.target_amount_minor,
    targetCurrency: row.target_currency,
    feeMinor: row.fee_minor,
    createdAt: row.created_at,
    beneficiaryName: row.beneficiary_name,
    destinationName: row.destination_name,
  }));
}

export function listBeneficiaries(
  db: Database.Database,
  ownerType: "user" | "org",
  ownerId: string,
): Array<{
  id: string;
  name: string;
  type: string;
  email: string | null;
  bankName: string | null;
  masked: string | null;
  ibanMasked: string | null;
  currency: string;
  country: string;
  linkedAccountId: string | null;
}> {
  const rows = db
    .prepare(
      `SELECT id, name, type, email, bank_name, account_masked, iban_masked, currency, country, linked_account_id
       FROM beneficiaries WHERE owner_type = ? AND owner_id = ? AND status = 'active' ORDER BY name ASC`,
    )
    .all(ownerType, ownerId) as Array<{
    id: string;
    name: string;
    type: string;
    email: string | null;
    bank_name: string | null;
    account_masked: string | null;
    iban_masked: string | null;
    currency: string;
    country: string;
    linked_account_id: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    email: row.email,
    bankName: row.bank_name,
    masked: row.account_masked,
    ibanMasked: row.iban_masked,
    currency: row.currency,
    country: row.country,
    linkedAccountId: row.linked_account_id,
  }));
}

export function createBeneficiary(
  db: Database.Database,
  user: SessionUser,
  input: {
    name: string;
    type: "bank" | "wallet" | "internal";
    email?: string;
    bankName?: string;
    accountMasked: string;
    ibanMasked?: string;
    currency: string;
    country: string;
  },
): string {
  return writeTransaction(db, () => {
    const id = newId("ben");
    db.prepare(
      `INSERT INTO beneficiaries
        (id, owner_type, owner_id, name, type, email, bank_name, account_masked, iban_masked, linked_account_id, currency, country, status, created_at)
       VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'active', ?)`,
    ).run(
      id,
      user.id,
      input.name,
      input.type,
      input.email ?? null,
      input.bankName ?? null,
      input.accountMasked,
      input.ibanMasked ?? null,
      input.currency,
      input.country,
      new Date().toISOString(),
    );
    recordAudit(db, {
      actorId: user.id,
      actorRole: user.platformRole,
      action: "beneficiary.created",
      resourceType: "beneficiary",
      resourceId: id,
      metadata: { name: input.name, currency: input.currency },
    });
    return id;
  });
}

export function previewRate(from: string, to: string): string {
  return sandboxRate(from, to);
}
