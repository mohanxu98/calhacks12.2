'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RunData } from '@/types'

interface PaceChartProps {
  runs: RunData[]
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.floor(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)}km`
}

export function PaceChart({ runs }: PaceChartProps) {
  // Prepare data for the chart - sort by date and show pace vs distance
  const chartData = runs
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((run, index) => ({
      run: index + 1,
      date: new Date(run.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pace: run.averagePace / 60, // Convert to minutes per km
      distance: run.distance / 1000, // Convert to km
      paceFormatted: formatPace(run.averagePace),
      distanceFormatted: formatDistance(run.distance),
    }))

  if (runs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Pace Progress
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No runs to display. Complete some runs to see your pace progress over time!
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Pace Progress
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
            <XAxis
              dataKey="date"
              className="text-gray-600 dark:text-gray-400"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              className="text-gray-600 dark:text-gray-400"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${Math.floor(value)}:${Math.floor((value % 1) * 60).toString().padStart(2, '0')}`}
              label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'rgb(243 244 246)',
              }}
              formatter={(value: number, name: string) => [
                name === 'pace' ? formatPace(value * 60) : formatDistance(value * 1000),
                name === 'pace' ? 'Average Pace' : 'Distance'
              ]}
              labelFormatter={(label) => `Run ${label}`}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>Track your pace improvement over time. Lower values indicate faster running.</p>
      </div>
    </div>
  )
}
