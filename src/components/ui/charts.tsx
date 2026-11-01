"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/domain/money";

const AXIS = { fontSize: 10, fill: "var(--subtle)" };
const GRID = "var(--chart-grid)";

export function CashflowChart({
  data,
  currency,
  height = 240,
}: {
  data: Array<{ label: string; incomeMinor: number; expenseMinor: number }>;
  currency: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 11,
              boxShadow: "var(--shadow-float)",
              color: "var(--foreground)",
            }}
            formatter={(value, name) => [
              formatMoney(Number(value ?? 0), currency),
              String(name) === "incomeMinor" ? "Income" : "Spending",
            ]}
          />
          <Area
            type="monotone"
            dataKey="incomeMinor"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#income-fill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Area
            type="monotone"
            dataKey="expenseMinor"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#expense-fill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendDonut({
  data,
  currency,
  height = 200,
}: {
  data: Array<{ category: string; amountMinor: number; share: number }>;
  currency: string;
  height?: number;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amountMinor"
            nameKey="category"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 11,
              color: "var(--foreground)",
            }}
            formatter={(value, name) => [formatMoney(Number(value ?? 0), currency), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniBars({
  data,
  currency,
  height = 150,
  tone = "var(--chart-2)",
}: {
  data: Array<{ label: string; value: number }>;
  currency: string;
  height?: number;
  tone?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={4} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 11,
              color: "var(--foreground)",
            }}
            formatter={(value) => formatMoney(Number(value ?? 0), currency)}
          />
          <Bar dataKey="value" fill={tone} radius={[5, 5, 2, 2]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, tone = "var(--chart-2)" }: { data: number[]; tone?: string }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="value" stroke={tone} strokeWidth={1.5} fill={tone} fillOpacity={0.1} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
