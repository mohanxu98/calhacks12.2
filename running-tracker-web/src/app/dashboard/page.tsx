'use client'

import { useState, useEffect } from 'react'
import { RunData } from '@/types'
import { useTheme } from '@/components/ThemeProvider'
import { exportRunAsGPX, downloadGPX } from '@/lib/gpx'
import { PaceChart } from '@/components/PaceChart'

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(2)}km`
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.floor(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

export default function Dashboard() {
  const { theme } = useTheme()
  const [runs, setRuns] = useState<RunData[]>([])

  useEffect(() => {
    const storedRuns = localStorage.getItem('running-tracker-runs')
    if (storedRuns) {
      try {
        setRuns(JSON.parse(storedRuns))
      } catch (error) {
        console.error('Error parsing stored runs:', error)
      }
    }
  }, [])

  const totalRuns = runs.length
  const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0)
  const totalTime = runs.reduce((sum, run) => sum + run.duration, 0)
  const averagePace = totalDistance > 0 ? totalTime / totalDistance * 1000 : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View your running history and statistics
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card">
            <div className="text-2xl font-bold text-primary-600">
              {totalRuns}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Runs
            </div>
          </div>

          <div className="stat-card">
            <div className="text-2xl font-bold text-primary-600">
              {formatDistance(totalDistance)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Distance
            </div>
          </div>

          <div className="stat-card">
            <div className="text-2xl font-bold text-primary-600">
              {formatTime(totalTime)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Time
            </div>
          </div>

          <div className="stat-card">
            <div className="text-2xl font-bold text-primary-600">
              {formatPace(averagePace)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Avg Pace
            </div>
          </div>
        </div>

        {/* Pace Chart */}
        <div className="mb-8">
          <PaceChart runs={runs} />
        </div>

        {/* Recent Runs */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Runs
          </h2>

          {runs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400">
                No runs recorded yet. Start your first run to see it here!
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {runs
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((run) => (
                  <div
                    key={run.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {formatDate(run.date)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {run.route.length} GPS points
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div>
                            <div className="text-lg font-medium text-primary-600">
                              {formatDistance(run.distance)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Distance
                            </div>
                          </div>

                          <div>
                            <div className="text-lg font-medium text-primary-600">
                              {formatTime(run.duration)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Duration
                            </div>
                          </div>

                          <div>
                            <div className="text-lg font-medium text-primary-600">
                              {formatPace(run.averagePace)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Avg Pace
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        <button
                          onClick={() => {
                            const gpxContent = exportRunAsGPX(run)
                            const filename = `run-${new Date(run.date).toISOString().split('T')[0]}.gpx`
                            downloadGPX(gpxContent, filename)
                          }}
                          className="btn-secondary text-sm px-3 py-1"
                        >
                          Export GPX
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
