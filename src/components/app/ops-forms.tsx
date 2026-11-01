"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck, Webhook } from "lucide-react";
import {
  postAdjustmentAction,
  replayWebhookAction,
  resolveReconciliationAction,
  reverseJournalAction,
  reviewComplianceAction,
  reviewRiskAction,
  runReconciliationAction,
  settlePayoutAction,
  updateSupportTicketAction,
  type OpsActionState,
} from "@/app/actions/ops";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: OpsActionState = {};

function useOpsToast(state: OpsActionState): void {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);
}

export function RiskReviewForm({ riskId }: { riskId: string }) {
  const [state, action] = useActionState(reviewRiskAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="riskId" value={riskId} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Outcome" htmlFor={`risk-status-${riskId}`}>
          <Select id={`risk-status-${riskId}`} name="status" defaultValue="reviewing">
            <option value="reviewing">Keep reviewing</option>
            <option value="cleared">Clear signal</option>
            <option value="escalated">Escalate</option>
          </Select>
        </Field>
        <Field label="Authorization PIN" htmlFor={`risk-pin-${riskId}`} hint="Demo PIN: 246810">
          <Input id={`risk-pin-${riskId}`} name="pin" type="password" inputMode="numeric" autoComplete="off" required />
        </Field>
      </div>
      <Field label="Review note" htmlFor={`risk-note-${riskId}`}>
        <Textarea id={`risk-note-${riskId}`} name="note" required maxLength={2000} placeholder="What did you check, and why is this the right outcome?" />
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="Recording…">
        <ShieldCheck className="h-3.5 w-3.5" /> Record decision
      </SubmitButton>
    </form>
  );
}

export function ComplianceReviewForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState(reviewComplianceAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Decision" htmlFor={`case-status-${caseId}`}>
          <Select id={`case-status-${caseId}`} name="status" defaultValue="reviewing">
            <option value="reviewing">Continue review</option>
            <option value="info_requested">Request information</option>
            <option value="approved">Approve</option>
            <option value="rejected">Reject</option>
          </Select>
        </Field>
        <Field label="Authorization PIN" htmlFor={`case-pin-${caseId}`} hint="Demo PIN: 246810">
          <Input id={`case-pin-${caseId}`} name="pin" type="password" inputMode="numeric" autoComplete="off" required />
        </Field>
      </div>
      <Field label="Decision note" htmlFor={`case-note-${caseId}`}>
        <Textarea id={`case-note-${caseId}`} name="note" required maxLength={2000} placeholder="Record the evidence and rationale." />
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="sm" pendingLabel="Recording…">
        <ShieldCheck className="h-3.5 w-3.5" /> Record decision
      </SubmitButton>
    </form>
  );
}

export function SupportTicketForm({
  ticketId,
  status,
  priority,
}: {
  ticketId: string;
  status: string;
  priority: string;
}) {
  const [state, action] = useActionState(updateSupportTicketAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field label="Status" htmlFor={`ticket-status-${ticketId}`} className="min-w-[130px]">
        <Select id={`ticket-status-${ticketId}`} name="status" defaultValue={status}>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </Select>
      </Field>
      <Field label="Priority" htmlFor={`ticket-priority-${ticketId}`} className="min-w-[130px]">
        <Select id={`ticket-priority-${ticketId}`} name="priority" defaultValue={priority}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </Select>
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
        Update ticket
      </SubmitButton>
      <div className="w-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}

export function ReconcileButton() {
  const [state, action] = useActionState(runReconciliationAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton pendingLabel="Reconciling…">
        <RotateCcw className="h-3.5 w-3.5" /> Run sandbox reconciliation
      </SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function ReconciliationItemForm({ itemId }: { itemId: string }) {
  const [state, action] = useActionState(resolveReconciliationAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Outcome" htmlFor={`rec-status-${itemId}`}>
          <Select id={`rec-status-${itemId}`} name="status" defaultValue="investigating">
            <option value="investigating">Mark investigating</option>
            <option value="resolved">Resolve exception</option>
          </Select>
        </Field>
        <Field label="Authorization PIN" htmlFor={`rec-pin-${itemId}`} hint="Demo PIN: 246810">
          <Input id={`rec-pin-${itemId}`} name="pin" type="password" inputMode="numeric" autoComplete="off" required />
        </Field>
      </div>
      <Field label="Resolution note" htmlFor={`rec-note-${itemId}`}>
        <Textarea id={`rec-note-${itemId}`} name="note" required maxLength={2000} placeholder="Explain the difference and the resolution." />
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
        Save reconciliation decision
      </SubmitButton>
    </form>
  );
}

export function ReverseJournalForm({ journalId }: { journalId: string }) {
  const [state, action] = useActionState(reverseJournalAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="journalId" value={journalId} />
      <Field label="Correction reason" htmlFor={`reverse-reason-${journalId}`}>
        <Textarea id={`reverse-reason-${journalId}`} name="reason" required maxLength={2000} placeholder="Why is this journal being reversed?" />
      </Field>
      <Field label="Authorization PIN" htmlFor={`reverse-pin-${journalId}`} hint="Demo PIN: 246810">
        <Input id={`reverse-pin-${journalId}`} name="pin" type="password" inputMode="numeric" autoComplete="off" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="sm" variant="danger" pendingLabel="Posting reversal…">
        <RotateCcw className="h-3.5 w-3.5" /> Post reversal journal
      </SubmitButton>
    </form>
  );
}

export function AdjustmentForm({
  accounts,
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
}) {
  const [state, action] = useActionState(postAdjustmentAction, initial);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const currency = accounts.find((account) => account.id === accountId)?.currency ?? "";
  useOpsToast(state);
  return (
    <form action={action} className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Account" htmlFor="adjustment-account">
          <Select
            id="adjustment-account"
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency" htmlFor="adjustment-currency">
          <Input id="adjustment-currency" name="currency" value={currency} readOnly />
        </Field>
      </div>
      <Field
        label="Signed amount"
        htmlFor="adjustment-amount"
        hint="Positive debits the account, negative credits it. Enter a decimal amount in the account currency."
      >
        <Input id="adjustment-amount" name="amount" inputMode="decimal" placeholder="25.00" required />
      </Field>
      <Field label="Reason" htmlFor="adjustment-reason">
        <Textarea id="adjustment-reason" name="reason" required maxLength={2000} placeholder="Reference the reconciliation item or correction ticket." />
      </Field>
      <Field label="Authorization PIN" htmlFor="adjustment-pin" hint="Demo PIN: 246810">
        <Input id="adjustment-pin" name="pin" type="password" inputMode="numeric" autoComplete="off" required />
      </Field>
      <FormError message={state.error} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="Posting adjustment…">
        Post controlled adjustment
      </SubmitButton>
    </form>
  );
}

export function SettlePayoutForm({ transferId, reference }: { transferId: string; reference: string }) {
  const [state, action] = useActionState(settlePayoutAction, initial);
  useOpsToast(state);
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        if (!window.confirm(`Post the simulated settlement for ${reference}? This moves the held funds.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="transferId" value={transferId} />
      <Field label="Authorization PIN" htmlFor={`settle-pin-${transferId}`} hint="Demo PIN: 246810">
        <Input
          id={`settle-pin-${transferId}`}
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
          className="w-36"
        />
      </Field>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Settling…">
        Settle payout
      </SubmitButton>
      <div className="w-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}

export function WebhookReplayButton({ webhookId, status }: { webhookId: string; status: string }) {
  const [state, action] = useActionState(replayWebhookAction, initial);
  useOpsToast(state);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="webhookId" value={webhookId} />
      <Button type="submit" size="sm" variant="secondary">
        <Webhook className="h-3.5 w-3.5" /> {status === "delivered" ? "Replay" : "Retry"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}
