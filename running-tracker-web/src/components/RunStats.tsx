'use client'

import { LatLng } from '@/types'

interface RunStatsProps {
  isRunning: boolean
  elapsedTime: number
  route: LatLng[]
}

function calculateDistance(points: LatLng[]): number {
  let distance = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    // Haversine formula to calculate distance between two points
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (prev.lat * Math.PI) / 180
    const φ2 = (curr.lat * Math.PI) / 180
    const Δφ = ((curr.lat - prev.lat) * Math.PI) / 180
    const Δλ = ((curr.lng - prev.lng) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    distance += R * c
  }
  return distance
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

function formatPace(meters: number, milliseconds: number): string {
  if (meters === 0) return '--:--'

  const paceSeconds = milliseconds / 1000 / (meters / 1000) // seconds per km
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.floor(paceSeconds % 60)

  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

export function RunStats({ isRunning, elapsedTime, route }: RunStatsProps) {
  const distance = calculateDistance(route)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Current Run Stats
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold neon-text">
            {formatTime(elapsedTime)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Elapsed Time
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold neon-text">
            {formatDistance(distance)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Distance
          </div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold neon-text">
            {formatPace(distance, elapsedTime)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Average Pace
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {route.length} GPS points recorded
        </div>
      </div>
    </div>
  )
}
