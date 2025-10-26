'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RunState, LatLng, DrawnShape } from '@/types'

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
}

export default function Map({ center, zoom, runState, onPositionUpdate, drawnShapes = [] }: MapProps) {
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

  // Render drawn shapes
  useEffect(() => {
    if (!mapInstanceRef.current || !shapeLayersRef.current) return

    // Clear existing shapes
    shapeLayersRef.current.clearLayers()
    console.log('Map: Cleared layers, rendering', drawnShapes.length, 'shapes')

    // Add new shapes
    drawnShapes.forEach(shape => {
      const latLngs = shape.points.map(point => [point.lat, point.lng] as [number, number])
      
      let layer: L.Layer
      
      if (shape.type === 'polygon' && shape.points.length >= 3) {
        layer = L.polygon(latLngs, {
          color: shape.color || '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: shape.color || '#3b82f6',
          fillOpacity: 0.2
        })
      } else if (shape.type === 'freehand' && shape.points.length >= 2) {
        layer = L.polyline(latLngs, {
          color: shape.color || '#3b82f6',
          weight: 3,
          opacity: 0.8
        })
      } else if (shape.type === 'rectangle' && shape.points.length >= 2) {
        const start = shape.points[0]
        const end = shape.points[1]
        const bounds = L.latLngBounds([start.lat, start.lng], [end.lat, end.lng])
        layer = L.rectangle(bounds, {
          color: shape.color || '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: shape.color || '#3b82f6',
          fillOpacity: 0.2
        })
      } else if (shape.type === 'circle' && shape.points.length >= 2) {
        const start = shape.points[0]
        const end = shape.points[1]
        const radius = mapInstanceRef.current!.distance(
          [start.lat, start.lng],
          [end.lat, end.lng]
        )
        layer = L.circle([start.lat, start.lng], {
          radius,
          color: shape.color || '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: shape.color || '#3b82f6',
          fillOpacity: 0.2
        })
      } else {
        return // Skip invalid shapes
      }

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
