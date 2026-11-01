import { CircleAlert, ScanSearch, ShieldCheck, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/lib/auth";
import { listExpenses } from "@/server/business";
import { listAccounts } from "@/server/finance";
import { canBusiness } from "@/domain/rbac";
import { PageHeader, SandboxNote, Panel, Stat, EmptyState, Disclosure } from "@/components/ui/misc";
import { Money } from "@/components/ui/money";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseForm, ExpenseReimburseForm } from "@/components/app/business-forms";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const ctx = await requireBusiness();
  const db = getDb();
  const all = listExpenses(db, ctx.orgId);
  const canReadAll = canBusiness(ctx.role, "expense:read_all");
  const expenses = canReadAll ? all : all.filter((expense) => expense.userId === ctx.user.id);
  const accounts = listAccounts(db, "org", ctx.orgId);
  const currency = expenses[0]?.currency ?? ctx.baseCurrency;
  const pending = expenses.filter((expense) => expense.status === "pending");
  const approved = expenses.filter((expense) => expense.status === "approved");
  const flags = expenses.filter((expense) => expense.policyFlag);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business · employee spend"
        title="Expenses"
        description="Submit, review and reimburse employee spend. Policy flags compare each claim with active per-transaction limits."
      />
      <SandboxNote />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Claims" value={expenses.length} hint={canReadAll ? "All organization claims" : "Your claims"} icon={<ScanSearch className="h-4 w-4" />} />
        <Stat label="Pending" value={pending.length} hint={<Money amountMinor={pending.reduce((acc, expense) => acc + expense.amountMinor, 0)} currency={currency} />} icon={<ShieldCheck className="h-4 w-4" />} trend={pending.length > 0 ? <Badge variant="warning">Review</Badge> : null} />
        <Stat label="Approved" value={approved.length} hint="Ready to reimburse" icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Policy flags" value={flags.length} hint="Over per-transaction limit" icon={<CircleAlert className="h-4 w-4" />} trend={flags.length > 0 ? <Badge variant="danger">Check</Badge> : <Badge variant="success">Clear</Badge>} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <Panel title="Claims" description={`${expenses.length} records`} bodyClassName="p-0">
          {expenses.length === 0 ? (
            <EmptyState className="m-5" title="No expenses yet" description="Submit a claim to start the approval flow." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{expense.merchant}</p>
                        {expense.policyFlag ? <Badge variant="danger">Policy</Badge> : null}
                      </div>
                      <p className="text-[10px] text-subtle">{formatDate(expense.submittedAt)}{expense.project ? ` · ${expense.project}` : ""}</p>
                    </TableCell>
                    <TableCell className="text-[12px]">{expense.employee}</TableCell>
                    <TableCell className="text-[11.5px] text-muted">{expense.category}</TableCell>
                    <TableCell><StatusPill status={expense.status} /></TableCell>
                    <TableCell className="text-right"><Money amountMinor={expense.amountMinor} currency={expense.currency} className="text-[12px] font-semibold" /></TableCell>
                    <TableCell>
                      {expense.status === "approved" ? (
                        <ExpenseReimburseForm expense={{ id: expense.id, currency: expense.currency }} accounts={accounts} />
                      ) : (
                        <span className="text-[10px] text-subtle">{expense.status === "pending" ? "In approvals" : expense.status === "reimbursed" ? "Paid out" : "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="Submit expense" description="Routes to the approval queue">
          <ExpenseForm baseCurrency={ctx.baseCurrency} />
        </Panel>
      </section>

      <Disclosure>Expense claims and reimbursements are synthetic. Receipt files are not uploaded; only a name is stored.</Disclosure>
    </div>
  );
}
