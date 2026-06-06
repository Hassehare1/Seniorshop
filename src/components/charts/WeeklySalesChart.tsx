"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface DataPoint {
  week: number;
  sales: number;
  forecast?: number; // kommer läggas till senare
}

interface Props {
  data: DataPoint[];
}

const fmtSEK = (v: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(v);

function formatK(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : value.toString();
}

export default function WeeklySalesChart({ data }: Props) {
  const hasForecast = data.some(d => d.forecast !== undefined && d.forecast > 0);

  // Bygg dataset: utfall-veckor + prognosveckor (inga utfall)
  const chartData: DataPoint[] = data;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={(v) => `v${v}`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          formatter={(value, name) => [
            fmtSEK(Number(value)),
            name === "forecast" ? "Prognos" : "Utfall",
          ]}
          labelFormatter={(v) => `Vecka ${v}`}
        />
        {hasForecast && (
          <Legend
            formatter={(value) => (value === "forecast" ? "Prognos" : "Utfall")}
            wrapperStyle={{ fontSize: 12 }}
          />
        )}
        {/* Utfall — mörkblå */}
        <Bar dataKey="sales" name="sales" fill="#1d4ed8" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.sales > 0 ? "#1d4ed8" : "transparent"}
            />
          ))}
        </Bar>
        {/* Prognos — ljusblå (dold tills data finns) */}
        {hasForecast && (
          <Bar dataKey="forecast" name="forecast" fill="#bfdbfe" radius={[3, 3, 0, 0]} maxBarSize={32} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
