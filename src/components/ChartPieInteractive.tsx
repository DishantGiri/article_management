"use client"

import * as React from "react"
import { Label, Pie, PieChart, Sector } from "recharts"
import type { PieSectorDataItem, PieSectorShapeProps } from "recharts/types/polar/Pie"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ChartPieInteractive({ data, title = "Status Distribution", description = "Current Article Statuses" }: { data: any[], title?: string, description?: string }) {
  const id = "pie-interactive"
  
  // Create formatted data for Recharts, handling shadcn's 'fill' expectation
  const formattedData = React.useMemo(() => {
    return data.map((item, i) => ({
      ...item,
      status: item.name,
      fill: item.color || `var(--chart-${(i % 5) + 1})`,
    }))
  }, [data])

  const [activeStatus, setActiveStatus] = React.useState(formattedData[0]?.status || "")

  // Re-sync active status if data changes
  React.useEffect(() => {
    if (formattedData.length > 0 && !formattedData.find(d => d.status === activeStatus)) {
      setActiveStatus(formattedData[0].status)
    }
  }, [formattedData, activeStatus])

  const activeIndex = React.useMemo(
    () => formattedData.findIndex((item) => item.status === activeStatus),
    [activeStatus, formattedData]
  )
  const statuses = React.useMemo(() => formattedData.map((item) => item.status), [formattedData])

  // Dynamically generate chartConfig based on data
  const chartConfig = React.useMemo(() => {
    const config: Record<string, any> = {
      value: { label: "Articles" }
    }
    formattedData.forEach((item, i) => {
      config[item.status] = {
        label: item.status,
        color: item.color || `var(--chart-${(i % 5) + 1})`
      }
    })
    return config satisfies ChartConfig
  }, [formattedData])

  const renderPieShape = React.useCallback(
    ({ index, outerRadius = 0, ...props }: PieSectorShapeProps) => {
      if (index === activeIndex) {
        return (
          <g>
            <Sector {...props} outerRadius={outerRadius + 10} />
            <Sector
              {...props}
              outerRadius={outerRadius + 25}
              innerRadius={outerRadius + 12}
            />
          </g>
        )
      }

      return <Sector {...props} outerRadius={outerRadius} />
    },
    [activeIndex]
  )

  if (!formattedData.length) {
    return (
      <Card className="flex flex-col border-slate-200/60 shadow-sm h-full">
        <CardHeader className="flex-row items-start space-y-0 pb-0">
          <div className="grid gap-1">
            <CardTitle className="text-sm font-bold text-slate-800">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center pb-6">
          <p className="text-sm text-slate-400 font-medium">No data available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-chart={id} className="flex flex-col border-slate-200/60 shadow-sm h-full">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="flex-row items-start space-y-0 pb-0">
        <div className="grid gap-1">
          <CardTitle className="text-sm font-bold text-slate-800">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Select value={activeStatus} onValueChange={setActiveStatus}>
          <SelectTrigger
            className="ml-auto h-7 w-[140px] rounded-lg pl-2.5 text-xs font-semibold"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {statuses.map((key) => {
              const config = chartConfig[key]
              if (!config) return null

              return (
                <SelectItem
                  key={key}
                  value={key}
                  className="rounded-lg [&_span]:flex cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: config.color }}
                    />
                    {config?.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-1 justify-center pb-0">
        <ChartContainer
          id={id}
          config={chartConfig}
          className="mx-auto aspect-square w-full max-w-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={formattedData}
              dataKey="value"
              nameKey="status"
              innerRadius={60}
              strokeWidth={5}
              shape={renderPieShape}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {formattedData[activeIndex]?.value.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground text-xs font-medium"
                        >
                          Articles
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
