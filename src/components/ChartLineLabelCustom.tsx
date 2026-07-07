"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export function ChartLineLabelCustom({ data, title = "Monthly Articles Trend", description = "Last 6 Months" }: { data: any[], title?: string, description?: string }) {
  
  // Format data for Recharts, optionally calculating trends
  const formattedData = data.map((d, i) => ({
    ...d,
    fill: `var(--chart-${(i % 5) + 1})`
  }))

  const chartConfig = {
    articles: {
      label: "Articles",
      color: "#10b981", // Emerald green to match the previous design
    },
  } satisfies ChartConfig

  return (
    <Card className="flex flex-col border-slate-200 shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-slate-800">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-2">
        <ChartContainer config={chartConfig} className="w-full h-full min-h-[250px]">
          <LineChart
            accessibilityLayer
            data={formattedData}
            margin={{
              top: 24,
              left: 12,
              right: 12,
              bottom: 12
            }}
          >
            <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#94a3b8' }} 
              dy={10} 
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  nameKey="articles"
                  hideLabel
                />
              }
            />
            <Line
              dataKey="articles"
              type="natural"
              stroke="var(--color-articles)"
              strokeWidth={3}
              dot={{
                fill: "var(--color-articles)",
                strokeWidth: 2,
                r: 4
              }}
              activeDot={{
                r: 6,
                stroke: "#fff",
                strokeWidth: 2
              }}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground font-bold"
                fontSize={12}
                dataKey="articles"
              />
            </Line>
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
