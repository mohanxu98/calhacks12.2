'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Coordinate {
  lat: number
  lng: number
}

interface RouteStep {
  instruction: string
  distance: string
  duration: string
}

interface RouteInfo {
  distance: string
  duration: string
  steps: RouteStep[]
}

// Declare global callback for Google Maps
declare global {
  interface Window {
    initMap: () => void
  }
}

export default function RoutePlanner() {
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  
  const [startCoord, setStartCoord] = useState<Coordinate>({ lat: 37.7749, lng: -122.4194 }) // San Francisco
  const [endCoord, setEndCoord] = useState<Coordinate>({ lat: 37.7849, lng: -122.4094 }) // Nearby point
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize Google Maps
  useEffect(() => {
    let isInitialized = false
    
    const initializeMap = () => {
      console.log('Initializing Google Maps...')
      if (!mapRef.current || mapInstanceRef.current || isInitialized) {
        console.log('Map already initialized or refs not ready')
        return
      }

      // Wait for Google Maps to be fully loaded
      if (!window.google || !window.google.maps || !window.google.maps.Map) {
        console.log('Google Maps not fully loaded, retrying...')
        setTimeout(initializeMap, 100)
        return
      }

      try {
        isInitialized = true
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 },
          zoom: 13,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        })

        mapInstanceRef.current = map
        directionsServiceRef.current = new google.maps.DirectionsService()
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          draggable: true,
          map: map
        })

        // Add event listener for when route is changed by dragging
        directionsRendererRef.current.addListener('directions_changed', () => {
          const directions = directionsRendererRef.current?.getDirections()
          if (directions) {
            updateRouteInfo(directions)
          }
        })

        console.log('Google Maps initialized successfully')
      } catch (error) {
        console.error('Error initializing Google Maps:', error)
        setError('Failed to initialize Google Maps. Please check your API key.')
        isInitialized = false
      }
    }

    // Load Google Maps script if not already loaded
    if (!window.google) {
      console.log('Loading Google Maps script...')
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      console.log('API Key available:', !!apiKey)
      
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
      script.async = true
      script.defer = true
      
      script.onload = () => {
        console.log('Google Maps script loaded')
        // Wait a bit more for all libraries to be ready
        setTimeout(() => {
          if (!isInitialized) {
            initializeMap()
          }
        }, 500)
      }
      
      script.onerror = (error) => {
        console.error('Error loading Google Maps script:', error)
        setError('Failed to load Google Maps. Please check your API key and internet connection.')
      }
      document.head.appendChild(script)
    } else {
      console.log('Google Maps already loaded')
      initializeMap()
    }

    // Cleanup function
    return () => {
      isInitialized = true // Prevent further initialization attempts
      if (window.initMap) {
        delete window.initMap
      }
    }
  }, [])

  // Update route information from directions result
  const updateRouteInfo = (directions: google.maps.DirectionsResult) => {
    const route = directions.routes[0]
    const leg = route.legs[0]
    
    const steps: RouteStep[] = leg.steps.map(step => ({
      instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance?.text || '',
      duration: step.duration?.text || ''
    }))

    setRouteInfo({
      distance: leg.distance?.text || '',
      duration: leg.duration?.text || '',
      steps
    })
  }

  // Find route between coordinates
  const findRoute = async () => {
    console.log('Finding route between:', startCoord, 'and', endCoord)
    
    if (!directionsServiceRef.current || !directionsRendererRef.current) {
      console.error('Directions service not initialized')
      setError('Map not ready. Please wait for the map to load.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('Requesting route from Google Maps...')
      const result = await directionsServiceRef.current.route({
        origin: new google.maps.LatLng(startCoord.lat, startCoord.lng),
        destination: new google.maps.LatLng(endCoord.lat, endCoord.lng),
        travelMode: google.maps.TravelMode.WALKING
      })

      console.log('Route found:', result)
      directionsRendererRef.current.setDirections(result)
      updateRouteInfo(result)
    } catch (err) {
      console.error('Route finding error:', err)
      console.error('Error details:', {
        status: err.status,
        message: err.message,
        code: err.code,
        details: err.details
      })
      setError(`Failed to find route: ${err.message || 'Please check your coordinates and API key.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle coordinate input changes
  const handleStartCoordChange = (field: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setStartCoord(prev => ({ ...prev, [field]: numValue }))
    }
  }

  const handleEndCoordChange = (field: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue)) {
      setEndCoord(prev => ({ ...prev, [field]: numValue }))
    }
  }

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStartCoord({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error('Error getting location:', error)
          setError('Could not get your current location')
        }
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back
            </button>
            <div className="space-x-2">
              <a
                href="/landing"
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Home
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                App
              </a>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Route Planner
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter coordinates to find the walking route between two points
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            {/* Start Coordinates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Start Point
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={startCoord.lat}
                    onChange={(e) => handleStartCoordChange('lat', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="37.7749"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={startCoord.lng}
                    onChange={(e) => handleStartCoordChange('lng', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="-122.4194"
                  />
                </div>
              </div>
              <button
                onClick={getCurrentLocation}
                className="mt-3 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Use My Location
              </button>
            </div>

            {/* End Coordinates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                End Point
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={endCoord.lat}
                    onChange={(e) => handleEndCoordChange('lat', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="37.7849"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={endCoord.lng}
                    onChange={(e) => handleEndCoordChange('lng', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="-122.4094"
                  />
                </div>
              </div>
            </div>

            {/* Find Route Button */}
          <button
            onClick={findRoute}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Finding Route...' : 'Find Route'}
          </button>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
                {error}
              </div>
            )}

            {/* Route Information */}
            {routeInfo && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Route Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Distance:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{routeInfo.distance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{routeInfo.duration}</span>
                  </div>
                </div>
                
                {routeInfo.steps.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                      Turn-by-Turn Directions
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {routeInfo.steps.map((step, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white">{step.instruction}</p>
                            <div className="flex space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>{step.distance}</span>
                              <span>{step.duration}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Route Map
            </h3>
            <div 
              ref={mapRef} 
              className="w-full h-96 rounded-lg border border-gray-300 dark:border-gray-600"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              The route will appear on the map after clicking "Find Route"
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
