'use client'

import { useState, useEffect, useRef } from 'react'

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
    initMap?: () => void
    google: any
  }
}

// Declare Google Maps types
declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options: MapOptions)
    }
    class DirectionsService {
      route(request: DirectionsRequest): Promise<DirectionsResult>
    }
    class DirectionsRenderer {
      constructor(options: DirectionsRendererOptions)
      setDirections(directions: DirectionsResult): void
      addListener(event: string, handler: () => void): void
      getDirections(): DirectionsResult | null
    }
    class LatLng {
      constructor(lat: number, lng: number)
    }
    enum TravelMode {
      WALKING,
      BICYCLING
    }
    enum MapTypeId {
      ROADMAP
    }
    interface MapOptions {
      center: LatLngLiteral
      zoom: number
      mapTypeId: MapTypeId
    }
    interface LatLngLiteral {
      lat: number
      lng: number
    }
    interface DirectionsRequest {
      origin: LatLng
      destination: LatLng
      travelMode: TravelMode
    }
    interface DirectionsResult {
      routes: Route[]
    }
    interface Route {
      legs: RouteLeg[]
    }
    interface RouteLeg {
      steps: DirectionsStep[]
      distance?: Distance
      duration?: Duration
    }
    interface DirectionsStep {
      instructions: string
      distance?: Distance
      duration?: Duration
    }
    interface Distance {
      text: string
      value: number
    }
    interface Duration {
      text: string
      value: number
    }
    interface DirectionsRendererOptions {
      draggable: boolean
      map: Map
    }
  }
}

export default function RoutePlanner() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const startMarkerRef = useRef<any | null>(null)
  const endMarkerRef = useRef<any | null>(null)
  const selectionModeRef = useRef<'start' | 'end' | null>(null)
  
  const [startCoord, setStartCoord] = useState<Coordinate>({ lat: 37.7749, lng: -122.4194 }) // San Francisco
  const [endCoord, setEndCoord] = useState<Coordinate>({ lat: 37.7849, lng: -122.4094 }) // Nearby point
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState<'start' | 'end' | null>(null)
  const [mode, setMode] = useState<'WALKING' | 'BICYCLING'>('WALKING')
  // Clean up Google HTML instructions and add punctuation where needed
  const sanitizeInstruction = (html: string): string => {
    if (!html) return ''
    let text = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<div[^>]*>/gi, ' ')
      .replace(/<\/div>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
    text = text.replace(/\s+/g, ' ').trim()

    // Ensure common bike/walk phrases are separated
    const punctuateBefore = [
      'Walk your bicycle',
      'Continue to follow',
      'Pass by',
    ]
    punctuateBefore.forEach((phrase) => {
      const re = new RegExp(`(?<![.!?])\s*${phrase}`, 'i')
      // Insert a period + space before the phrase if not already punctuated
      text = text.replace(re, `. ${phrase}`)
    })

    return text
  }


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

        // Add click to set start/end
        ;(map as any).addListener('click', (e: any) => {
          const mode = selectionModeRef.current
          if (!mode || !e || !e.latLng) return
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          if (mode === 'start') {
            setStartCoord({ lat, lng })
          } else if (mode === 'end') {
            setEndCoord({ lat, lng })
          }
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

  // Keep ref in sync for click handler
  useEffect(() => {
    selectionModeRef.current = selectionMode
  }, [selectionMode])

  // Update or create start/end markers when coords change
  useEffect(() => {
    const map = mapInstanceRef.current as any
    if (!map || !(window as any).google) return
    const gmaps = (window as any).google.maps
    if (startMarkerRef.current) {
      startMarkerRef.current.setPosition(new gmaps.LatLng(startCoord.lat, startCoord.lng))
    } else {
      startMarkerRef.current = new gmaps.Marker({
        position: new gmaps.LatLng(startCoord.lat, startCoord.lng),
        map,
        label: 'A'
      })
    }
  }, [startCoord])

  useEffect(() => {
    const map = mapInstanceRef.current as any
    if (!map || !(window as any).google) return
    const gmaps = (window as any).google.maps
    if (endMarkerRef.current) {
      endMarkerRef.current.setPosition(new gmaps.LatLng(endCoord.lat, endCoord.lng))
    } else {
      endMarkerRef.current = new gmaps.Marker({
        position: new gmaps.LatLng(endCoord.lat, endCoord.lng),
        map,
        label: 'B'
      })
    }
  }, [endCoord])

  // Update route information from directions result
  const updateRouteInfo = (directions: google.maps.DirectionsResult) => {
    const route = directions.routes[0]
    const leg = route.legs[0]
    
    const steps: RouteStep[] = leg.steps.map(step => ({
      instruction: sanitizeInstruction(step.instructions || ''),
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
        travelMode: mode === 'WALKING' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.BICYCLING
      })

      console.log('Route found:', result)
      directionsRendererRef.current.setDirections(result)
      updateRouteInfo(result)
    } catch (err: any) {
      console.error('Route finding error:', err)
      console.error('Error details:', {
        status: err?.status,
        message: err?.message,
        code: err?.code,
        details: err?.details
      })
      setError(`Failed to find route: ${err?.message || 'Please check your coordinates and API key.'}`)
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
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            {/* Mode selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mode</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMode('WALKING')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${mode === 'WALKING' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                >
                  Walking
                </button>
                <button
                  onClick={() => setMode('BICYCLING')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${mode === 'BICYCLING' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                >
                  Biking
                </button>
              </div>
            </div>
            {/* Pickers */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Start</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectionMode(prev => prev === 'start' ? null : 'start')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${selectionMode === 'start' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                >
                  {selectionMode === 'start' ? 'Picking… (click map)' : 'Pick on map'}
                </button>
                <button
                  onClick={getCurrentLocation}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                >
                  Use My Location
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">{startCoord.lat.toFixed(5)}, {startCoord.lng.toFixed(5)}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">End</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectionMode(prev => prev === 'end' ? null : 'end')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${selectionMode === 'end' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                >
                  {selectionMode === 'end' ? 'Picking… (click map)' : 'Pick on map'}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">{endCoord.lat.toFixed(5)}, {endCoord.lng.toFixed(5)}</p>
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
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="h-96 relative">
              {/* Overlay chips when route available */}
              {routeInfo && (
                <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
                  <div className="px-2.5 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                    {routeInfo.distance}
                  </div>
                  <div className="px-2.5 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                    {routeInfo.duration}
                  </div>
                </div>
              )}
              <div 
                ref={mapRef} 
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
