'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { RunControls } from '@/components/RunControls'
import { RunStats } from '@/components/RunStats'
import { useTheme } from '@/components/ThemeProvider'
import { RunState, LatLng } from '@/types'
import { saveRun } from '@/lib/storage'

// Dynamically import the map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg flex items-center justify-center">Loading map...</div>
})

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

export default function Home() {
  const { theme } = useTheme()
  const [runState, setRunState] = useState<RunState>({
    isRunning: false,
    currentPosition: null,
    route: [],
    startTime: null,
    elapsedTime: 0,
  })

  const [userLocation, setUserLocation] = useState<LatLng | null>(null)

  // Get user's current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Update elapsed time every second when running
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (runState.isRunning && runState.startTime) {
      interval = setInterval(() => {
        setRunState(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime!.getTime()
        }))
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [runState.isRunning, runState.startTime])

  const handleStartRun = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const currentPos = { lat: latitude, lng: longitude }

          setRunState({
            isRunning: true,
            currentPosition: currentPos,
            route: [currentPos],
            startTime: new Date(),
            elapsedTime: 0,
          })
        },
        (error) => {
          console.error('Error getting location for run start:', error)
          alert('Unable to get your location. Please enable location services.')
        }
      )
    }
  }

  const handleStopRun = () => {
    setRunState(prev => {
      // Calculate final stats
      const finalElapsedTime = Date.now() - prev.startTime!.getTime()
      const distance = calculateDistance(prev.route)
      const averagePace = distance > 0 ? finalElapsedTime / distance * 1000 : 0

      // Save run to localStorage if there's a meaningful run (distance > 50m and time > 30s)
      if (distance > 50 && finalElapsedTime > 30000) {
        saveRun({
          date: prev.startTime!.toISOString(),
          duration: finalElapsedTime,
          distance: distance,
          averagePace: averagePace,
          route: prev.route,
        })
      }

      return {
        ...prev,
        isRunning: false,
      }
    })
  }

  const handlePositionUpdate = (position: LatLng) => {
    if (runState.isRunning) {
      setRunState(prev => ({
        ...prev,
        currentPosition: position,
        route: [...prev.route, position],
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Running Tracker
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your runs with GPS and view your progress
          </p>
        </div>

        {/* Run Controls */}
        <div className="mb-6">
          <RunControls
            isRunning={runState.isRunning}
            onStart={handleStartRun}
            onStop={handleStopRun}
          />
        </div>

        {/* Run Stats */}
        {runState.isRunning && (
          <div className="mb-6">
            <RunStats
              isRunning={runState.isRunning}
              elapsedTime={runState.elapsedTime}
              route={runState.route}
            />
          </div>
        )}

        {/* Map */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="h-96 relative">
            {userLocation ? (
              <Map
                center={userLocation}
                zoom={15}
                runState={runState}
                onPositionUpdate={handlePositionUpdate}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Getting your location...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {!runState.isRunning && !runState.route.length && (
          <div className="mt-6 text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
                How to use
              </h3>
              <p className="text-blue-700 dark:text-blue-200 text-sm">
                Click "Start Run" to begin tracking your route. Make sure location services are enabled in your browser.
                Your path will be displayed on the map in real-time. Click "Stop Run" when finished to save your run data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
