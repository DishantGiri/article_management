"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface WriterPerformanceBarChartProps {
  data: { name: string; completed: number }[];
  layout?: "horizontal" | "vertical";
}

export default function WriterPerformanceBarChart({
  data,
  layout = "horizontal",
}: WriterPerformanceBarChartProps) {
  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)" }}
          />
          <Bar dataKey="completed" fill="#6D8196" radius={[0, 6, 6, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="completed" fill="#6D8196" radius={[4, 4, 0, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
