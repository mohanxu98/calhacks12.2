'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { RunControls } from '@/components/RunControls'
import { RunStats } from '@/components/RunStats'
import { useTheme } from '@/components/ThemeProvider'
import ShapeDrawer from '@/components/ShapeDrawer'
import Directions from '@/components/Directions'
import { RunState, LatLng, DrawnShape } from '@/types'
import { saveRun, getShapes, saveShapes, deleteShape as deleteStoredShape } from '@/lib/storage'

// Declare Google Maps types
declare global {
  interface Window {
    google: any
  }
}

// Load Google Maps script for the main page
const loadGoogleMaps = () => {
  if (typeof window !== 'undefined' && !window.google) {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }
}

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
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([])
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(true)
  const [directionsShape, setDirectionsShape] = useState<DrawnShape | null>(null)

  // Load Google Maps and saved shapes on mount
  useEffect(() => {
    loadGoogleMaps()
    const savedShapes = getShapes()
    setDrawnShapes(savedShapes)
  }, [])

  // Get user's current location on mount
  useEffect(() => {
    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by this browser')
        setIsLoadingLocation(false)
        return
      }

      setIsLoadingLocation(true)
      setLocationError(null)

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout
        maximumAge: 60000 // 1 minute cache
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
          setLocationError(null)
          setIsLoadingLocation(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          let errorMessage = 'Unable to get your location. '
          let troubleshooting = ''
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location access was denied.'
              troubleshooting = 'Click the location icon in your browser address bar and allow location access, or check your browser settings.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable.'
              troubleshooting = 'Make sure you have a good internet connection and GPS is enabled on your device.'
              break
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.'
              troubleshooting = 'Try refreshing the page or check if you have a VPN/privacy extension blocking location access.'
              break
            default:
              errorMessage += 'An unknown error occurred.'
              troubleshooting = 'Try refreshing the page or using a different browser.'
              break
          }
          
          setLocationError(errorMessage + (troubleshooting ? ` ${troubleshooting}` : ''))
          setIsLoadingLocation(false)
        },
        options
      )
    }

    getLocation()
  }, [])

  // Retry location function with fallback options
  const retryLocation = () => {
    setLocationError(null)
    setIsLoadingLocation(true)
    
    if (navigator.geolocation) {
      // Try high accuracy first
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
          setLocationError(null)
          setIsLoadingLocation(false)
        },
        (error) => {
          console.error('High accuracy failed, trying low accuracy:', error)
          // Fallback to low accuracy
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              setUserLocation({ lat: latitude, lng: longitude })
              setLocationError(null)
              setIsLoadingLocation(false)
            },
            (fallbackError) => {
              console.error('All location methods failed:', fallbackError)
              setLocationError('All location methods failed. Please check your browser settings, disable VPN/privacy extensions, or use manual location input.')
              setIsLoadingLocation(false)
            },
            {
              enableHighAccuracy: false, // Lower accuracy fallback
              timeout: 20000,
              maximumAge: 300000 // 5 minutes cache
            }
          )
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      )
    }
  }

  // Use default location as fallback
  const useDefaultLocation = () => {
    // Default to San Francisco coordinates
    setUserLocation({ lat: 37.7749, lng: -122.4194 })
    setLocationError(null)
    setIsLoadingLocation(false)
  }

  // Manual location input
  const [showManualLocation, setShowManualLocation] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  const useManualLocation = () => {
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    
    if (isNaN(lat) || isNaN(lng)) {
      setLocationError('Please enter valid latitude and longitude values')
      return
    }
    
    if (lat < -90 || lat > 90) {
      setLocationError('Latitude must be between -90 and 90')
      return
    }
    
    if (lng < -180 || lng > 180) {
      setLocationError('Longitude must be between -180 and 180')
      return
    }
    
    setUserLocation({ lat, lng })
    setLocationError(null)
    setIsLoadingLocation(false)
    setShowManualLocation(false)
  }

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

          // Open directions for the most recently drawn shape
          if (drawnShapes.length > 0) {
            const latestShape = drawnShapes[drawnShapes.length - 1]
            setDirectionsShape(latestShape)
          }
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

  const handleShapeComplete = (shape: DrawnShape) => {
    setDrawnShapes(prev => {
      const updatedShapes = [...prev, shape]
      saveShapes(updatedShapes)
      return updatedShapes
    })
  }

  const handleShapeUpdate = (shape: DrawnShape) => {
    setDrawnShapes(prev => {
      const updatedShapes = prev.map(s => s.id === shape.id ? shape : s)
      saveShapes(updatedShapes)
      return updatedShapes
    })
  }

  const handleShapeDelete = (shapeId: string) => {
    setDrawnShapes(prev => {
      const updatedShapes = prev.filter(s => s.id !== shapeId)
      saveShapes(updatedShapes)
      deleteStoredShape(shapeId)
      return updatedShapes
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      <span className="neon-text">Running Tracker</span>
                    </h1>
                    <div className="space-x-2">
                      <Link
                        href="/landing"
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Home
                      </Link>
                      <Link
                        href="/route-planner"
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Route Planner
                      </Link>
                    </div>
                  </div>
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

        {/* Shape Drawer */}
        {userLocation && (
          <div className="mb-6">
            <ShapeDrawer
              onShapeComplete={handleShapeComplete}
              onShapeUpdate={handleShapeUpdate}
              onShapeDelete={handleShapeDelete}
              initialShapes={drawnShapes}
              userLocation={userLocation}
            />
          </div>
        )}

        {/* Location Status */}
        {isLoadingLocation && (
          <div className="mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Getting your location...
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                    Please allow location access in your browser
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {locationError && (
          <div className="mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-900 dark:text-red-100">
                    Location Error
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-200 mt-1">
                    {locationError}
                  </p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={retryLocation}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={useDefaultLocation}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                    >
                      Use Default Location
                    </button>
                    <button
                      onClick={() => setShowManualLocation(!showManualLocation)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Enter Location Manually
                    </button>
                  </div>
                  
                  {showManualLocation && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Enter Your Location
                      </h4>
                      <div className="flex gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Latitude
                          </label>
                          <input
                            type="number"
                            value={manualLat}
                            onChange={(e) => setManualLat(e.target.value)}
                            placeholder="37.7749"
                            step="any"
                            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Longitude
                          </label>
                          <input
                            type="number"
                            value={manualLng}
                            onChange={(e) => setManualLng(e.target.value)}
                            placeholder="-122.4194"
                            step="any"
                            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={useManualLocation}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          Use This Location
                        </button>
                        <button
                          onClick={() => setShowManualLocation(false)}
                          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg neon-glow overflow-hidden">
          <div className="h-96 relative">
            {userLocation ? (
              <Map
                key={`map-${drawnShapes.length}-${drawnShapes.map(s => s.id).join(',')}`}
                center={userLocation}
                zoom={15}
                runState={runState}
                onPositionUpdate={handlePositionUpdate}
                drawnShapes={drawnShapes}
                userLocation={userLocation}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-green mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isLoadingLocation ? 'Getting your location...' : 'Location not available'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Directions Modal - shown when a run starts */}
      {directionsShape && (userLocation || runState.currentPosition) && (
        <Directions
          shape={directionsShape}
          userLocation={(userLocation ?? runState.currentPosition)!}
          currentPosition={runState.currentPosition}
          onClose={() => setDirectionsShape(null)}
        />
      )}

        {/* Instructions */}
        {!runState.isRunning && !runState.route.length && (
          <div className="mt-6 text-center">
            <div className="bg-green-50 dark:bg-green-900/20 border border-neon-green/30 dark:border-neon-green/50 rounded-lg p-4 neon-glow">
              <h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-2">
                How to use
              </h3>
              <div className="text-green-700 dark:text-green-200 text-sm space-y-2">
                <p>
                  <strong>Draw Routes:</strong> Use the shape drawing tool above to create custom running routes. 
                  Choose from polygon, freehand, rectangle, or circle tools.
                </p>
                <p>
                  <strong>Track Runs:</strong> Click "Start Run" to begin tracking your route. Make sure location services are enabled in your browser.
                  Your path will be displayed on the map in real-time. Click "Stop Run" when finished to save your run data.
                </p>
                <p>
                  <strong>Location Issues:</strong> If the app can't get your location, try these solutions:
                </p>
                <ul className="text-sm text-green-700 dark:text-green-200 mt-2 space-y-1 list-disc list-inside">
                  <li>Click the location icon in your browser address bar and allow access</li>
                  <li>Check your browser's location permissions in settings</li>
                  <li>Disable VPN or privacy extensions temporarily</li>
                  <li>Try refreshing the page or using a different browser</li>
                  <li>Use the manual location input as a fallback</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
