import { EmptyState } from "@/components/ui/misc";

export function OpsTable({ rows }: { rows: object[] }) {
  if (!rows.length) return <EmptyState title="No records" description="No sandbox records match this view." />;
  const records = rows as Record<string, unknown>[];
  const columns = Object.keys(records[0]);
  return <div className="surface-card overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Sandbox operations records</caption><thead><tr className="border-b border-border">{columns.map(key => <th scope="col" key={key} className="whitespace-nowrap px-4 py-3 font-semibold text-muted">{key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}</th>)}</tr></thead><tbody>{records.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-border last:border-0">{columns.map(key => <td key={key} className="max-w-sm px-4 py-3 align-top"><span className="block max-h-32 overflow-auto break-words">{row[key] == null ? "—" : typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key])}</span></td>)}</tr>)}</tbody></table></div>;
}
