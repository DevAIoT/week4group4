"use client"

import { TrendingUp, Clock, Calendar, Users, Activity, Play, Pause } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  ScatterChart,
  Scatter,
  ReferenceLine,
  Cell,
} from "recharts"
import { ChatPanel } from "@/components/chat-panel"


async function loadCsv(path :string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]]));
    return {
      date: row.date,
      time: row.time,
      occupancy: Number(row.occupancy),
    };
  });
}

function parseDateTimeMMDDYY(dateStr: string, timeStr: string) {
  // dateStr like "07/24/05" (MM/DD/YY)
  const [mm, dd, yy] = dateStr.split("/").map(Number)
  const [HH, MM, SS] = timeStr.split(":").map(Number)
  const fullYear = yy < 70 ? 2000 + yy : 1900 + yy
  return new Date(fullYear, mm - 1, dd, HH || 0, MM || 0, SS || 0)
}

function dayLabel(d: Date) {
  // "Jul 25"
  return d.toLocaleString("en-US", { month: "short", day: "2-digit" }).replace(",", "")
}

function dowShort(d: Date) {
  // "Mon"..."Sun"
  return d.toLocaleString("en-US", { weekday: "short" })
}


const buildings = [
  { id: "calit2", name: "CalIt2", description: "California Institute for Telecommunications" },
]

const chartConfig = {
  occupancy: {
    label: "Occupancy",
    color: "hsl(152, 82%, 39%)",
  },
  peak: {
    label: "Peak",
    color: "hsl(152, 82%, 39%)",
  },
  avg: {
    label: "Average",
    color: "hsl(210, 100%, 60%)",
  },
  sample: {
    label: "Sample",
    color: "hsl(152, 82%, 39%)",
  },
  theoretical: {
    label: "Theoretical",
    color: "hsl(210, 100%, 50%)",
  },
  empirical: {
    label: "Empirical CDF",
    color: "hsl(152, 82%, 39%)",
  },
} satisfies ChartConfig

const getHeatmapColor = (value: number) => {
  if (value === 0) return "bg-gray-100"
  if (value < 20) return "bg-emerald-100"
  if (value < 40) return "bg-emerald-300"
  if (value < 60) return "bg-emerald-500"
  return "bg-emerald-700"
}

const getHeatmapTextColor = (value: number) => {
  if (value === 0) return "text-gray-400"
  if (value < 40) return "text-gray-700"
  return "text-white"
}

const get2DHeatmapColor = (count: number) => {
  if (count === 0) return "bg-gray-50"
  if (count === 1) return "bg-emerald-100"
  if (count <= 3) return "bg-emerald-200"
  if (count <= 5) return "bg-emerald-400"
  if (count <= 8) return "bg-emerald-500"
  return "bg-emerald-700"
}

const get2DHeatmapTextColor = (count: number) => {
  if (count <= 3) return "text-gray-600"
  return "text-white"
}

function normalQuantile(p: number) {
  // inverse normal CDF approximation (same constants you had)
  const a1 = -3.969683028665376e+01
  const a2 = 2.209460984245205e+02
  const a3 = -2.759285104469687e+02
  const a4 = 1.383577518672690e+02
  const a5 = -3.066479806614716e+01
  const a6 = 2.506628277459239e+00
  const b1 = -5.447609879822406e+01
  const b2 = 1.615858368580409e+02
  const b3 = -1.556989798598866e+02
  const b4 = 6.680131188771972e+01
  const b5 = -1.328068155288572e+01
  const c1 = -7.784894002430293e-03
  const c2 = -3.223964580411365e-01
  const c3 = -2.400758277161838e+00
  const c4 = -2.549732539343734e+00
  const c5 = 4.374664141464968e+00
  const c6 = 2.938163982698783e+00
  const d1 = 7.784695709041462e-03
  const d2 = 3.224671290700398e-01
  const d3 = 2.445134137142996e+00
  const d4 = 3.754408661907416e+00
  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1)
  } else if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1)
  }
}

function normalCDF(x: number, mu: number, sigma: number) {
  // quick approximation you had; guard sigma
  if (sigma <= 0) return x < mu ? 0 : 1
  const z = (x - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

export default function Dashboard() {
  const [rawData, setRawData] = useState<{ date: string; time: string; occupancy: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const toggleVideo = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsVideoPlaying(true)
    } else {
      videoRef.current.pause()
      setIsVideoPlaying(false)
    }
  }

useEffect(() => {
  let cancelled = false

  async function load() {
    try {
      setIsLoading(true)
      setLoadError(null)
      const data = await loadCsv("/datasets/CalIt2_net_occupancy.csv")
      if (!cancelled) setRawData(data)
    } catch (e: any) {
      if (!cancelled) setLoadError(e?.message ?? "Failed to load CSV")
    } finally {
      if (!cancelled) setIsLoading(false)
    }
  }

  load()
  return () => {
    cancelled = true
  }
}, [])

    const dailyData = useMemo(() => {
    const map = new Map<string, number[]>() // key = YYYY-MM-DD

    for (const r of rawData) {
      const dt = parseDateTimeMMDDYY(r.date, r.time)
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r.occupancy)
    }

    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, vals]) => {
        const [y, m, d] = key.split("-").map(Number)
        const dt = new Date(y, m - 1, d)
        const peak = Math.max(...vals)
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length
        return { day: dayLabel(dt), peak, avg: Math.round(avg) }
      })
  }, [rawData])

  const hourlyData = useMemo(() => {
    // average occupancy by hour across all days
    const sums = Array(24).fill(0)
    const counts = Array(24).fill(0)

    for (const r of rawData) {
      const dt = parseDateTimeMMDDYY(r.date, r.time)
      const h = dt.getHours()
      sums[h] += r.occupancy
      counts[h] += 1
    }

    // keep the hours you want displayed (your UI uses 06:00..22:00)
    const start = 6, end = 22
    const out = []
    for (let h = start; h <= end; h++) {
      const avg = counts[h] ? sums[h] / counts[h] : 0
      out.push({ hour: `${String(h).padStart(2, "0")}:00`, occupancy: Math.round(avg) })
    }
    return out
  }, [rawData])

    const qqData = useMemo(() => {
    const xs = rawData.map(d => d.occupancy).sort((a, b) => a - b)
    const n = xs.length
    if (!n) return []

    const mean = xs.reduce((s, v) => s + v, 0) / n
    const varPop = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const std = Math.sqrt(varPop) || 1e-9

    return xs.map((sample, i) => {
      const p = (i + 0.5) / n
      const theoretical = normalQuantile(p) * std + mean
      return {
        theoretical: Math.round(theoretical * 10) / 10,
        sample,
      }
    })
  }, [rawData])

    const stats = useMemo(() => {
    if (!rawData.length) return { peak: 0, avg: 0, peakHour: "—", activeDays: 0 }

    const peak = Math.max(...rawData.map(r => r.occupancy))
    const avg = rawData.reduce((s, r) => s + r.occupancy, 0) / rawData.length

    const daySet = new Set<string>()
    const sums = Array(24).fill(0), counts = Array(24).fill(0)

    for (const r of rawData) {
      const dt = parseDateTimeMMDDYY(r.date, r.time)
      daySet.add(`${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`)
      const h = dt.getHours()
      sums[h] += r.occupancy
      counts[h] += 1
    }

    let bestH = 0, bestAvg = -1
    for (let h = 0; h < 24; h++) {
      const a = counts[h] ? sums[h] / counts[h] : 0
      if (a > bestAvg) { bestAvg = a; bestH = h }
    }

    return {
      peak,
      avg: Math.round(avg),
      peakHour: `${String(bestH).padStart(2, "0")}:00`,
      activeDays: daySet.size,
    }
  }, [rawData])

  const ecdfData = useMemo(() => {
    const xs = rawData.map(d => d.occupancy).sort((a, b) => a - b)
    const n = xs.length
    if (!n) return []

    const mean = xs.reduce((s, v) => s + v, 0) / n
    const varPop = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const std = Math.sqrt(varPop) || 1e-9

    // ECDF at unique values in O(n)
    const out: { occupancy: number; empirical: number; theoretical: number }[] = []
    let i = 0
    while (i < n) {
      const val = xs[i]
      let j = i
      while (j < n && xs[j] === val) j++
      const empirical = j / n
      out.push({
        occupancy: val,
        empirical: Math.round(empirical * 100) / 100,
        theoretical: Math.round(normalCDF(val, mean, std) * 100) / 100,
      })
      i = j
    }
    return out
  }, [rawData])

  const heatmap2DData = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8..19
    const occupancyBuckets = [
      { min: 0, max: 10, label: "0-10" },
      { min: 11, max: 20, label: "11-20" },
      { min: 21, max: 30, label: "21-30" },
      { min: 31, max: 40, label: "31-40" },
      { min: 41, max: 50, label: "41-50" },
      { min: 51, max: 60, label: "51-60" },
      { min: 61, max: 70, label: "61-70" },
      { min: 71, max: 1e9, label: "71+" },
    ]

    const out: { hour: number; bucket: string; count: number }[] = []
    for (const hour of hours) {
      for (const b of occupancyBuckets) {
        let count = 0
        for (const r of rawData) {
          const h = parseInt(r.time.split(":")[0] || "0", 10)
          if (h === hour && r.occupancy >= b.min && r.occupancy <= b.max) count++
        }
        out.push({ hour, bucket: b.label, count })
      }
    }

    return { data: out, hours, buckets: occupancyBuckets.map(b => b.label) }
  }, [rawData])

  const heatmapData = useMemo(() => {
    // avg occupancy by day-of-week and hour (9..17 like your grid)
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const hours = [9,10,11,12,13,14,15,16,17]

    // key = `${day}-${hour}`
    const sums = new Map<string, number>()
    const counts = new Map<string, number>()

    for (const r of rawData) {
      const dt = parseDateTimeMMDDYY(r.date, r.time)
      const day = dowShort(dt) // "Mon".."Sun"
      const hour = dt.getHours()
      if (!days.includes(day) || !hours.includes(hour)) continue

      const key = `${day}-${hour}`
      sums.set(key, (sums.get(key) ?? 0) + r.occupancy)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const out: { day: string; hour: number; value: number }[] = []
    for (const day of days) {
      for (const hour of hours) {
        const key = `${day}-${hour}`
        const avg = (counts.get(key) ?? 0) ? (sums.get(key)! / counts.get(key)!) : 0
        out.push({ day, hour, value: Math.round(avg) })
      }
    }
    return out
  }, [rawData])

    const timeSeriesData = useMemo(() => {
    return rawData.map((d, i) => ({
      index: i,
      label: `${d.date} ${d.time.slice(0, 5)}`,
      occupancy: d.occupancy,
    }))
  }, [rawData])

  return (
    <div className="min-h-screen bg-[#c5c3d1] p-1 sm:p-3 md:p-4 lg:p-6 font-sans">
      <div className="mx-auto max-w-[1800px] rounded-xl sm:rounded-2xl lg:rounded-3xl bg-[#f5f4f0] p-3 sm:p-4 lg:p-6 shadow-2xl">
        {/* Header */}
        <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-black">Building Occupancy Analytics</h1>
          <div className="flex items-center gap-3">
            <Select defaultValue="calit2">
              <SelectTrigger className="w-[200px] sm:w-[280px] bg-white">
                <SelectValue placeholder="Select building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    <span className="font-medium">{building.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs hidden sm:inline">
                      - {building.description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card className="bg-white border-0 shadow-sm py-4">
            <CardContent className="p-0 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Peak Occupancy</p>
                  <p className="text-2xl font-bold text-black">{stats.peak}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm py-4">
            <CardContent className="p-0 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg Occupancy</p>
                  <p className="text-2xl font-bold text-black">{stats.avg}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm py-4">
            <CardContent className="p-0 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Peak Hour</p>
                  <p className="text-2xl font-bold text-black">{stats.peakHour}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm py-4">
            <CardContent className="p-0 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
                  <Calendar className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active Days</p>
                  <p className="text-2xl font-bold text-black">{stats.activeDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Time Series Chart */}
          <Card className="lg:col-span-8 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Occupancy Over Time</CardTitle>
              <CardDescription>Half-hourly occupancy readings</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 82%, 39%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(152, 82%, 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis
                  dataKey="index"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"          // Recharts decides spacing
                  minTickGap={30}                      // increase if still cluttered
                  tick={{ fontSize: 10 }}
                  tickMargin={1}
                  tickFormatter={(value) => {
                    const item = timeSeriesData[value]
                    if (!item) return ""
                    const [date] = item.label.split(" ")     // "07/24/05"
                    const [mm, dd] = date.split("/")
                    return `${mm}/${dd}`                     // short
                  }}
                  angle={-35}
                  textAnchor="end"
                />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value, payload) => {
                          if (payload && payload[0]) {
                            return payload[0].payload.label
                          }
                          return value
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="occupancy"
                    stroke="hsl(152, 82%, 39%)"
                    strokeWidth={2}
                    fill="url(#occupancyGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card className="lg:col-span-4 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Hourly Distribution</CardTitle>
              <CardDescription>Average occupancy by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} interval={2} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-sm text-xs">
                            <p className="font-medium">{payload[0].payload.hour}</p>
                            <p className="text-muted-foreground">Occupancy: {payload[0].value}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="occupancy" fill="hsl(152, 82%, 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          {/* 2D Heatmap - Time of Day vs Occupancy */}
          <Card className="lg:col-span-4 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Time-Occupancy Distribution</CardTitle>
              <CardDescription>2D heatmap showing time-conditioned shifts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[300px]">
                  {/* Hour labels */}
                  <div className="flex mb-1">
                    <div className="w-14 shrink-0" />
                    {heatmap2DData.hours.map((hour) => (
                      <div key={hour} className="flex-1 text-center text-[9px] text-gray-500">
                        {hour}:00
                      </div>
                    ))}
                  </div>
                  {/* Heatmap grid */}
                  {heatmap2DData.buckets.map((bucket) => (
                    <div key={bucket} className="flex mb-0.5">
                      <div className="w-14 shrink-0 text-[10px] font-medium text-gray-600 flex items-center pr-1">
                        {bucket}
                      </div>
                      {heatmap2DData.hours.map((hour) => {
                        const cell = heatmap2DData.data.find((d) => d.hour === hour && d.bucket === bucket)
                        const count = cell?.count || 0
                        return (
                          <div
                            key={`${bucket}-${hour}`}
                            className={`flex-1 aspect-square rounded-sm mx-0.5 flex items-center justify-center text-[8px] font-medium ${get2DHeatmapColor(count)} ${get2DHeatmapTextColor(count)}`}
                            title={`${hour}:00, ${bucket} occupants - ${count} observations`}
                          >
                            {count > 0 ? count : ""}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <span className="text-[10px] text-gray-500">Fewer</span>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-200" />
                      <div className="w-3 h-3 rounded-sm bg-emerald-100" />
                      <div className="w-3 h-3 rounded-sm bg-emerald-300" />
                      <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                      <div className="w-3 h-3 rounded-sm bg-emerald-700" />
                    </div>
                    <span className="text-[10px] text-gray-500">More</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Peak Analysis */}
          <Card className="lg:col-span-6 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Daily Peak Analysis</CardTitle>
              <CardDescription>Peak and average occupancy per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-sm text-xs">
                            <p className="font-medium mb-1">{payload[0].payload.day}</p>
                            <p className="text-emerald-600">Peak: {payload[0].payload.peak}</p>
                            <p className="text-blue-600">Average: {payload[0].payload.avg}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="peak" fill="hsl(152, 82%, 39%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avg" fill="hsl(210, 100%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Weekly Heatmap */}
          <Card className="lg:col-span-6 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Weekly Occupancy Heatmap</CardTitle>
              <CardDescription>Occupancy patterns by day of week and hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* Hour labels */}
                  <div className="flex mb-1">
                    <div className="w-12 shrink-0" />
                    {[9, 10, 11, 12, 13, 14, 15, 16, 17].map((hour) => (
                      <div key={hour} className="flex-1 text-center text-[10px] text-gray-500">
                        {hour}:00
                      </div>
                    ))}
                  </div>
                  {/* Heatmap grid */}
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="flex mb-1">
                      <div className="w-12 shrink-0 text-xs font-medium text-gray-600 flex items-center">
                        {day}
                      </div>
                      {[9, 10, 11, 12, 13, 14, 15, 16, 17].map((hour) => {
                        const cell = heatmapData.find((d) => d.day === day && d.hour === hour)
                        const value = cell?.value || 0
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className={`flex-1 aspect-square rounded-sm mx-0.5 flex items-center justify-center text-[9px] font-medium ${getHeatmapColor(value)} ${getHeatmapTextColor(value)}`}
                            title={`${day} ${hour}:00 - ${value} occupants`}
                          >
                            {value > 0 ? value : ""}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <span className="text-[10px] text-gray-500">Low</span>
                    <div className="flex gap-0.5">
                      <div className="w-4 h-4 rounded-sm bg-gray-100" />
                      <div className="w-4 h-4 rounded-sm bg-emerald-100" />
                      <div className="w-4 h-4 rounded-sm bg-emerald-300" />
                      <div className="w-4 h-4 rounded-sm bg-emerald-500" />
                      <div className="w-4 h-4 rounded-sm bg-emerald-700" />
                    </div>
                    <span className="text-[10px] text-gray-500">High</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video and Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mt-4">
          {/* Video Player */}
          <Card className="lg:col-span-2 bg-white border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Heatmap Visualisation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  poster="/video-placeholder.jpg"
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                >
                  <source src="/buildings-heatmap.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Video overlay when not playing */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-600/90 flex items-center justify-center mx-auto mb-3 hover:bg-emerald-600 transition-colors cursor-pointer" onClick={toggleVideo}>
                        <Play className="h-8 w-8 text-white ml-1" />
                      </div>
                      <p className="text-white text-sm font-medium">Play Animation</p>
                      <p className="text-gray-300 text-xs mt-1">Heatmap of all buildings over time</p>
                    </div>
                  </div>
                )}

                {/* Controls overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={toggleVideo}
                      className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    >
                      {isVideoPlaying ? (
                        <Pause className="h-5 w-5 text-white" />
                      ) : (
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="h-1 bg-white/30 rounded-full">
                        <div className="h-full w-0 bg-emerald-500 rounded-full" />
                      </div>
                    </div>
                    <span className="text-white text-xs">0:00 / 2:30</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chat Panel */}
      <ChatPanel buildingData={{ building: 'CalIt2', records: rawData.length }} />
    </div>
  )
}
