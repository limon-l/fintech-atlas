import type Database from "better-sqlite3";
import Decimal from "decimal.js";
import { hashSecret, sha256 } from "@/lib/password";
import { newId, reference } from "@/lib/utils";
import { postJournal, recordAudit, writeTransaction, createHold } from "@/domain/ledger";
import { calculateSandboxQuote, sandboxRate } from "@/domain/fx";
import { DEMO_PASSWORD, DEMO_PIN } from "@/lib/demo";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedDatabase(db: Database.Database): boolean {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (existing.count > 0) return false;
  writeTransaction(db, () => seedAll(db));
  return true;
}

function seedAll(db: Database.Database): void {
  const now = new Date();
  const nowIso = now.toISOString();
  const rand = mulberry32(20261031);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
  const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const daysAgo = (days: number, hour = 12, minute = 0) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - days);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const daysAhead = (days: number, hour = 12) => daysAgo(-days, hour);
  const passwordHash = hashSecret(DEMO_PASSWORD);
  const pinHash = hashSecret(DEMO_PIN);

  /* ------------------------------------------------------------------ */
  /* Identity                                                            */
  /* ------------------------------------------------------------------ */

  const insertUser = db.prepare(
    `INSERT INTO users
      (id, email, name, initials, password_hash, pin_hash, platform_role, status, kyc_status, country, timezone, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
  );

  const userSeeds = [
    ["usr_maya", "maya@atlas.demo", "Maya Chen", "MC", "customer", "verified", "GB", "Europe/London"],
    ["usr_alex", "alex@atlas.demo", "Alex Morgan", "AM", "customer", "verified", "US", "America/New_York"],
    ["usr_sofia", "sofia@atlas.demo", "Sofia Rossi", "SR", "customer", "pending", "IT", "Europe/Rome"],
    ["usr_jonas", "jonas@atlas.demo", "Jonas Reed", "JR", "customer", "verified", "GB", "Europe/London"],
    ["usr_priya", "priya@atlas.demo", "Priya Nair", "PN", "customer", "verified", "GB", "Europe/London"],
    ["usr_leo", "leo@atlas.demo", "Leo Fischer", "LF", "customer", "verified", "DE", "Europe/Berlin"],
    ["usr_sam", "sam@atlas.demo", "Sam Okafor", "SO", "customer", "verified", "GB", "Europe/London"],
    ["usr_nadia", "nadia@atlas.demo", "Nadia Haddad", "NH", "risk", "verified", "AE", "Asia/Dubai"],
    ["usr_owen", "owen@atlas.demo", "Owen Blake", "OB", "support", "verified", "GB", "Europe/London"],
    ["usr_elena", "elena@atlas.demo", "Elena Voss", "EV", "compliance", "verified", "DE", "Europe/Berlin"],
    ["usr_admin", "admin@atlas.demo", "Atlas Operator", "AO", "super_admin", "verified", "GB", "Europe/London"],
  ] as const;

  for (const [id, email, name, initials, role, kyc, country, timezone] of userSeeds) {
    insertUser.run(
      id,
      email,
      name,
      initials,
      passwordHash,
      pinHash,
      role,
      kyc,
      country,
      timezone,
      daysAgo(180),
      daysAgo(1, 8),
    );
  }

  db.prepare(
    `INSERT INTO organizations (id, name, slug, legal_name, country, base_currency, kyb_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "org_northwind",
    "Northwind Studio",
    "northwind-studio",
    "Northwind Studio Ltd",
    "GB",
    "USD",
    "verified",
    daysAgo(420),
  );

  const insertMembership = db.prepare(
    `INSERT INTO memberships (id, org_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`,
  );
  insertMembership.run("mem_jonas", "org_northwind", "usr_jonas", "owner", daysAgo(420));
  insertMembership.run("mem_priya", "org_northwind", "usr_priya", "finance_manager", daysAgo(300));
  insertMembership.run("mem_leo", "org_northwind", "usr_leo", "approver", daysAgo(290));
  insertMembership.run("mem_sam", "org_northwind", "usr_sam", "employee", daysAgo(120));

  /* ------------------------------------------------------------------ */
  /* Ledger chart of accounts                                            */
  /* ------------------------------------------------------------------ */

  const insertLedger = db.prepare(
    `INSERT INTO ledger_accounts (id, code, name, type, currency, account_id, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const currency of ["USD", "EUR", "GBP"]) {
    insertLedger.run(`led_settlement_${currency}`, `SYS-SETTLEMENT-${currency}`, `Settlement clearing ${currency}`, "asset", currency, null, 1, daysAgo(500));
    insertLedger.run(`led_fx_${currency}`, `SYS-FX-CLEARING-${currency}`, `FX clearing ${currency}`, "asset", currency, null, 1, daysAgo(500));
    insertLedger.run(`led_fee_${currency}`, `SYS-FEE-REVENUE-${currency}`, `Fee revenue ${currency}`, "revenue", currency, null, 1, daysAgo(500));
  }
  insertLedger.run("led_receivable_usd", "SYS-AR-USD", "Accounts receivable USD", "asset", "USD", null, 1, daysAgo(500));
  insertLedger.run("led_revenue_usd", "SYS-REVENUE-USD", "Platform revenue USD", "revenue", "USD", null, 1, daysAgo(500));

  const settlement = (currency: string) => `led_settlement_${currency}`;
  const fxClearing = (currency: string) => `led_fx_${currency}`;
  const feeRevenue = (currency: string) => `led_fee_${currency}`;

  const insertAccount = db.prepare(
    `INSERT INTO accounts
      (id, owner_type, owner_id, name, kind, currency, country, iban, account_number_masked, status, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  );

  interface AccountRef {
    id: string;
    ledgerId: string;
    currency: string;
    name: string;
  }

  function createAccount(input: {
    id: string;
    ownerType: "user" | "org";
    ownerId: string;
    name: string;
    kind: string;
    currency: string;
    country: string;
    iban: string;
    masked: string;
    primary?: boolean;
    openingMinor: number;
    openedAt: string;
  }): AccountRef {
    const ledgerId = `led_${input.id}`;
    insertAccount.run(
      input.id,
      input.ownerType,
      input.ownerId,
      input.name,
      input.kind,
      input.currency,
      input.country,
      input.iban,
      input.masked,
      input.primary ? 1 : 0,
      input.openedAt,
    );
    insertLedger.run(
      ledgerId,
      `CUST-${input.id.toUpperCase()}`,
      `${input.name} (${input.currency})`,
      "liability",
      input.currency,
      input.id,
      0,
      input.openedAt,
    );
    if (input.openingMinor > 0) {
      postJournal(db, {
        description: `Opening balance — ${input.name}`,
        kind: "deposit",
        createdAt: input.openedAt,
        postings: [
          { ledgerAccountId: settlement(input.currency), amountMinor: input.openingMinor },
          { ledgerAccountId: ledgerId, amountMinor: -input.openingMinor },
        ],
      });
    }
    return { id: input.id, ledgerId, currency: input.currency, name: input.name };
  }

  const mayaUsd = createAccount({
    id: "acc_maya_usd",
    ownerType: "user",
    ownerId: "usr_maya",
    name: "Everyday USD",
    kind: "checking",
    currency: "USD",
    country: "US",
    iban: "ATLS •• 4021",
    masked: "•••• 4021",
    primary: true,
    openingMinor: 1_420_000,
    openedAt: daysAgo(400),
  });
  const mayaEur = createAccount({
    id: "acc_maya_eur",
    ownerType: "user",
    ownerId: "usr_maya",
    name: "Euro travel",
    kind: "wallet",
    currency: "EUR",
    country: "IE",
    iban: "ATLS •• 7734",
    masked: "•••• 7734",
    openingMinor: 320_000,
    openedAt: daysAgo(260),
  });
  const mayaGbp = createAccount({
    id: "acc_maya_gbp",
    ownerType: "user",
    ownerId: "usr_maya",
    name: "London GBP",
    kind: "wallet",
    currency: "GBP",
    country: "GB",
    iban: "ATLS •• 1188",
    masked: "•••• 1188",
    openingMinor: 150_000,
    openedAt: daysAgo(210),
  });
  const mayaSavings = createAccount({
    id: "acc_maya_savings",
    ownerType: "user",
    ownerId: "usr_maya",
    name: "Reserve savings",
    kind: "savings",
    currency: "USD",
    country: "US",
    iban: "ATLS •• 9055",
    masked: "•••• 9055",
    openingMinor: 1_100_000,
    openedAt: daysAgo(380),
  });
  const mayaGoal = createAccount({
    id: "acc_maya_kyoto",
    ownerType: "user",
    ownerId: "usr_maya",
    name: "Kyoto 2027",
    kind: "goal",
    currency: "USD",
    country: "US",
    iban: "ATLS •• 3310",
    masked: "•••• 3310",
    openingMinor: 200_000,
    openedAt: daysAgo(150),
  });

  const alexUsd = createAccount({
    id: "acc_alex_usd",
    ownerType: "user",
    ownerId: "usr_alex",
    name: "Alex checking",
    kind: "checking",
    currency: "USD",
    country: "US",
    iban: "ATLS •• 8842",
    masked: "•••• 8842",
    openingMinor: 520_000,
    openedAt: daysAgo(300),
  });
  createAccount({
    id: "acc_sofia_eur",
    ownerType: "user",
    ownerId: "usr_sofia",
    name: "Sofia wallet",
    kind: "wallet",
    currency: "EUR",
    country: "IT",
    iban: "ATLS •• 6612",
    masked: "•••• 6612",
    openingMinor: 180_000,
    openedAt: daysAgo(90),
  });

  const northwindUsd = createAccount({
    id: "acc_northwind_usd",
    ownerType: "org",
    ownerId: "org_northwind",
    name: "Operating account",
    kind: "treasury",
    currency: "USD",
    country: "GB",
    iban: "ATLS •• 2200",
    masked: "•••• 2200",
    primary: true,
    openingMinor: 8_420_000,
    openedAt: daysAgo(420),
  });
  createAccount({
    id: "acc_northwind_eur",
    ownerType: "org",
    ownerId: "org_northwind",
    name: "EUR treasury",
    kind: "treasury",
    currency: "EUR",
    country: "IE",
    iban: "ATLS •• 4412",
    masked: "•••• 4412",
    openingMinor: 1_250_000,
    openedAt: daysAgo(300),
  });
  createAccount({
    id: "acc_northwind_tax",
    ownerType: "org",
    ownerId: "org_northwind",
    name: "Tax reserve",
    kind: "savings",
    currency: "USD",
    country: "GB",
    iban: "ATLS •• 7781",
    masked: "•••• 7781",
    openingMinor: 1_800_000,
    openedAt: daysAgo(360),
  });

  /* ------------------------------------------------------------------ */
  /* Transactions                                                        */
  /* ------------------------------------------------------------------ */

  const insertTransaction = db.prepare(
    `INSERT INTO transactions
      (id, account_id, journal_id, transfer_id, card_id, direction, amount_minor, currency, status, category, merchant, description, counterparty, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  function addTransaction(input: {
    accountId: string;
    journalId?: string | null;
    transferId?: string | null;
    cardId?: string | null;
    direction: "credit" | "debit";
    amountMinor: number;
    currency: string;
    status?: string;
    category: string;
    merchant?: string | null;
    description: string;
    counterparty?: string | null;
    occurredAt: string;
  }): string {
    const id = newId("txn");
    insertTransaction.run(
      id,
      input.accountId,
      input.journalId ?? null,
      input.transferId ?? null,
      input.cardId ?? null,
      input.direction,
      input.amountMinor,
      input.currency,
      input.status ?? "posted",
      input.category,
      input.merchant ?? null,
      input.description,
      input.counterparty ?? null,
      input.occurredAt,
      input.occurredAt,
    );
    return id;
  }

  function spend(input: {
    account: AccountRef;
    amountMinor: number;
    category: string;
    merchant: string;
    description?: string;
    occurredAt: string;
    cardId?: string;
    status?: string;
  }) {
    const journal = postJournal(db, {
      description: `${input.merchant} — ${input.category}`,
      kind: input.cardId ? "card" : "transfer",
      createdAt: input.occurredAt,
      postings: [
        { ledgerAccountId: input.account.ledgerId, amountMinor: input.amountMinor },
        { ledgerAccountId: settlement(input.account.currency), amountMinor: -input.amountMinor },
      ],
    });
    addTransaction({
      accountId: input.account.id,
      journalId: journal.journalId,
      cardId: input.cardId,
      direction: "debit",
      amountMinor: input.amountMinor,
      currency: input.account.currency,
      category: input.category,
      merchant: input.merchant,
      description: input.description ?? input.merchant,
      occurredAt: input.occurredAt,
      status: input.status,
    });
  }

  function earn(input: {
    account: AccountRef;
    amountMinor: number;
    category: string;
    description: string;
    counterparty: string;
    occurredAt: string;
  }) {
    const journal = postJournal(db, {
      description: input.description,
      kind: "deposit",
      createdAt: input.occurredAt,
      postings: [
        { ledgerAccountId: settlement(input.account.currency), amountMinor: input.amountMinor },
        { ledgerAccountId: input.account.ledgerId, amountMinor: -input.amountMinor },
      ],
    });
    addTransaction({
      accountId: input.account.id,
      journalId: journal.journalId,
      direction: "credit",
      amountMinor: input.amountMinor,
      currency: input.account.currency,
      category: input.category,
      description: input.description,
      counterparty: input.counterparty,
      occurredAt: input.occurredAt,
    });
  }

  const insertTransfer = db.prepare(
    `INSERT INTO transfers
      (id, reference, user_id, source_account_id, beneficiary_id, destination_account_id, direction, status,
       source_amount_minor, source_currency, target_amount_minor, target_currency, fee_minor, fee_currency,
       rate, quote_id, hold_id, journal_id, provider_ref, failure_reason, note, idempotency_key, created_at, updated_at, settled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  function internalTransfer(input: {
    id?: string;
    userId: string;
    from: AccountRef;
    to: AccountRef;
    amountMinor: number;
    direction?: "internal" | "goal";
    category: string;
    description: string;
    occurredAt: string;
    note?: string;
  }) {
    const id = input.id ?? newId("trf");
    const ref = reference("TRF");
    const journal = postJournal(db, {
      description: input.description,
      kind: input.direction === "goal" ? "goal" : "transfer",
      transferId: id,
      createdAt: input.occurredAt,
      postings: [
        { ledgerAccountId: input.from.ledgerId, amountMinor: input.amountMinor },
        { ledgerAccountId: input.to.ledgerId, amountMinor: -input.amountMinor },
      ],
    });
    insertTransfer.run(
      id,
      ref,
      input.userId,
      input.from.id,
      null,
      input.to.id,
      input.direction ?? "internal",
      "posted",
      input.amountMinor,
      input.from.currency,
      input.amountMinor,
      input.to.currency,
      0,
      input.from.currency,
      "1",
      null,
      null,
      journal.journalId,
      null,
      null,
      input.note ?? null,
      null,
      input.occurredAt,
      input.occurredAt,
      input.occurredAt,
    );
    addTransaction({
      accountId: input.from.id,
      journalId: journal.journalId,
      transferId: id,
      direction: "debit",
      amountMinor: input.amountMinor,
      currency: input.from.currency,
      category: input.category,
      description: input.description,
      counterparty: input.to.name,
      occurredAt: input.occurredAt,
    });
    addTransaction({
      accountId: input.to.id,
      journalId: journal.journalId,
      transferId: id,
      direction: "credit",
      amountMinor: input.amountMinor,
      currency: input.to.currency,
      category: input.category,
      description: input.description,
      counterparty: input.from.name,
      occurredAt: input.occurredAt,
    });
    return { id, journalId: journal.journalId };
  }

  const cardInsert = db.prepare(
    `INSERT INTO cards
      (id, owner_type, owner_id, account_id, label, last4, network, kind, status, monthly_limit_minor,
       per_txn_limit_minor, currency, allowed_categories, created_at, frozen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  cardInsert.run(
    "crd_maya_1",
    "user",
    "usr_maya",
    mayaUsd.id,
    "Everyday virtual",
    "4821",
    "VISA",
    "virtual",
    "active",
    250_000,
    120_000,
    "USD",
    JSON.stringify(["Groceries", "Dining", "Transport", "Shopping", "Subscriptions", "Health", "Entertainment", "Travel", "Utilities"]),
    daysAgo(200),
    null,
  );
  cardInsert.run(
    "crd_sam_1",
    "org",
    "org_northwind",
    northwindUsd.id,
    "Sam — design",
    "7314",
    "VISA",
    "virtual",
    "active",
    150_000,
    50_000,
    "USD",
    JSON.stringify(["Software", "Travel", "Dining"]),
    daysAgo(100),
    null,
  );
  cardInsert.run(
    "crd_priya_1",
    "org",
    "org_northwind",
    northwindUsd.id,
    "Priya — finance",
    "2907",
    "VISA",
    "virtual",
    "active",
    500_000,
    200_000,
    "USD",
    JSON.stringify(["Software", "Travel", "Office"]),
    daysAgo(280),
    null,
  );
  cardInsert.run(
    "crd_contractor_1",
    "org",
    "org_northwind",
    northwindUsd.id,
    "Contractors (frozen)",
    "1180",
    "VISA",
    "virtual",
    "frozen",
    80_000,
    20_000,
    "USD",
    JSON.stringify(["Software"]),
    daysAgo(150),
    daysAgo(12),
  );

  // Maya — income and fixed costs
  earn({ account: mayaUsd, amountMinor: 640_000, category: "Income", description: "Salary — Northstar Labs", counterparty: "Northstar Labs", occurredAt: daysAgo(74, 9) });
  earn({ account: mayaUsd, amountMinor: 640_000, category: "Income", description: "Salary — Northstar Labs", counterparty: "Northstar Labs", occurredAt: daysAgo(44, 9) });
  earn({ account: mayaUsd, amountMinor: 640_000, category: "Income", description: "Salary — Northstar Labs", counterparty: "Northstar Labs", occurredAt: daysAgo(14, 9) });

  for (const days of [72, 42, 12]) {
    spend({ account: mayaUsd, amountMinor: 235_000, category: "Housing", merchant: "Hackney Lettings", description: "Monthly rent", occurredAt: daysAgo(days, 7) });
  }
  for (const [days, amount, merchant] of [
    [70, 14_520, "Octopus Energy"],
    [40, 14_520, "Octopus Energy"],
    [10, 14_520, "Octopus Energy"],
    [68, 4_820, "Thames Water"],
    [38, 4_820, "Thames Water"],
    [8, 4_820, "Thames Water"],
  ] as const) {
    spend({ account: mayaUsd, amountMinor: amount, category: "Utilities", merchant, occurredAt: daysAgo(days, 10) });
  }

  const subscriptions = [
    { merchant: "Netflix", amount: 1_599, day: 5 },
    { merchant: "Spotify", amount: 1_099, day: 8 },
    { merchant: "iCloud+", amount: 299, day: 12 },
    { merchant: "Notion", amount: 1_000, day: 20 },
  ];
  for (const monthOffset of [2, 1, 0]) {
    for (const sub of subscriptions) {
      const date = new Date(now);
      date.setUTCMonth(date.getUTCMonth() - monthOffset);
      date.setUTCDate(sub.day);
      date.setUTCHours(11, 30, 0, 0);
      if (date.getTime() > now.getTime()) continue;
      spend({
        account: mayaUsd,
        amountMinor: sub.amount,
        category: "Subscriptions",
        merchant: sub.merchant,
        occurredAt: date.toISOString(),
        cardId: "crd_maya_1",
      });
    }
  }

  // Maya — current-month card activity (drives budgets and analytics)
  const currentSpend: Array<[number, number, string, string, string]> = [
    [1, 8_420, "Groceries", "Whole Foods", "Weekly shop"],
    [2, 6_840, "Dining", "Dishoom", "Dinner with friends"],
    [3, 1_280, "Dining", "Blue Bottle", "Coffee"],
    [4, 12_800, "Shopping", "Uniqlo", "Autumn layers"],
    [5, 2_460, "Transport", "Uber", "Airport ride"],
    [6, 4_240, "Groceries", "Trader Joe's", "Pantry restock"],
    [7, 1_890, "Dining", "Sweetgreen", "Lunch"],
    [8, 2_430, "Health", "Boots", "Pharmacy"],
    [9, 7_640, "Shopping", "Amazon", "Home office"],
    [10, 840, "Transport", "TfL", "Contactless travel"],
    [11, 9_110, "Groceries", "Waitrose", "Weekly shop"],
    [12, 9_650, "Dining", "Ottolenghi", "Birthday dinner"],
    [13, 5_420, "Shopping", "Muji", "Storage"],
    [14, 6_210, "Transport", "Shell", "Fuel"],
    [15, 3_200, "Entertainment", "Curzon", "Film screening"],
    [16, 3_860, "Groceries", "Borough Market", "Market produce"],
    [17, 2_499, "Entertainment", "Steam", "Game"],
    [18, 4_200, "Health", "Gymbox", "Monthly membership"],
    [19, 960, "Dining", "Pret", "Breakfast"],
    [20, 38_600, "Travel", "Airbnb", "Lisbon weekend"],
    [21, 7_430, "Groceries", "Whole Foods", "Weekly shop"],
    [22, 24_900, "Shopping", "Apple Store", "AirPods"],
    [23, 1_830, "Transport", "Uber", "Late ride"],
    [24, 7_420, "Dining", "Dishoom", "Brunch"],
    [25, 1_200, "Other", "Post Office", "Parcel"],
  ];
  for (const [days, amount, category, merchant, description] of currentSpend) {
    spend({
      account: mayaUsd,
      amountMinor: amount,
      category,
      merchant,
      description,
      occurredAt: daysAgo(days, between(8, 21), between(0, 59)),
      cardId: "crd_maya_1",
    });
  }

  // Older discretionary spend
  const olderMerchants: Array<[string, string, number, number]> = [
    ["Groceries", "Whole Foods", 5_000, 11_000],
    ["Groceries", "Trader Joe's", 3_500, 8_500],
    ["Dining", "Dishoom", 4_000, 9_500],
    ["Dining", "Sweetgreen", 1_200, 2_400],
    ["Transport", "Uber", 1_000, 3_200],
    ["Transport", "TfL", 500, 1_200],
    ["Shopping", "Amazon", 2_000, 12_000],
    ["Shopping", "Uniqlo", 3_000, 10_000],
    ["Health", "Boots", 800, 4_000],
    ["Entertainment", "Roundhouse", 2_000, 6_000],
  ];
  for (let i = 0; i < 26; i += 1) {
    const [category, merchant, min, max] = pick(olderMerchants);
    spend({
      account: mayaUsd,
      amountMinor: between(min, max),
      category,
      merchant,
      occurredAt: daysAgo(between(27, 88), between(8, 22), between(0, 59)),
      cardId: "crd_maya_1",
    });
  }

  // Peer and wallet activity
  internalTransfer({
    userId: "usr_maya",
    from: mayaUsd,
    to: alexUsd,
    amountMinor: 12_000,
    category: "Transfers",
    description: "Dinner split",
    occurredAt: daysAgo(33, 20),
  });
  internalTransfer({
    userId: "usr_maya",
    from: mayaUsd,
    to: alexUsd,
    amountMinor: 8_500,
    category: "Transfers",
    description: "Concert tickets",
    occurredAt: daysAgo(19, 18),
  });
  internalTransfer({
    userId: "usr_maya",
    from: mayaUsd,
    to: alexUsd,
    amountMinor: 15_000,
    category: "Transfers",
    description: "Weekend cabin",
    occurredAt: daysAgo(6, 12),
  });

  for (const [days, amount] of [[28, 20_000], [14, 20_000], [3, 20_000]] as const) {
    internalTransfer({
      userId: "usr_maya",
      from: mayaUsd,
      to: mayaSavings,
      amountMinor: amount,
      direction: "goal",
      category: "Savings",
      description: "Monthly savings transfer",
      occurredAt: daysAgo(days, 9),
    });
  }
  for (const [days, amount] of [[45, 15_000], [24, 15_000], [9, 15_000]] as const) {
    internalTransfer({
      userId: "usr_maya",
      from: mayaUsd,
      to: mayaGoal,
      amountMinor: amount,
      direction: "goal",
      category: "Savings",
      description: "Kyoto 2027 contribution",
      occurredAt: daysAgo(days, 9),
    });
  }

  const insertBeneficiary = db.prepare(
    `INSERT INTO beneficiaries
      (id, owner_type, owner_id, name, type, email, bank_name, account_masked, iban_masked, linked_account_id, currency, country, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  );
  insertBeneficiary.run("ben_alex", "user", "usr_maya", "Alex Morgan", "internal", "alex@atlas.demo", "Atlas", "•••• 8842", null, alexUsd.id, "USD", "US", daysAgo(210));
  insertBeneficiary.run("ben_elena", "user", "usr_maya", "Elena Rossi", "bank", "elena.rossi@example.com", "Banca Sella", "•••• 5510", "IT60 •• 5510", null, "EUR", "IT", daysAgo(120));
  insertBeneficiary.run("ben_kwame", "user", "usr_maya", "Kwame Mensah", "bank", "kwame@example.com", "Barclays", "•••• 9031", "GB29 •• 9031", null, "GBP", "GB", daysAgo(60));
  insertBeneficiary.run("ben_studio", "org", "org_northwind", "Studio Supply Co", "bank", "billing@studiosupply.example", "Chase", "•••• 2219", "US64 •• 2219", null, "USD", "US", daysAgo(240));

  const insertQuote = db.prepare(
    `INSERT INTO fx_quotes
      (id, user_id, from_currency, to_currency, rate, source_amount_minor, target_amount_minor, fee_minor, fee_currency, expires_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // Completed FX conversion: USD -> EUR wallet
  const fxAmount = 100_000;
  const fxQuote = calculateSandboxQuote(fxAmount, "USD", "EUR", new Date(daysAgo(16, 10)));
  insertQuote.run(
    "fxq_maya_eur",
    "usr_maya",
    "USD",
    "EUR",
    fxQuote.rate,
    fxAmount,
    fxQuote.targetMinor,
    fxQuote.feeMinor,
    "USD",
    fxQuote.expiresAt,
    "used",
    daysAgo(16, 10),
  );
  const fxTransferId = "trf_maya_fx_eur";
  const fxSource = postJournal(db, {
    description: "FX conversion USD → EUR",
    kind: "fx",
    transferId: fxTransferId,
    createdAt: daysAgo(16, 10),
    postings: [
      { ledgerAccountId: mayaUsd.ledgerId, amountMinor: fxQuote.convertibleMinor },
      { ledgerAccountId: fxClearing("USD"), amountMinor: -fxQuote.convertibleMinor },
    ],
  });
  postJournal(db, {
    description: "FX conversion USD → EUR (target leg)",
    kind: "fx",
    transferId: fxTransferId,
    createdAt: daysAgo(16, 10),
    postings: [
      { ledgerAccountId: fxClearing("EUR"), amountMinor: fxQuote.targetMinor },
      { ledgerAccountId: mayaEur.ledgerId, amountMinor: -fxQuote.targetMinor },
    ],
  });
  postJournal(db, {
    description: "FX fee USD → EUR",
    kind: "fee",
    transferId: fxTransferId,
    createdAt: daysAgo(16, 10),
    postings: [
      { ledgerAccountId: mayaUsd.ledgerId, amountMinor: fxQuote.feeMinor },
      { ledgerAccountId: feeRevenue("USD"), amountMinor: -fxQuote.feeMinor },
    ],
  });
  insertTransfer.run(
    fxTransferId,
    reference("TRF"),
    "usr_maya",
    mayaUsd.id,
    null,
    mayaEur.id,
    "fx",
    "posted",
    fxAmount,
    "USD",
    fxQuote.targetMinor,
    "EUR",
    fxQuote.feeMinor,
    "USD",
    fxQuote.rate,
    "fxq_maya_eur",
    null,
    fxSource.journalId,
    "prov_fx_8831",
    null,
    "Lisbon spending money",
    null,
    daysAgo(16, 10),
    daysAgo(16, 10),
    daysAgo(16, 10),
  );
  addTransaction({
    accountId: mayaUsd.id,
    journalId: fxSource.journalId,
    transferId: fxTransferId,
    direction: "debit",
    amountMinor: fxAmount,
    currency: "USD",
    category: "Transfers",
    description: "FX transfer to Euro travel",
    counterparty: "Euro travel",
    occurredAt: daysAgo(16, 10),
  });
  addTransaction({
    accountId: mayaEur.id,
    journalId: fxSource.journalId,
    transferId: fxTransferId,
    direction: "credit",
    amountMinor: fxQuote.targetMinor,
    currency: "EUR",
    category: "Transfers",
    description: "FX transfer from Everyday USD",
    counterparty: "Everyday USD",
    occurredAt: daysAgo(16, 10),
  });

  // EUR wallet spending
  const eurSpends: Array<[number, number, string, string]> = [
    [12, 2_450, "Dining", "Time Out Market"],
    [11, 1_890, "Transport", "Metro Lisboa"],
    [10, 6_400, "Travel", "Lisbon Tours"],
    [9, 3_200, "Dining", "Cervejaria Ramiro"],
    [7, 1_250, "Groceries", "Pingo Doce"],
    [5, 4_800, "Shopping", "LX Factory"],
    [4, 2_100, "Dining", "Café A Brasileira"],
    [2, 1_600, "Transport", "Tram 28"],
  ];
  for (const [days, amount, category, merchant] of eurSpends) {
    spend({
      account: mayaEur,
      amountMinor: amount,
      category,
      merchant,
      occurredAt: daysAgo(days, 14),
      cardId: "crd_maya_1",
    });
  }

  const gbpSpends: Array<[number, number, string, string]> = [
    [20, 4_200, "Dining", "The Marksman"],
    [15, 1_150, "Transport", "TfL"],
    [9, 8_900, "Shopping", "Present & Correct"],
    [5, 3_600, "Groceries", "M&S Food"],
    [2, 6_800, "Dining", "Brat"],
  ];
  for (const [days, amount, category, merchant] of gbpSpends) {
    spend({
      account: mayaGbp,
      amountMinor: amount,
      category,
      merchant,
      occurredAt: daysAgo(days, 19),
      cardId: "crd_maya_1",
    });
  }

  // External EUR payout (settled) with provider reference
  const extEurAmount = 45_000;
  const extEurId = "trf_maya_eur_out";
  const extEurJournal = postJournal(db, {
    description: "International transfer to Elena Rossi",
    kind: "transfer",
    transferId: extEurId,
    createdAt: daysAgo(11, 9),
    postings: [
      { ledgerAccountId: mayaEur.ledgerId, amountMinor: extEurAmount },
      { ledgerAccountId: settlement("EUR"), amountMinor: -extEurAmount },
    ],
  });
  insertTransfer.run(
    extEurId,
    reference("TRF"),
    "usr_maya",
    mayaEur.id,
    "ben_elena",
    null,
    "external",
    "posted",
    extEurAmount,
    "EUR",
    extEurAmount,
    "EUR",
    0,
    "EUR",
    "1",
    null,
    null,
    extEurJournal.journalId,
    "prov_eur_5510",
    null,
    "Shared apartment deposit",
    null,
    daysAgo(11, 9),
    daysAgo(11, 9),
    daysAgo(10, 15),
  );
  addTransaction({
    accountId: mayaEur.id,
    journalId: extEurJournal.journalId,
    transferId: extEurId,
    direction: "debit",
    amountMinor: extEurAmount,
    currency: "EUR",
    category: "Transfers",
    description: "Transfer to Elena Rossi",
    counterparty: "Elena Rossi",
    occurredAt: daysAgo(11, 9),
  });
  db.prepare(
    `INSERT INTO provider_events (id, transfer_id, provider_ref, event_type, amount_minor, currency, status, created_at)
     VALUES (?, ?, ?, 'payout.settled', ?, ?, 'settled', ?)`,
  ).run("pe_eur_1", extEurId, "prov_eur_5510", extEurAmount, "EUR", daysAgo(10, 15));

  // External GBP payout in processing with an active hold (Money Flow Explorer)
  const pendingId = "trf_maya_gbp_pending";
  const pendingAmount = 22_000;
  insertTransfer.run(
    pendingId,
    reference("TRF"),
    "usr_maya",
    mayaGbp.id,
    "ben_kwame",
    null,
    "external",
    "processing",
    pendingAmount,
    "GBP",
    pendingAmount,
    "GBP",
    250,
    "GBP",
    "1",
    null,
    null,
    null,
    "prov_gbp_9031",
    null,
    "Rent contribution",
    null,
    daysAgo(0, 8),
    daysAgo(0, 8),
    null,
  );
  const pendingHold = createHold(db, {
    accountId: mayaGbp.id,
    amountMinor: pendingAmount + 250,
    currency: "GBP",
    transferId: pendingId,
    reason: "Outbound payment reservation",
  });
  db.prepare("UPDATE transfers SET hold_id = ? WHERE id = ?").run(pendingHold, pendingId);
  addTransaction({
    accountId: mayaGbp.id,
    transferId: pendingId,
    direction: "debit",
    amountMinor: pendingAmount,
    currency: "GBP",
    status: "processing",
    category: "Transfers",
    description: "Transfer to Kwame Mensah — processing",
    counterparty: "Kwame Mensah",
    occurredAt: daysAgo(0, 8),
  });
  db.prepare(
    `INSERT INTO provider_events (id, transfer_id, provider_ref, event_type, amount_minor, currency, status, created_at)
     VALUES (?, ?, ?, 'payout.processing', ?, ?, 'processing', ?)`,
  ).run("pe_gbp_1", pendingId, "prov_gbp_9031", pendingAmount, "GBP", daysAgo(0, 8));

  /* ------------------------------------------------------------------ */
  /* Personal finance structures                                         */
  /* ------------------------------------------------------------------ */

  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  db.prepare(
    `INSERT INTO budgets (id, user_id, month, total_limit_minor, currency, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("bdg_maya_current", "usr_maya", month, 330_000, "USD", daysAgo(25));
  const insertBudgetCategory = db.prepare(
    `INSERT INTO budget_categories (id, budget_id, category, limit_minor) VALUES (?, ?, ?, ?)`,
  );
  const budgetCategories: Array<[string, number]> = [
    ["Groceries", 65_000],
    ["Dining", 48_000],
    ["Transport", 26_000],
    ["Shopping", 42_000],
    ["Subscriptions", 13_000],
    ["Health", 22_000],
    ["Entertainment", 28_000],
    ["Travel", 50_000],
    ["Utilities", 26_000],
    ["Other", 10_000],
  ];
  for (const [category, limit] of budgetCategories) {
    insertBudgetCategory.run(newId("bct"), "bdg_maya_current", category, limit);
  }

  db.prepare(
    `INSERT INTO goals (id, user_id, name, target_minor, currency, target_date, account_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run("gol_kyoto", "usr_maya", "Kyoto 2027", 800_000, "USD", "2027-04-01", mayaGoal.id, daysAgo(150));
  db.prepare(
    `INSERT INTO goals (id, user_id, name, target_minor, currency, target_date, account_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run("gol_emergency", "usr_maya", "Emergency fund", 1_500_000, "USD", "2027-01-01", mayaSavings.id, daysAgo(380));

  const insertContribution = db.prepare(
    `INSERT INTO goal_contributions (id, goal_id, account_id, amount_minor, transfer_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const [days, amount] of [[28, 20_000], [14, 20_000], [3, 20_000]] as const) {
    insertContribution.run(newId("gct"), "gol_emergency", mayaSavings.id, amount, null, daysAgo(days, 9));
  }
  for (const [days, amount] of [[45, 15_000], [24, 15_000], [9, 15_000]] as const) {
    insertContribution.run(newId("gct"), "gol_kyoto", mayaGoal.id, amount, null, daysAgo(days, 9));
  }

  db.prepare(
    `INSERT INTO spending_policies (id, org_id, name, monthly_limit_minor, per_txn_limit_minor, requires_receipt, categories, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?)`,
  ).run(
    "pol_software",
    "org_northwind",
    "Software & tools",
    300_000,
    150_000,
    JSON.stringify(["Software", "Office"]),
    daysAgo(300),
  );
  db.prepare(
    `INSERT INTO spending_policies (id, org_id, name, monthly_limit_minor, per_txn_limit_minor, requires_receipt, categories, active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?)`,
  ).run(
    "pol_travel",
    "org_northwind",
    "Travel",
    600_000,
    250_000,
    JSON.stringify(["Travel", "Dining"]),
    daysAgo(300),
  );

  /* ------------------------------------------------------------------ */
  /* Business finance                                                    */
  /* ------------------------------------------------------------------ */

  const insertCustomer = db.prepare(
    `INSERT INTO customers (id, org_id, name, email, country, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const customers = [
    ["cus_lumen", "Lumen Labs", "finance@lumenlabs.example", "US"],
    ["cus_aster", "Aster & Co", "ap@asterco.example", "GB"],
    ["cus_meridian", "Meridian Health", "billing@meridian.example", "DE"],
    ["cus_cobalt", "Cobalt Retail", "finance@cobalt.example", "US"],
    ["cus_studio", "Studio Nine", "hello@studionine.example", "FR"],
  ] as const;
  for (const [id, name, email, country] of customers) {
    insertCustomer.run(id, "org_northwind", name, email, country, daysAgo(300));
  }

  const insertVendor = db.prepare(
    `INSERT INTO vendors (id, org_id, name, email, category, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
  );
  const vendors = [
    ["ven_figma", "Figma", "billing@figma.example", "Software", "USD"],
    ["ven_aws", "Amazon Web Services", "aws-billing@example.com", "Infrastructure", "USD"],
    ["ven_notion", "Notion", "billing@notion.example", "Software", "USD"],
    ["ven_wework", "WeWork", "billing@wework.example", "Office", "USD"],
    ["ven_print", "The Printing House", "orders@print.example", "Production", "USD"],
    ["ven_supply", "Studio Supply Co", "billing@studiosupply.example", "Equipment", "USD"],
  ] as const;
  for (const [id, name, email, category, currency] of vendors) {
    insertVendor.run(id, "org_northwind", name, email, category, currency, daysAgo(300));
  }

  const insertInvoice = db.prepare(
    `INSERT INTO invoices
      (id, org_id, number, customer_id, status, issue_date, due_date, currency, subtotal_minor,
       tax_minor, discount_minor, total_minor, amount_paid_minor, notes, created_at)
     VALUES (?, 'org_northwind', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertInvoiceLine = db.prepare(
    `INSERT INTO invoice_lines (id, invoice_id, description, quantity_milli, unit_price_minor, amount_minor)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  interface InvoiceSeed {
    id: string;
    number: string;
    customer: string;
    status: string;
    issuedDays: number;
    dueDays: number;
    lines: Array<[string, number, number]>;
    paidMinor?: number;
    notes?: string;
  }

  const invoiceSeeds: InvoiceSeed[] = [
    {
      id: "inv_041",
      number: "INV-2026-041",
      customer: "cus_lumen",
      status: "sent",
      issuedDays: 8,
      dueDays: 12,
      lines: [
        ["Brand system — phase 2", 1_000, 780_000],
        ["Design QA", 12_000, 25_000],
      ],
      notes: "Net 20. Payment by bank transfer.",
    },
    {
      id: "inv_040",
      number: "INV-2026-040",
      customer: "cus_aster",
      status: "partially_paid",
      issuedDays: 24,
      dueDays: 6,
      lines: [
        ["Product design retainer", 1_000, 650_000],
        ["Research sessions", 5_000, 45_000],
      ],
      paidMinor: 400_000,
    },
    {
      id: "inv_039",
      number: "INV-2026-039",
      customer: "cus_meridian",
      status: "paid",
      issuedDays: 46,
      dueDays: -16,
      lines: [
        ["Clinical dashboard redesign", 1_000, 1_750_000],
        ["Accessibility audit", 1_000, 350_000],
      ],
      paidMinor: 2_100_000,
    },
    {
      id: "inv_038",
      number: "INV-2026-038",
      customer: "cus_cobalt",
      status: "sent",
      issuedDays: 36,
      dueDays: -6,
      lines: [["Retail experience sprint", 1_000, 560_000]],
    },
    {
      id: "inv_037",
      number: "INV-2026-037",
      customer: "cus_studio",
      status: "draft",
      issuedDays: 2,
      dueDays: 28,
      lines: [
        ["Motion identity", 1_000, 280_000],
        ["Asset library", 1_000, 40_000],
      ],
    },
    {
      id: "inv_036",
      number: "INV-2026-036",
      customer: "cus_lumen",
      status: "paid",
      issuedDays: 68,
      dueDays: -38,
      lines: [["Brand system — phase 1", 1_000, 980_000]],
      paidMinor: 980_000,
    },
    {
      id: "inv_035",
      number: "INV-2026-035",
      customer: "cus_aster",
      status: "void",
      issuedDays: 74,
      dueDays: -44,
      lines: [["Cancelled scope", 1_000, 450_000]],
      notes: "Voided and replaced by INV-2026-040.",
    },
    {
      id: "inv_034",
      number: "INV-2026-034",
      customer: "cus_meridian",
      status: "sent",
      issuedDays: 14,
      dueDays: 16,
      lines: [
        ["Patient portal discovery", 1_000, 1_250_000],
        ["Workshop facilitation", 2_000, 95_000],
      ],
    },
    {
      id: "inv_033",
      number: "INV-2026-033",
      customer: "cus_cobalt",
      status: "partially_paid",
      issuedDays: 58,
      dueDays: -28,
      lines: [
        ["Store concept", 1_000, 520_000],
        ["Visual merchandising", 1_000, 195_000],
      ],
      paidMinor: 715_000,
    },
  ];

  function createInvoice(seed: InvoiceSeed) {
    const subtotal = seed.lines.reduce((acc, [, qtyMilli, price]) => {
      return acc + new Decimal(qtyMilli).times(price).div(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    }, 0);
    const tax = new Decimal(subtotal).times(2000).div(10_000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    const total = subtotal + tax;
    const paid = seed.paidMinor ?? 0;
    insertInvoice.run(
      seed.id,
      seed.number,
      seed.customer,
      seed.status,
      daysAgo(seed.issuedDays, 9),
      daysAhead(seed.dueDays, 17),
      "USD",
      subtotal,
      tax,
      0,
      total,
      paid,
      seed.notes ?? null,
      daysAgo(seed.issuedDays, 9),
    );
    for (const [description, qtyMilli, price] of seed.lines) {
      const amount = new Decimal(qtyMilli).times(price).div(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      insertInvoiceLine.run(newId("invl"), seed.id, description, qtyMilli, price, amount);
    }
    if (paid > 0) {
      const journal = postJournal(db, {
        description: `Invoice payment — ${seed.number}`,
        kind: "invoice",
        invoiceId: seed.id,
        createdAt: daysAgo(Math.max(1, seed.issuedDays - 5), 14),
        postings: [
          { ledgerAccountId: settlement("USD"), amountMinor: paid },
          { ledgerAccountId: northwindUsd.ledgerId, amountMinor: -paid },
        ],
      });
      addTransaction({
        accountId: northwindUsd.id,
        journalId: journal.journalId,
        direction: "credit",
        amountMinor: paid,
        currency: "USD",
        category: "Revenue",
        description: `Invoice ${seed.number} payment`,
        counterparty: customers.find((c) => c[0] === seed.customer)?.[1] ?? "Customer",
        occurredAt: daysAgo(Math.max(1, seed.issuedDays - 5), 14),
      });
    }
  }
  for (const invoice of invoiceSeeds) createInvoice(invoice);

  const insertBill = db.prepare(
    `INSERT INTO bills
      (id, org_id, vendor_id, number, status, issue_date, due_date, currency, amount_minor, category, description, created_at)
     VALUES (?, 'org_northwind', ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)`,
  );
  const billSeeds = [
    ["bil_aws", "ven_aws", "AWS-2026-10", "approved", 12, 5, 428_000, "Infrastructure", "October cloud infrastructure"],
    ["bil_figma", "ven_figma", "FIG-8841", "awaiting_approval", 6, 9, 144_000, "Software", "Design seats — annual"],
    ["bil_wework", "ven_wework", "WW-2210", "scheduled", 18, 2, 680_000, "Office", "November studio membership"],
    ["bil_print", "ven_print", "TPH-1190", "overdue", 40, -3, 215_000, "Production", "Launch print run"],
    ["bil_notion", "ven_notion", "NOT-5512", "paid", 34, -14, 96_000, "Software", "Team workspace"],
    ["bil_supply", "ven_supply", "SSC-9021", "awaiting_approval", 9, 14, 340_000, "Equipment", "Studio lighting kit"],
  ] as const;
  for (const [id, vendor, number, status, issued, due, amount, category, description] of billSeeds) {
    insertBill.run(
      id,
      vendor,
      number,
      status,
      daysAgo(issued, 9),
      daysAhead(due, 17),
      amount,
      category,
      description,
      daysAgo(issued, 9),
    );
  }
  // Paid bill settles through the ledger
  const notionBill = 96_000;
  const billJournal = postJournal(db, {
    description: "Bill payment — Notion NOT-5512",
    kind: "transfer",
    createdAt: daysAgo(20, 11),
    postings: [
      { ledgerAccountId: northwindUsd.ledgerId, amountMinor: notionBill },
      { ledgerAccountId: settlement("USD"), amountMinor: -notionBill },
    ],
  });
  addTransaction({
    accountId: northwindUsd.id,
    journalId: billJournal.journalId,
    direction: "debit",
    amountMinor: notionBill,
    currency: "USD",
    category: "Software",
    merchant: "Notion",
    description: "Bill payment — NOT-5512",
    counterparty: "Notion",
    occurredAt: daysAgo(20, 11),
  });

  const insertExpense = db.prepare(
    `INSERT INTO expenses
      (id, org_id, user_id, merchant, category, amount_minor, currency, status, project, receipt_name, submitted_at, decided_at, created_at)
     VALUES (?, 'org_northwind', ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)`,
  );
  const expenseSeeds = [
    ["exp_1", "usr_sam", "Adobe Creative Cloud", "Software", 5_999, "pending", "Brand system", "adobe-receipt.pdf", 2],
    ["exp_2", "usr_sam", "Uber", "Travel", 4_250, "approved", "Client visit", "uber-oct.pdf", 8],
    ["exp_3", "usr_sam", "Apple Store", "Equipment", 129_900, "pending", "Design lab", "apple-invoice.pdf", 4],
    ["exp_4", "usr_leo", "Figma", "Software", 14_400, "approved", "Design ops", "figma-oct.pdf", 12],
    ["exp_5", "usr_priya", "AWS Certification", "Learning", 30_000, "reimbursed", "Team development", "aws-cert.pdf", 30],
    ["exp_6", "usr_sam", "Monocle Magazine", "Office", 1_200, "rejected", "Studio library", null, 16],
    ["exp_7", "usr_priya", "WeWork Day Pass", "Office", 8_900, "approved", "Offsite", "wework-day.pdf", 6],
    ["exp_8", "usr_sam", "Dishoom", "Dining", 18_600, "pending", "Client dinner", "dishoom.pdf", 1],
    ["exp_9", "usr_leo", "Muji", "Office", 4_480, "reimbursed", "Studio supplies", "muji.pdf", 24],
    ["exp_10", "usr_sam", "Adobe Fonts", "Software", 9_999, "approved", "Brand system", "adobe-fonts.pdf", 20],
  ] as const;
  for (const [id, user, merchant, category, amount, status, project, receipt, submitted] of expenseSeeds) {
    insertExpense.run(
      id,
      user,
      merchant,
      category,
      amount,
      status,
      project,
      receipt,
      daysAgo(submitted, 10),
      status === "pending" ? null : daysAgo(Math.max(0, submitted - 1), 16),
      daysAgo(submitted, 10),
    );
  }

  const insertApproval = db.prepare(
    `INSERT INTO approval_requests
      (id, org_id, type, resource_id, title, amount_minor, currency, status, current_step, total_steps, requested_by, created_at, decided_at)
     VALUES (?, 'org_northwind', ?, ?, ?, ?, 'USD', ?, ?, 2, ?, ?, ?)`,
  );
  const insertStep = db.prepare(
    `INSERT INTO approval_steps (id, request_id, step_no, role_required, status, decided_by, decided_at, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertApproval.run("apr_1", "expense", "exp_1", "Adobe Creative Cloud — Sam", 5_999, "pending", 1, "usr_sam", daysAgo(2, 10), null);
  insertStep.run("aps_1a", "apr_1", 1, "approver", "pending", null, null, null);
  insertStep.run("aps_1b", "apr_1", 2, "finance_manager", "pending", null, null, null);

  insertApproval.run("apr_2", "expense", "exp_3", "Apple Store — Sam", 129_900, "pending", 2, "usr_sam", daysAgo(4, 10), null);
  insertStep.run("aps_2a", "apr_2", 1, "approver", "approved", "usr_leo", daysAgo(3, 9), "Valid for the design lab refresh.");
  insertStep.run("aps_2b", "apr_2", 2, "finance_manager", "pending", null, null, null);

  insertApproval.run("apr_3", "bill", "bil_figma", "Figma annual seats", 144_000, "pending", 1, "usr_priya", daysAgo(6, 10), null);
  insertStep.run("aps_3a", "apr_3", 1, "approver", "pending", null, null, null);
  insertStep.run("aps_3b", "apr_3", 2, "finance_manager", "pending", null, null, null);

  insertApproval.run("apr_4", "bill", "bil_supply", "Studio lighting kit", 340_000, "pending", 1, "usr_sam", daysAgo(9, 10), null);
  insertStep.run("aps_4a", "apr_4", 1, "approver", "pending", null, null, null);
  insertStep.run("aps_4b", "apr_4", 2, "finance_manager", "pending", null, null, null);

  insertApproval.run("apr_5", "expense", "exp_4", "Figma — Leo", 14_400, "approved", 3, "usr_leo", daysAgo(12, 10), daysAgo(11, 14));
  insertStep.run("aps_5a", "apr_5", 1, "approver", "approved", "usr_jonas", daysAgo(12, 15), "Approved.");
  insertStep.run("aps_5b", "apr_5", 2, "finance_manager", "approved", "usr_priya", daysAgo(11, 14), "Within software policy.");

  // Business external payout with a deliberate reconciliation difference
  const payoutAmount = 820_000;
  const payoutId = "trf_biz_payout";
  const payoutJournal = postJournal(db, {
    description: "Vendor payout — Studio Supply Co",
    kind: "transfer",
    transferId: payoutId,
    createdAt: daysAgo(5, 9),
    postings: [
      { ledgerAccountId: northwindUsd.ledgerId, amountMinor: payoutAmount },
      { ledgerAccountId: settlement("USD"), amountMinor: -payoutAmount },
    ],
  });
  insertTransfer.run(
    payoutId,
    reference("TRF"),
    "usr_jonas",
    northwindUsd.id,
    "ben_studio",
    null,
    "external",
    "posted",
    payoutAmount,
    "USD",
    payoutAmount,
    "USD",
    0,
    "USD",
    "1",
    null,
    null,
    payoutJournal.journalId,
    "prov_usd_2219",
    null,
    "Studio equipment invoice",
    null,
    daysAgo(5, 9),
    daysAgo(4, 17),
    daysAgo(4, 17),
  );
  addTransaction({
    accountId: northwindUsd.id,
    journalId: payoutJournal.journalId,
    transferId: payoutId,
    direction: "debit",
    amountMinor: payoutAmount,
    currency: "USD",
    category: "Vendors",
    merchant: "Studio Supply Co",
    description: "Vendor payout",
    counterparty: "Studio Supply Co",
    occurredAt: daysAgo(5, 9),
  });
  db.prepare(
    `INSERT INTO provider_events (id, transfer_id, provider_ref, event_type, amount_minor, currency, status, created_at)
     VALUES (?, ?, ?, 'payout.settled', ?, 'USD', 'settled', ?)`,
  ).run("pe_usd_1", payoutId, "prov_usd_2219", payoutAmount - 1_250, daysAgo(4, 17));

  // Paid AWS bill
  const awsAmount = 428_000;
  const awsJournal = postJournal(db, {
    description: "Bill payment — Amazon Web Services",
    kind: "transfer",
    createdAt: daysAgo(3, 11),
    postings: [
      { ledgerAccountId: northwindUsd.ledgerId, amountMinor: awsAmount },
      { ledgerAccountId: settlement("USD"), amountMinor: -awsAmount },
    ],
  });
  addTransaction({
    accountId: northwindUsd.id,
    journalId: awsJournal.journalId,
    direction: "debit",
    amountMinor: awsAmount,
    currency: "USD",
    category: "Infrastructure",
    merchant: "Amazon Web Services",
    description: "Bill payment — AWS-2026-10",
    counterparty: "Amazon Web Services",
    occurredAt: daysAgo(3, 11),
  });

  /* ------------------------------------------------------------------ */
  /* Operations, risk, compliance, audit                                 */
  /* ------------------------------------------------------------------ */

  const insertRisk = db.prepare(
    `INSERT INTO risk_events
      (id, user_id, org_id, type, severity, status, title, detail, transfer_id, assigned_to, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertRisk.run("rsk_1", "usr_alex", null, "velocity", "medium", "open", "Transfer velocity above baseline", "Four outgoing transfers within 18 minutes, 3.2× the 30-day baseline.", null, "usr_nadia", daysAgo(0, 7), null);
  insertRisk.run("rsk_2", "usr_maya", null, "beneficiary_change", "high", "reviewing", "New beneficiary followed by payout", "New GBP beneficiary added 6 minutes before a £220 payout.", "trf_maya_gbp_pending", "usr_nadia", daysAgo(0, 8), null);
  insertRisk.run("rsk_3", "usr_sofia", null, "failed_auth", "medium", "open", "Repeated authentication failures", "Six failed sign-in attempts from two devices in 24 hours.", null, null, daysAgo(1, 22), null);
  insertRisk.run("rsk_4", "usr_jonas", "org_northwind", "duplicate_payment", "high", "cleared", "Duplicate bill payment attempt", "Same vendor, amount and invoice number submitted twice within 90 seconds.", null, "usr_nadia", daysAgo(3, 15), daysAgo(3, 17));
  insertRisk.run("rsk_5", "usr_sam", "org_northwind", "policy_exception", "low", "reviewing", "Expense above category guideline", "Apple Store expense is 2.6× the equipment guideline.", null, "usr_nadia", daysAgo(4, 11), null);
  insertRisk.run("rsk_6", "usr_maya", null, "card_restriction", "low", "cleared", "Card used outside allowed category", "Attempted merchant category blocked by card controls.", null, null, daysAgo(8, 19), daysAgo(8, 20));

  const insertCase = db.prepare(
    `INSERT INTO compliance_cases
      (id, subject_type, subject_id, type, status, priority, summary, assigned_to, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertCase.run("cmp_1", "user", "usr_sofia", "kyc", "info_requested", "normal", "Proof of address document is expired. Requested a current utility bill.", "usr_elena", daysAgo(6), daysAgo(2));
  insertCase.run("cmp_2", "org", "org_northwind", "kyb", "reviewing", "high", "Annual KYB refresh — confirm directors and beneficial ownership.", "usr_elena", daysAgo(4), daysAgo(1));
  insertCase.run("cmp_3", "user", "usr_alex", "aml", "open", "high", "Structuring signal from transfer velocity review.", "usr_elena", daysAgo(0, 7), daysAgo(0, 7));
  insertCase.run("cmp_4", "user", "usr_maya", "dispute", "reviewing", "normal", "Customer disputes a duplicate dining charge.", "usr_owen", daysAgo(3), daysAgo(1));

  const runId = "rec_run_1";
  db.prepare(
    `INSERT INTO reconciliation_runs (id, started_at, completed_at, status, item_count, exception_count, actor_id)
     VALUES (?, ?, ?, 'completed', 5, 1, 'usr_admin')`,
  ).run(runId, daysAgo(0, 5), daysAgo(0, 5, 6));
  const insertRecItem = db.prepare(
    `INSERT INTO reconciliation_items (id, run_id, currency, ledger_minor, provider_minor, difference_minor, status, transfer_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertRecItem.run("rec_i1", runId, "USD", 1_248_000, 1_248_000, 0, "matched", null, "Card settlement batch 2026-10-29");
  insertRecItem.run("rec_i2", runId, "USD", 820_000, 818_750, 1_250, "exception", "trf_biz_payout", "Provider deducted a $12.50 correspondent fee not present in ledger");
  insertRecItem.run("rec_i3", runId, "EUR", 45_000, 45_000, 0, "matched", "trf_maya_eur_out", "SEPA payout batch");
  insertRecItem.run("rec_i4", runId, "GBP", 22_000, 22_000, 0, "matched", "trf_maya_gbp_pending", "Faster Payments in-flight batch");
  insertRecItem.run("rec_i5", runId, "USD", 2_100_000, 2_100_000, 0, "matched", null, "Invoice collection batch");

  const insertNotification = db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, kind, href, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertNotification.run("ntf_1", "usr_maya", "Transfer is processing", "Your £220.00 transfer to Kwame Mensah is with the payment network. Funds are held until settlement.", "transfer", "/app/transfers/trf_maya_gbp_pending", null, daysAgo(0, 8));
  insertNotification.run("ntf_2", "usr_maya", "Budget check-in", "You have used 59% of your October budget with 5 days remaining.", "insight", "/app/budgets", null, daysAgo(0, 7));
  insertNotification.run("ntf_3", "usr_maya", "Card payment posted", "Whole Foods $84.20 was posted to Everyday USD.", "card", "/app/transactions", daysAgo(0, 9), daysAgo(1, 8));
  insertNotification.run("ntf_4", "usr_maya", "Savings contribution received", "$200.00 moved to Reserve savings.", "goal", "/app/goals", daysAgo(2, 10), daysAgo(3, 9));
  insertNotification.run("ntf_5", "usr_maya", "FX quote expired", "Your USD → EUR quote expired after 90 seconds. Create a new quote to continue.", "info", "/app/fx", daysAgo(3, 11), daysAgo(4, 12));
  insertNotification.run("ntf_6", "usr_jonas", "Approval required", "Figma annual seats ($1,440.00) is waiting for manager approval.", "approval", "/business/approvals", null, daysAgo(6, 10));
  insertNotification.run("ntf_7", "usr_priya", "Reconciliation exception", "A $12.50 provider fee difference needs review.", "risk", "/ops/reconciliation", null, daysAgo(0, 6));
  insertNotification.run("ntf_8", "usr_jonas", "Invoice overdue", "INV-2026-038 for Cobalt Retail is 6 days overdue.", "invoice", "/business/invoices", daysAgo(0, 8), daysAgo(0, 9));

  const insertWebhook = db.prepare(
    `INSERT INTO webhook_events (id, type, payload, status, attempts, last_attempt_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const webhooks = [
    ["wh_1", "transfer.posted", { id: "trf_maya_fx_eur", status: "posted", amount: 100000, currency: "USD" }, "delivered", 1, 16],
    ["wh_2", "invoice.paid", { id: "inv_039", total: 2100000, currency: "USD" }, "delivered", 1, 46],
    ["wh_3", "card.frozen", { id: "crd_contractor_1", reason: "policy" }, "delivered", 1, 12],
    ["wh_4", "payout.settled", { id: "trf_biz_payout", provider_ref: "prov_usd_2219" }, "delivered", 1, 4],
    ["wh_5", "approval.approved", { id: "apr_5", step: 2 }, "delivered", 2, 11],
    ["wh_6", "risk.flagged", { id: "rsk_2", severity: "high" }, "failed", 3, 0],
  ] as const;
  for (const [id, type, payload, status, attempts, days] of webhooks) {
    insertWebhook.run(
      id,
      type,
      JSON.stringify(payload),
      status,
      attempts,
      daysAgo(days, 10),
      daysAgo(days, 10),
    );
  }

  const insertTicket = db.prepare(
    `INSERT INTO support_tickets (id, user_id, subject, status, priority, assignee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertTicket.run("sup_1", "usr_sofia", "KYC document upload fails", "open", "high", "usr_owen", daysAgo(2), daysAgo(1));
  insertTicket.run("sup_2", "usr_maya", "Duplicate dining charge", "pending", "normal", "usr_owen", daysAgo(3), daysAgo(1));
  insertTicket.run("sup_3", "usr_alex", "Why is my transfer delayed?", "open", "normal", null, daysAgo(0, 9), daysAgo(0, 9));
  insertTicket.run("sup_4", "usr_jonas", "Add a second approver", "resolved", "low", "usr_owen", daysAgo(9), daysAgo(7));

  const auditSeeds: Array<[string, string, string, string, string, number, Record<string, unknown>]> = [
    ["usr_maya", "customer", "transfer.created", "transfer", "trf_maya_gbp_pending", 0, { amount: 22000, currency: "GBP" }],
    ["usr_maya", "customer", "session.login", "user", "usr_maya", 0, { method: "password" }],
    ["usr_nadia", "risk", "risk.review_started", "risk_event", "rsk_2", 0, { severity: "high" }],
    ["usr_admin", "super_admin", "reconciliation.completed", "reconciliation_run", "rec_run_1", 0, { exceptions: 1 }],
    ["usr_priya", "finance_manager", "invoice.sent", "invoice", "inv_041", 1, { total: 961800 }],
    ["usr_leo", "approver", "approval.step_approved", "approval_request", "apr_2", 3, { step: 1 }],
    ["usr_sam", "employee", "expense.submitted", "expense", "exp_1", 2, { amount: 5999 }],
    ["usr_elena", "compliance", "kyc.info_requested", "compliance_case", "cmp_1", 2, {}],
    ["usr_jonas", "owner", "payout.created", "transfer", "trf_biz_payout", 5, { amount: 820000 }],
    ["usr_owen", "support", "support.ticket_updated", "support_ticket", "sup_2", 1, { status: "pending" }],
    ["usr_maya", "customer", "card.frozen", "card", "crd_maya_1", 8, { reason: "customer_request" }],
    ["usr_admin", "super_admin", "webhook.replayed", "webhook_event", "wh_5", 11, { attempts: 2 }],
  ];
  for (const [actor, role, action, resourceType, resourceId, days, metadata] of auditSeeds) {
    db.prepare(
      `INSERT INTO audit_events (id, actor_id, actor_role, action, resource_type, resource_id, org_id, ip, request_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId("aud"),
      actor,
      role,
      action,
      resourceType,
      resourceId,
      resourceType === "organization" ? "org_northwind" : null,
      "127.0.0.1",
      newId("req"),
      JSON.stringify(metadata),
      daysAgo(days, 9, between(0, 59)),
    );
  }

  const apiKey = "atlas_sk_sandbox_demo_7f3c9a2e5b814d06";
  db.prepare(
    `INSERT INTO api_keys (id, user_id, name, prefix, key_hash, environment, last_used_at, created_at, revoked_at)
     VALUES (?, 'usr_jonas', ?, ?, ?, 'sandbox', ?, ?, NULL)`,
  ).run("key_demo", "Northwind sandbox key", "atlas_sk_sandbox_demo", sha256(apiKey), daysAgo(0, 7), daysAgo(40));

  // A demo FX quote that is still valid when the app starts
  const liveQuote = calculateSandboxQuote(50_000, "USD", "EUR", now);
  insertQuote.run(
    "fxq_live_demo",
    "usr_maya",
    "USD",
    "EUR",
    liveQuote.rate,
    50_000,
    liveQuote.targetMinor,
    liveQuote.feeMinor,
    "USD",
    liveQuote.expiresAt,
    "active",
    nowIso,
  );

  recordAudit(db, {
    actorId: "usr_admin",
    actorRole: "super_admin",
    action: "sandbox.seeded",
    resourceType: "platform",
    resourceId: "atlas",
    metadata: {
      users: userSeeds.length,
      accounts: 8,
      rateSnapshot: sandboxRate("USD", "EUR"),
    },
  });
}
