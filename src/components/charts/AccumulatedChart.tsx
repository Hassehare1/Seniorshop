"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  week: number;
  accumulated: number;
  accForecast?: number; // ackumulerad prognos — kommer läggas till senare
}

interface Props {
  data: DataPoint[];
}

const fmtSEK = (v: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(v);

function formatK(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : value.toString();
}

export default function AccumulatedChart({ data }: Props) {
  const hasForecast = data.some(d => d.accForecast !== undefined && d.accForecast > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="gradAccumulated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          formatter={(value, name) => [
            fmtSEK(Number(value)),
            name === "accForecast" ? "Prognos (ack.)" : "Utfall (ack.)",
          ]}
          labelFormatter={(v) => `Vecka ${v}`}
        />
        {hasForecast && (
          <Legend
            formatter={(value) => (value === "accForecast" ? "Prognos" : "Utfall")}
            wrapperStyle={{ fontSize: 12 }}
          />
        )}
        {/* Prognos bakom utfall */}
        {hasForecast && (
          <Area
            type="monotone"
            dataKey="accForecast"
            name="accForecast"
            stroke="#93c5fd"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="url(#gradForecast)"
            dot={false}
          />
        )}
        {/* Utfall — mörkblå linje med fyll */}
        <Area
          type="monotone"
          dataKey="accumulated"
          name="accumulated"
          stroke="#1d4ed8"
          strokeWidth={2.5}
          fill="url(#gradAccumulated)"
          dot={false}
          activeDot={{ r: 4, fill: "#1d4ed8" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
