'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { RunControls } from '@/components/RunControls'
import { RunStats } from '@/components/RunStats'
import { useTheme } from '@/components/ThemeProvider'
import ShapeDrawer from '@/components/ShapeDrawer'
import Directions from '@/components/Directions'
import { RunState, LatLng, DrawnShape } from '@/types'
import { getShapeRoute } from '@/lib/googleMapsRouting'
import { saveRun, getShapes, saveShapes, deleteShape as deleteStoredShape } from '@/lib/storage'
import { getBestEffortLocation } from '@/lib/location'
import { loadGoogleMaps } from '@/lib/googleLoader'

// Declare Google Maps types
declare global {
  interface Window {
    google: any
    confetti?: any
  }
}

// Load Google Maps script for the main page
// replaced by loadGoogleMaps utility

// Load confetti script
const loadConfetti = () => {
  if (typeof window === 'undefined') return
  if ((window as any).confetti) return
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
  script.async = true
  script.defer = true
  document.head.appendChild(script)
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
  useTheme()
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
  // Surprise route state
  const [surpriseShape, setSurpriseShape] = useState<DrawnShape | null>(null)
  const [surpriseTargetMeters, setSurpriseTargetMeters] = useState<number>(1600)
  const [surpriseUnit, setSurpriseUnit] = useState<'meters' | 'miles'>('meters')

  // Compact stat formatters
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(2)}km`
  }

  const formatPace = (meters: number, milliseconds: number): string => {
    if (meters === 0) return '--:--/km'
    const paceSeconds = milliseconds / 1000 / (meters / 1000)
    const minutes = Math.floor(paceSeconds / 60)
    const seconds = Math.floor(paceSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
  }

  // Load Google Maps and saved shapes on mount
  useEffect(() => {
    loadGoogleMaps(['geometry'])
    loadConfetti()
    const savedShapes = getShapes()
    setDrawnShapes(savedShapes)
  }, [])

  // Get user's current location on mount with best-effort fallback
  useEffect(() => {
    const doLocate = async () => {
      setIsLoadingLocation(true)
      setLocationError(null)
      const loc = await getBestEffortLocation()
      if (loc) {
        setUserLocation(loc)
      } else {
        setLocationError('Unable to determine your location. You can enter it manually below.')
      }
      setIsLoadingLocation(false)
    }
    doLocate()
  }, [])

  // Retry location function with fallback options
  const retryLocation = () => {
    setLocationError(null)
    setIsLoadingLocation(true)
    getBestEffortLocation().then((loc) => {
      if (loc) {
        setUserLocation(loc)
        setLocationError(null)
      } else {
        setLocationError('Unable to determine your location. You can enter it manually below.')
      }
      setIsLoadingLocation(false)
    })
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

  const handleStartRun = async () => {
    try {
      const loc = await getBestEffortLocation()
      if (!loc) throw new Error('location-unavailable')
      const currentPos = { lat: loc.lat, lng: loc.lng }

      setRunState({
        isRunning: true,
        currentPosition: currentPos,
        route: [currentPos],
        startTime: new Date(),
        elapsedTime: 0,
      })

      // If a surprise route exists, use that; else use most recent drawn shape
      if (surpriseShape) {
        setDirectionsShape(surpriseShape)
      } else if (drawnShapes.length > 0) {
        const latestShape = drawnShapes[drawnShapes.length - 1]
        setDirectionsShape(latestShape)
      }
    } catch (err) {
      console.error('Error getting location for run start:', err)
      alert('Unable to get your location right now. Please enable location services or try again in a few seconds.')
    }
  }

  const handleStopRun = () => {
    setRunState(prev => {
      // Calculate final stats
      const finalElapsedTime = Date.now() - prev.startTime!.getTime()
      const distance = calculateDistance(prev.route)
      // Store pace in seconds per km; finalElapsedTime (ms) / distance (m) yields s/km
      const averagePace = distance > 0 ? finalElapsedTime / distance : 0

      // Always save the run (even short tests), but clamp tiny negatives
      saveRun({
        date: prev.startTime!.toISOString(),
        duration: Math.max(0, finalElapsedTime),
        distance: Math.max(0, distance),
        averagePace,
        route: prev.route,
      })

      const newState = {
        ...prev,
        isRunning: false,
      }
      return newState
    })
    // Confetti celebration
    const celebrate = () => {
      const confetti = (window as any).confetti
      if (!confetti) return
      const end = Date.now() + 800
      const colors = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24']
      const frame = () => {
        confetti({
          particleCount: 40,
          spread: 55,
          startVelocity: 45,
          origin: { x: Math.random() * 0.4 + 0.3, y: 0.1 },
          colors,
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
    celebrate()
    // Reveal surprise shape after run ends
    if (surpriseShape) {
      setDrawnShapes(prev => {
        const updated = [...prev, surpriseShape]
        saveShapes(updated)
        return updated
      })
      setSurpriseShape(null)
    }
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

  // Surprise route: generate random closed shape around user
  const generateSurpriseBaseShape = (center: LatLng, numPoints = 8, radiusMeters = 200): LatLng[] => {
    const pts: LatLng[] = []
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI + (Math.random() * 0.4 - 0.2)
      const r = radiusMeters * (0.7 + Math.random() * 0.6)
      const dLat = (r * Math.sin(angle)) / 111320
      const dLng = (r * Math.cos(angle)) / (111320 * Math.cos(center.lat * Math.PI / 180))
      pts.push({ lat: center.lat + dLat, lng: center.lng + dLng })
    }
    // close the loop
    pts.push(pts[0])
    return pts
  }

  // Scale points around a center
  const scalePoints = (points: LatLng[], center: LatLng, factor: number): LatLng[] => {
    return points.map(p => ({
      lat: center.lat + (p.lat - center.lat) * factor,
      lng: center.lng + (p.lng - center.lng) * factor
    }))
  }

  // Fit a shape's routed length to target meters (binary search, bounded)
  const fitShapeToDistance = async (base: LatLng[], center: LatLng, targetMeters: number): Promise<LatLng[]> => {
    try {
      const baseRes = await getShapeRoute(base)
      const baseDist = Math.max(1, baseRes?.distance || 1)
      let lo = 0.05
      let hi = 10
      let best = { factor: targetMeters / baseDist, pts: base, dist: baseDist }
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        const candidate = scalePoints(base, center, mid)
        const res = await getShapeRoute(candidate)
        const dist = res?.distance || 0
        if (Math.abs(dist - targetMeters) < Math.abs(best.dist - targetMeters)) {
          best = { factor: mid, pts: candidate, dist }
        }
        if (dist < targetMeters) lo = mid; else hi = mid
        if (Math.abs(best.dist - targetMeters) <= Math.max(10, targetMeters * 0.01)) break
      }
      return best.pts
    } catch {
      return base
    }
  }

  const handleGenerateSurprise = async () => {
    if (!userLocation) return
    const requested = surpriseUnit === 'miles' ? surpriseTargetMeters * 1609.344 : surpriseTargetMeters
    // Enforce a practical minimum (routing granularity)
    const targetMeters = Math.max(100, requested)
    const base = generateSurpriseBaseShape(userLocation, 10, 200)
    const fitted = await fitShapeToDistance(base, userLocation, targetMeters)
    const shape: DrawnShape = { id: `surprise-${Date.now()}`, type: 'freehand', points: fitted, color: '#8b5cf6' }
    setSurpriseShape(shape)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Run Controls */}
        <div className="mb-6 flex justify-center">
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

        {/* Shape Drawer + Surprise */}
        {userLocation && (
          <div className="mb-6">
            <div className="flex items-start gap-4 flex-col lg:flex-row">
              <div className="flex-1 min-w-0">
                <ShapeDrawer
                  onShapeComplete={handleShapeComplete}
                  onShapeUpdate={handleShapeUpdate}
                  onShapeDelete={handleShapeDelete}
                  initialShapes={drawnShapes}
                  userLocation={userLocation}
                />
              </div>
              <div className="w-full lg:w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Surprise Route</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">We’ll generate a hidden route for you around your location. You’ll see the shape after you finish the run.</p>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="number"
                    value={surpriseUnit === 'miles' ? (surpriseTargetMeters / 1609.344).toFixed(2) : Math.round(surpriseTargetMeters)}
                    onChange={(e) => setSurpriseTargetMeters(surpriseUnit === 'miles' ? Number(e.target.value) * 1609.344 : Number(e.target.value))}
                    min={surpriseUnit === 'miles' ? 0.1 : 100}
                    max={surpriseUnit === 'miles' ? 100 : 50000}
                    step={surpriseUnit === 'miles' ? 0.01 : 100}
                    className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={surpriseUnit}
                    onChange={(e) => setSurpriseUnit(e.target.value as 'meters' | 'miles')}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="meters">meters</option>
                    <option value="miles">miles</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerateSurprise}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
                >
                  Generate surprise
                </button>
                {surpriseShape && (
                  <div className="mt-3 text-xs text-purple-700 dark:text-purple-300">Surprise route ready. Start your run to reveal it in directions.</div>
                )}
              </div>
            </div>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="h-96 relative">
            {/* Compact stats overlay */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
              <div className="px-2.5 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                {formatTime(runState.elapsedTime)}
              </div>
              <div className="px-2.5 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                {formatDistance(calculateDistance(runState.route))}
              </div>
              <div className="px-2.5 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                {formatPace(calculateDistance(runState.route), runState.elapsedTime)}
              </div>
            </div>
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
      
      </div>
    </div>
  )
}
