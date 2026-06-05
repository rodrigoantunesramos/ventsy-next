// components/Chart.tsx
import { groupByDay } from '@/lib/group-by-day'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

const data = Array.from({ length: 30 }).map((_, i) => ({
  day: i + 1,
  views: Math.floor(Math.random() * 200),
  clicks: Math.floor(Math.random() * 100),
}))

export function Chart() {
  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="views" stroke="#000" fill="#000" fillOpacity={0.1} />
          <Line type="monotone" dataKey="clicks" stroke="#8884d8" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const chartData = groupByDay(data)