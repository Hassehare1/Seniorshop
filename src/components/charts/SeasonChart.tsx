"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { week: number; sales: number; accumulated: number }[];
}

function formatK(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : value.toString();
}

export default function SeasonChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="week"
          tickFormatter={(v) => `v${v}`}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 12, fill: "#94a3b8" }}
        />
        <Tooltip
          formatter={(value, name) => [
            new Intl.NumberFormat("sv-SE", {
              style: "currency",
              currency: "SEK",
              maximumFractionDigits: 0,
            }).format(Number(value)),
            name === "accumulated" ? "Ackumulerat" : "Veckans försäljning",
          ]}
          labelFormatter={(v) => `Vecka ${v}`}
        />
        <Legend
          formatter={(value) =>
            value === "accumulated" ? "Ackumulerat" : "Veckans försäljning"
          }
        />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="accumulated"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
