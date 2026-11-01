import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpenCheck, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { getDb } from "@/db/client";
import { requireOps } from "@/lib/auth";
import { getCustomer360 } from "@/server/ops";
import { PageHeader, SandboxNote, Panel, EmptyState, KeyValue, Avatar, Disclosure, Stat } from "@/components/ui/misc";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Customer profile" };

export default async function OpsCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOps("ops:read");
  const db = getDb();
  const detail = getCustomer360(db, id);
  if (!detail) notFound();
  const user = detail.user;
  const accounts = detail.accounts as Array<Record<string, unknown>>;
  const cases = detail.cases as Array<Record<string, unknown>>;
  const risk = detail.risk as Array<Record<string, unknown>>;
  const transactions = detail.transactions as Array<Record<string, unknown>>;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations · customer 360"
        title={String(user.name)}
        description={`${String(user.email)} · joined ${formatDateTime(String(user.created_at))}`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/ops/customers"><ArrowLeft className="h-3.5 w-3.5" /> Directory</Link>
          </Button>
        }
      />
      <SandboxNote />

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Identity" description="Synthetic profile">
          <div className="flex items-center gap-3">
            <Avatar initials={String(user.initials)} name={String(user.name)} size="lg" />
            <div>
              <p className="text-[14px] font-semibold">{String(user.name)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusPill status={String(user.status)} />
                <Badge variant={String(user.kyc_status) === "verified" ? "success" : "warning"}>{String(user.kyc_status)}</Badge>
                <Badge variant="outline">{String(user.platform_role).replace("_", " ")}</Badge>
              </div>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-border/70">
            <KeyValue label="Email" value={String(user.email)} />
            <KeyValue label="Country" value={String(user.country)} />
            <KeyValue label="User ID" value={<span className="mono text-[10.5px]">{String(user.id)}</span>} />
            <KeyValue label="Created" value={formatDateTime(String(user.created_at))} />
            <KeyValue label="Last login" value={user.last_login_at ? relativeTime(String(user.last_login_at)) : "Never"} />
          </dl>
        </Panel>

        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Accounts" value={accounts.length} icon={<Wallet className="h-4 w-4" />} />
            <Stat label="Compliance cases" value={cases.length} icon={<ShieldCheck className="h-4 w-4" />} />
            <Stat label="Risk events" value={risk.length} icon={<ShieldAlert className="h-4 w-4" />} />
          </section>

          <Panel title="Accounts" description="Derived from ledger postings" bodyClassName="p-0">
            {accounts.length === 0 ? (
              <EmptyState title="No accounts" className="m-5" />
            ) : (
              <div className="divide-y divide-border/70">
                {accounts.map((account) => (
                  <div key={String(account.id)} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold">{String(account.name)}</p>
                      <p className="mono mt-0.5 text-[9.5px] text-subtle">{String(account.id)} · {String(account.currency)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <Money amountMinor={Number(account.ledgerMinor ?? 0)} currency={String(account.currency)} className="text-[12.5px] font-semibold" />
                      {Number(account.heldMinor ?? 0) > 0 ? (
                        <p className="mt-0.5 text-[9.5px] text-warning">
                          {Number(account.heldMinor).toLocaleString()} minor held
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={String(account.status)} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Compliance cases" description="KYC, KYB, AML and disputes">
          {cases.length === 0 ? (
            <EmptyState title="No cases" icon={<ShieldCheck className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {cases.map((item) => (
                <div key={String(item.id)} className="rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{String(item.type).toUpperCase()}</Badge>
                    <StatusPill status={String(item.status)} />
                    <span className="ml-auto text-[9.5px] text-subtle">{relativeTime(String(item.created_at))}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">{String(item.summary)}</p>
                  <Link href="/ops/compliance" className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
                    Open compliance queue <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Risk signals" description="Most recent eight events">
          {risk.length === 0 ? (
            <EmptyState title="No risk events" icon={<ShieldAlert className="h-5 w-5" />} />
          ) : (
            <div className="space-y-2">
              {risk.map((item) => (
                <div key={String(item.id)} className="rounded-[10px] border border-border bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={["critical", "high"].includes(String(item.severity)) ? "danger" : "warning"}>{String(item.severity)}</Badge>
                    <StatusPill status={String(item.status)} />
                    <span className="ml-auto text-[9.5px] text-subtle">{relativeTime(String(item.created_at))}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold">{String(item.title)}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{String(item.detail)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel title="Recent transactions" description="Across all accounts" bodyClassName="p-0">
        {transactions.length === 0 ? (
          <EmptyState title="No transactions" className="m-5" />
        ) : (
          <div className="divide-y divide-border/70">
            {transactions.map((transaction) => (
              <div key={String(transaction.id)} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-semibold">{String(transaction.description)}</p>
                  <p className="mt-0.5 text-[9.5px] text-subtle">
                    {String(transaction.account_name)} · {formatDateTime(String(transaction.occurred_at))}
                  </p>
                </div>
                <div className="text-right">
                  <Money
                    amountMinor={Number(transaction.amount_minor) * (String(transaction.direction) === "credit" ? 1 : -1)}
                    currency={String(transaction.currency)}
                    signed
                    className="text-[11.5px] font-semibold"
                  />
                  <div className="mt-0.5"><StatusPill status={String(transaction.status)} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Audit metadata" description="Raw record snapshot">
        <pre className="mono overflow-x-auto rounded-[9px] bg-surface-2 p-3 text-[10px] leading-relaxed text-muted">
          {JSON.stringify({ user, accounts: accounts.map((account) => ({ id: account.id, currency: account.currency, ledgerMinor: account.ledgerMinor })) }, null, 2)}
        </pre>
        <p className="mt-2 text-[10px] text-subtle">Snapshot generated from the local sandbox database.</p>
      </Panel>

      <Disclosure>This profile is a demonstration record. Platform staff can inspect it but cannot initiate transfers on the customer&apos;s behalf.</Disclosure>
    </div>
  );
}
