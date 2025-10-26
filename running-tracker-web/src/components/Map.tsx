'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RunState, LatLng, DrawnShape } from '@/types'
import { getShapeRoute, smoothShapePoints } from '@/lib/googleMapsRouting'

// Declare Google Maps types
declare global {
  interface Window {
    google: any
  }
}

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface MapProps {
  center: LatLng
  zoom: number
  runState: RunState
  onPositionUpdate: (position: LatLng) => void
  drawnShapes?: DrawnShape[]
  userLocation: LatLng
}

export default function Map({ center, zoom, runState, onPositionUpdate, drawnShapes = [], userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const shapeLayersRef = useRef<L.LayerGroup | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView([center.lat, center.lng], zoom)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Create layer group for shapes
    shapeLayersRef.current = L.layerGroup().addTo(map)

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [center.lat, center.lng, zoom])

  // Update map center when center prop changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom)
    }
  }, [center.lat, center.lng, zoom])

  // Handle GPS tracking when running
  useEffect(() => {
    if (runState.isRunning && navigator.geolocation) {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const newPosition = { lat: latitude, lng: longitude }

          // Update current position
          onPositionUpdate(newPosition)

          // Update map
          if (mapInstanceRef.current) {
            // Update or create position marker
            if (positionMarkerRef.current) {
              positionMarkerRef.current.setLatLng([latitude, longitude])
            } else {
              const customIcon = L.divIcon({
                className: 'custom-position-marker',
                html: `<div style="background-color: #39FF14; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(57,255,20,0.5);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })

              positionMarkerRef.current = L.marker([latitude, longitude], { icon: customIcon })
                .addTo(mapInstanceRef.current)
            }

            // Center map on current position
            mapInstanceRef.current.setView([latitude, longitude], zoom)

            // Update route line
            if (runState.route.length > 1) {
              if (routeLineRef.current) {
                routeLineRef.current.setLatLngs(runState.route.map(point => [point.lat, point.lng]))
              } else {
                routeLineRef.current = L.polyline(
                  runState.route.map(point => [point.lat, point.lng]),
                  {
                    color: '#39FF14',
                    weight: 4,
                    opacity: 0.8,
                    smoothFactor: 1,
                  }
                ).addTo(mapInstanceRef.current)
              }
            }
          }
        },
        (error) => {
          console.error('Error watching position:', error)
        },
        options
      )
    } else if (watchIdRef.current !== null) {
      // Stop watching position when not running
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [runState.isRunning, runState.route, onPositionUpdate, zoom])

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (point1: LatLng, point2: LatLng): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180
    const φ2 = (point2.lat * Math.PI) / 180
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Calculate total distance of a shape
  const calculateShapeDistance = (shape: DrawnShape): number => {
    if (shape.points.length < 2) return 0
    
    let totalDistance = 0
    for (let i = 1; i < shape.points.length; i++) {
      totalDistance += calculateDistance(shape.points[i - 1], shape.points[i])
    }
    
    // For polygons, add distance from last point back to first
    if (shape.type === 'polygon' && shape.points.length > 2) {
      totalDistance += calculateDistance(shape.points[shape.points.length - 1], shape.points[0])
    }
    
    return totalDistance
  }

  // Get Google Maps route polylines for a shape as one continuous route
  const getGoogleMapsRoutePolylines = async (shape: DrawnShape): Promise<LatLng[][]> => {
    if (!window.google || !window.google.maps) {
      console.log('Google Maps not available, using straight lines')
      return [shape.points]
    }

    try {
      const smoothedPoints = smoothShapePoints(shape.points, 20) // Reduced minimum distance to keep more waypoints
      console.log(`Original points: ${shape.points.length}, Smoothed points: ${smootedPoints.length}`)
      if (smootedPoints.length < 2) return [shape.points]

      const directionsService = new window.google.maps.DirectionsService()
      const routePolylines: LatLng[][] = []

      // Create one continuous route through all waypoints
      if (smootedPoints.length === 2) {
        // Simple two-point route
        const result = await directionsService.route({
          origin: new window.google.maps.LatLng(smootedPoints[0].lat, smoothedPoints[0].lng),
          destination: new window.google.maps.LatLng(smootedPoints[1].lat, smoothedPoints[1].lng),
          travelMode: window.google.maps.TravelMode.WALKING
        })

        if (result.routes && result.routes[0] && result.routes[0].overview_path) {
          const path = result.routes[0].overview_path.map(point => ({
            lat: point.lat(),
            lng: point.lng()
          }))
          routePolylines.push(path)
        }
      } else {
        // Multi-waypoint route
        const waypoints = smoothedPoints.slice(1, -1).map(point => ({
          location: new window.google.maps.LatLng(point.lat, point.lng),
          stopover: true
        }))

        // For closed shapes (polygons), return to start
        const isClosedShape = shape.type === 'polygon' && smoothedPoints.length > 2
        const destination = isClosedShape 
          ? smoothedPoints[0] 
          : smoothedPoints[smootedPoints.length - 1]

        const result = await directionsService.route({
          origin: new window.google.maps.LatLng(smootedPoints[0].lat, smoothedPoints[0].lng),
          destination: new window.google.maps.LatLng(destination.lat, destination.lng),
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.WALKING,
          optimizeWaypoints: true // This will optimize the order of waypoints for the best route
        })

        if (result.routes && result.routes[0] && result.routes[0].overview_path) {
          const path = result.routes[0].overview_path.map(point => ({
            lat: point.lat(),
            lng: point.lng()
          }))
          routePolylines.push(path)
        }
      }

      return routePolylines.length > 0 ? routePolylines : [shape.points]
    } catch (error) {
      console.error('Error getting Google Maps route:', error)
      return [shape.points]
    }
  }

  // Render drawn shapes
  useEffect(() => {
    if (!mapInstanceRef.current || !shapeLayersRef.current) return

    // Clear existing shapes
    shapeLayersRef.current.clearLayers()
    console.log('Map: Cleared layers, rendering', drawnShapes.length, 'shapes')

    // Add new shapes
    drawnShapes.forEach(async (shape) => {
      // Calculate scale factor based on target distance
      let actualDistance = calculateShapeDistance(shape)
      
      // Try to get Google Maps route distance if available
      try {
        const routeResult = await getShapeRoute(shape.points)
        if (routeResult && routeResult.distance > 0) {
          actualDistance = routeResult.distance
          console.log(`Using Google Maps distance for shape ${shape.id}: ${actualDistance}m`)
        }
      } catch (error) {
        console.log(`Using straight-line distance for shape ${shape.id}: ${actualDistance}m`)
      }
      
      const targetDistance = shape.targetDistance || 1000 // Default 1km
      const scaleFactor = actualDistance > 0 ? targetDistance / actualDistance : 1
      
      // Get Google Maps route polylines
      const routePolylines = await getGoogleMapsRoutePolylines(shape)
      
      // Render each route polyline
      routePolylines.forEach((routePoints, index) => {
        const scaledPoints = routePoints.map(point => {
          // Calculate offset from user location
          const latOffset = (point.lat - userLocation.lat) * scaleFactor
          const lngOffset = (point.lng - userLocation.lng) * scaleFactor
          
          return [
            userLocation.lat + latOffset,
            userLocation.lng + lngOffset
          ] as [number, number]
        })
      
        let layer: L.Layer
        
        // Always render as polylines for Google Maps routes
        layer = L.polyline(scaledPoints, {
          color: shape.color || '#3b82f6',
          weight: 3,
          opacity: 0.8
        })

        // Add popup with shape info
        layer.bindPopup(`
          <div>
            <strong>${shape.type.charAt(0).toUpperCase() + shape.type.slice(1)} Route</strong><br>
            Points: ${shape.points.length}<br>
            ${shape.name ? `Name: ${shape.name}<br>` : ''}
            <button onclick="navigator.clipboard.writeText('${JSON.stringify(shape.points)}')">
              Copy Coordinates
            </button>
          </div>
        `)

        shapeLayersRef.current!.addLayer(layer)
      })
    })
  }, [drawnShapes])

  // Clean up markers and lines when component unmounts
  useEffect(() => {
    return () => {
      if (routeLineRef.current) {
        routeLineRef.current.remove()
        routeLineRef.current = null
      }
      if (positionMarkerRef.current) {
        positionMarkerRef.current.remove()
        positionMarkerRef.current = null
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  return (
    <div ref={mapRef} className="w-full h-full">
      {/* Map will be rendered here */}
    </div>
  )
}
