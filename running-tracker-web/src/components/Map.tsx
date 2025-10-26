'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RunState, LatLng, DrawnShape } from '@/types'
import { getShapeRoute } from '@/lib/googleMapsRouting'

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

  // Check if a point is likely in the ocean (simple heuristic)
  const isLikelyInOcean = (point: LatLng): boolean => {
    // Simple heuristic: if the point is far from the user location, it might be in ocean
    // This is a basic check - in a real app you'd use a proper land/water detection service
    const distanceFromUser = calculateDistance(point, userLocation)
    return distanceFromUser > 1000 // If more than 1km from user, might be in ocean
  }

  // Shift shape to land if it's in the ocean
  const shiftShapeToLand = (points: LatLng[]): LatLng[] => {
    if (points.length === 0) return points

    // Check if any points are likely in the ocean
    const oceanPoints = points.filter(point => isLikelyInOcean(point))
    
    if (oceanPoints.length === 0) {
      console.log('Shape is on land, no shifting needed')
      return points
    }

    console.log(`Detected ${oceanPoints.length} points in ocean, shifting shape to land...`)

    // Calculate the center of the shape
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length
    const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length

    // Shift the entire shape towards the user location
    const shiftLat = (userLocation.lat - centerLat) * 0.3 // 30% towards user
    const shiftLng = (userLocation.lng - centerLng) * 0.3

    const shiftedPoints = points.map(point => ({
      lat: point.lat + shiftLat,
      lng: point.lng + shiftLng
    }))

    console.log(`Shape shifted by (${shiftLat.toFixed(6)}, ${shiftLng.toFixed(6)})`)
    return shiftedPoints
  }

  // Scale up a shape if it's too small for practical walking
  const scaleShapeIfNeeded = (points: LatLng[]): LatLng[] => {
    if (points.length < 2) return points

    // Calculate the bounding box of the shape
    const lats = points.map(p => p.lat)
    const lngs = points.map(p => p.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    // Calculate the dimensions
    const latRange = maxLat - minLat
    const lngRange = maxLng - minLng
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    // Calculate the maximum distance between any two points
    let maxDistance = 0
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = calculateDistance(points[i], points[j])
        maxDistance = Math.max(maxDistance, distance)
      }
    }

    // If the shape is too small (max distance < 50 meters), scale it up
    const minSize = 50 // 50 meters minimum
    if (maxDistance < minSize) {
      const scaleFactor = minSize / maxDistance
      console.log(`Shape too small (${maxDistance.toFixed(1)}m), scaling up by ${scaleFactor.toFixed(1)}x`)

      const scaledPoints = points.map(point => {
        // Scale relative to the center
        const latOffset = (point.lat - centerLat) * scaleFactor
        const lngOffset = (point.lng - centerLng) * scaleFactor

        return {
          lat: centerLat + latOffset,
          lng: centerLng + lngOffset
        }
      })

      return scaledPoints
    }

    return points
  }
  // Scale arbitrary points around a center (userLocation)
  const scalePointsAround = (points: LatLng[], center: LatLng, factor: number): LatLng[] => {
    const scaled = points.map(p => ({
      lat: center.lat + (p.lat - center.lat) * factor,
      lng: center.lng + (p.lng - center.lng) * factor,
    }))
    // Preserve closure if originally closed
    if (points.length > 2) {
      const first = scaled[0]
      const last = scaled[scaled.length - 1]
      const wasClosed = Math.hypot(points[0].lat - points[points.length - 1].lat, points[0].lng - points[points.length - 1].lng) < 1e-9
      if (wasClosed) {
        scaled[scaled.length - 1] = { ...first }
      }
    }
    return scaled
  }

  // Iteratively find a scaling factor so Google route distance ~= targetDistance
  const findScaleForTargetDistance = async (basePoints: LatLng[], center: LatLng, targetDistance: number): Promise<{ factor: number, scaledPoints: LatLng[], finalDistance: number } | null> => {
    try {
      // Initial distance from Google
      const baseRoute = await getShapeRoute(basePoints)
      const baseDistance = Math.max(1, baseRoute?.distance || 0) // avoid div by 0
      const target = Math.max(1, targetDistance)

      // Initial guess
      const initialFactor = Math.min(5, Math.max(0.2, target / baseDistance))

      // Establish bracket [lo, hi]
      let lo = Math.max(0.2, initialFactor * 0.5)
      let hi = Math.min(5, initialFactor * 1.5)
      const evalDist = async (f: number) => {
        const scaled = scalePointsAround(basePoints, center, f)
        const res = await getShapeRoute(scaled)
        return { dist: res?.distance || 0, scaled }
      }

      let loEval = await evalDist(lo)
      let hiEval = await evalDist(hi)

      // Try to widen bracket if target not between
      for (let i = 0; i < 3 && !((loEval.dist <= target && hiEval.dist >= target) || (loEval.dist >= target && hiEval.dist <= target)); i++) {
        lo = Math.max(0.2, lo * 0.5)
        hi = Math.min(5, hi * 1.5)
        loEval = await evalDist(lo)
        hiEval = await evalDist(hi)
      }

      // Binary search within bracket
      let best = Math.abs(loEval.dist - target) <= Math.abs(hiEval.dist - target) ? { f: lo, ...loEval } : { f: hi, ...hiEval }
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        const midEval = await evalDist(mid)
        if (Math.abs(midEval.dist - target) < Math.abs(best.dist - target)) {
          best = { f: mid, ...midEval }
        }
        const loBelow = loEval.dist < target
        const midBelow = midEval.dist < target
        if (loBelow !== midBelow) {
          hi = mid
          hiEval = midEval
        } else {
          lo = mid
          loEval = midEval
        }
        // stop if within tight tolerance
        if (Math.abs(best.dist - target) <= Math.max(10, target * 0.005)) {
          break
        }
      }

      return { factor: best.f, scaledPoints: best.scaled, finalDistance: best.dist }
    } catch (e) {
      console.log('findScaleForTargetDistance failed, using base points', e)
      return null
    }
  }



  // Merge points that are very close together
  const mergeClosePoints = (points: LatLng[], minDistanceMeters: number): LatLng[] => {
    if (points.length <= 1) return points

    const merged: LatLng[] = [points[0]] // Always keep first point
    
    for (let i = 1; i < points.length; i++) {
      const lastMerged = merged[merged.length - 1]
      const current = points[i]
      
      const distance = calculateDistance(lastMerged, current)
      
      // If distance is too small, skip this point (merge with previous)
      if (distance < minDistanceMeters) {
        console.log(`Merging point ${i} (distance: ${distance.toFixed(1)}m)`)
        continue
      }
      
      // Keep this point
      merged.push(current)
    }
    
    // If we ended up with only one point, keep the last original point too
    if (merged.length === 1 && points.length > 1) {
      merged.push(points[points.length - 1])
    }
    
    return merged
  }


  // Find the nearest valid road point to a given location (map matching)
  const findNearestRoadPoint = async (point: LatLng, directionsService: any): Promise<LatLng> => {
    const searchRadius = 0.0005 // ~50 meters
    const searchPoints = [
      point, // Original point
      { lat: point.lat + searchRadius, lng: point.lng }, // North
      { lat: point.lat - searchRadius, lng: point.lng }, // South
      { lat: point.lat, lng: point.lng + searchRadius }, // East
      { lat: point.lat, lng: point.lng - searchRadius }, // West
      { lat: point.lat + searchRadius/2, lng: point.lng + searchRadius/2 }, // NE
      { lat: point.lat - searchRadius/2, lng: point.lng + searchRadius/2 }, // SE
      { lat: point.lat + searchRadius/2, lng: point.lng - searchRadius/2 }, // NW
      { lat: point.lat - searchRadius/2, lng: point.lng - searchRadius/2 }, // SW
    ]

    for (const searchPoint of searchPoints) {
      try {
        // Test if this point can route to a nearby point (validates it's on a road)
        const testPoint = {
          lat: searchPoint.lat + 0.00001, // ~1 meter away
          lng: searchPoint.lng + 0.00001
        }

        const result = await directionsService.route({
          origin: new window.google.maps.LatLng(searchPoint.lat, searchPoint.lng),
          destination: new window.google.maps.LatLng(testPoint.lat, testPoint.lng),
          travelMode: window.google.maps.TravelMode.WALKING
        })

        if (result.routes && result.routes[0] && result.routes[0].overview_path) {
          // Use the first point of the route (snapped to nearest road)
          const firstRoutePoint = result.routes[0].overview_path[0]
          return {
            lat: firstRoutePoint.lat(),
            lng: firstRoutePoint.lng()
          }
        }
      } catch (error) {
        // Continue to next search point
      }
    }

    // If no valid road point found, return original
    return point
  }

  // Calculate shape similarity between original and mapped points
  const calculateShapeSimilarity = (original: LatLng[], mapped: LatLng[]): number => {
    if (original.length !== mapped.length) return 0

    // Calculate the center of both shapes
    const origCenter = {
      lat: original.reduce((sum, p) => sum + p.lat, 0) / original.length,
      lng: original.reduce((sum, p) => sum + p.lng, 0) / original.length
    }
    const mappedCenter = {
      lat: mapped.reduce((sum, p) => sum + p.lat, 0) / mapped.length,
      lng: mapped.reduce((sum, p) => sum + p.lng, 0) / mapped.length
    }

    // Calculate average distance from center for both shapes
    const origDistances = original.map(p => calculateDistance(p, origCenter))
    const mappedDistances = mapped.map(p => calculateDistance(p, mappedCenter))
    
    const origAvgDist = origDistances.reduce((sum, d) => sum + d, 0) / origDistances.length
    const mappedAvgDist = mappedDistances.reduce((sum, d) => sum + d, 0) / mappedDistances.length

    // Calculate similarity based on relative distances and positions
    let similarity = 0
    for (let i = 0; i < original.length; i++) {
      const origRelDist = origDistances[i] / origAvgDist
      const mappedRelDist = mappedDistances[i] / mappedAvgDist
      const distSimilarity = 1 - Math.abs(origRelDist - mappedRelDist) / Math.max(origRelDist, mappedRelDist)
      similarity += Math.max(0, distSimilarity)
    }

    return similarity / original.length
  }

  // Find the nearest road intersection or valid point to a given location
  const findNearestRoadIntersection = async (point: LatLng, directionsService: any): Promise<LatLng> => {
    const searchRadius = 0.0003 // ~30 meters
    const searchPoints = [
      point, // Original point
      { lat: point.lat + searchRadius, lng: point.lng }, // North
      { lat: point.lat - searchRadius, lng: point.lng }, // South
      { lat: point.lat, lng: point.lng + searchRadius }, // East
      { lat: point.lat, lng: point.lng - searchRadius }, // West
      { lat: point.lat + searchRadius/2, lng: point.lng + searchRadius/2 }, // NE
      { lat: point.lat - searchRadius/2, lng: point.lng + searchRadius/2 }, // SE
      { lat: point.lat + searchRadius/2, lng: point.lng - searchRadius/2 }, // NW
      { lat: point.lat - searchRadius/2, lng: point.lng - searchRadius/2 }, // SW
    ]

    for (const searchPoint of searchPoints) {
      try {
        // Test if this point can route to nearby points in 4 directions
        const testPoints = [
          { lat: searchPoint.lat + 0.0001, lng: searchPoint.lng }, // North
          { lat: searchPoint.lat - 0.0001, lng: searchPoint.lng }, // South
          { lat: searchPoint.lat, lng: searchPoint.lng + 0.0001 }, // East
          { lat: searchPoint.lat, lng: searchPoint.lng - 0.0001 }, // West
        ]

        let validRoutes = 0
        for (const testPoint of testPoints) {
          try {
            const result = await directionsService.route({
              origin: new window.google.maps.LatLng(searchPoint.lat, searchPoint.lng),
              destination: new window.google.maps.LatLng(testPoint.lat, testPoint.lng),
              travelMode: window.google.maps.TravelMode.WALKING
            })
            if (result.routes && result.routes[0] && result.routes[0].overview_path) {
              validRoutes++
            }
          } catch (error) {
            // Continue to next test point
          }
        }

        // If we can route in at least 2 directions, this is a good intersection
        if (validRoutes >= 2) {
          return searchPoint
        }
      } catch (error) {
        // Continue to next search point
      }
    }

    // If no good intersection found, return original point
    return point
  }

  // Sample points every 30 meters while preserving the exact order you drew
  const samplePointsEvery30Meters = (points: LatLng[]): LatLng[] => {
    if (points.length < 2) return points

    const sampledPoints: LatLng[] = [points[0]] // Always start with first point
    let currentDistance = 0
    const sampleInterval = 30 // 30 meters

    // Go through points in the exact order you drew them
    for (let i = 1; i < points.length; i++) {
      const segmentDistance = calculateDistance(points[i - 1], points[i])
      currentDistance += segmentDistance

      // If we've traveled 30+ meters, add this point (in order)
      if (currentDistance >= sampleInterval) {
        sampledPoints.push(points[i])
        currentDistance = 0 // Reset distance counter
      }
    }

    // Always include the last point to preserve the complete shape
    if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
      sampledPoints.push(points[points.length - 1])
    }

    console.log(`Sampled ${points.length} points down to ${sampledPoints.length} points (every ~30m) in order`)
    return sampledPoints
  }

  // Simple: sample every 30m and route between consecutive points
  const getGoogleMapsRoutePolylines = async (shape: DrawnShape): Promise<LatLng[][]> => {
    if (!window.google || !window.google.maps) {
      console.log('Google Maps not available, using straight lines')
      return [shape.points]
    }

    try {
      // Step 1: Check if shape is in ocean and shift to land if needed
      const landPoints = shiftShapeToLand(shape.points)
      
      // Step 2: Scale up the shape if it's too small for practical walking
      const scaledPoints = scaleShapeIfNeeded(landPoints)
      if (scaledPoints.length < 2) return [shape.points]

      // Step 3: Sample points every 30 meters along the shape
      const sampledPoints = samplePointsEvery30Meters(scaledPoints)
      if (sampledPoints.length < 2) return [shape.points]

      const directionsService = new window.google.maps.DirectionsService()
      const routePolylines: LatLng[][] = []

      // Step 4: Route between consecutive sampled points in the exact order you drew
      console.log(`Routing between ${sampledPoints.length} sampled points in order...`)

      // Route from point 0 → 1 → 2 → 3... in the exact order you drew them
      for (let i = 0; i < sampledPoints.length - 1; i++) {
        const start = sampledPoints[i]
        const end = sampledPoints[i + 1]
        
        console.log(`Routing segment ${i}: point ${i} to point ${i + 1} (in order)`)
        
        try {
          const result = await directionsService.route({
            origin: new window.google.maps.LatLng(start.lat, start.lng),
            destination: new window.google.maps.LatLng(end.lat, end.lng),
            travelMode: window.google.maps.TravelMode.WALKING
          })

          if (result.routes && result.routes[0] && result.routes[0].overview_path) {
            const path = result.routes[0].overview_path.map(point => ({
              lat: point.lat(),
              lng: point.lng()
            }))
            routePolylines.push(path)
            console.log(`Segment ${i} route found with ${path.length} points`)
          } else {
            // Fallback to straight line
            routePolylines.push([start, end])
            console.log(`Segment ${i} using straight line fallback`)
          }
        } catch (error) {
          // Fallback to straight line
          routePolylines.push([start, end])
          console.log(`Segment ${i} using straight line fallback due to error`)
        }
      }

      console.log(`Created ${routePolylines.length} route segments`)
      return routePolylines.length > 0 ? routePolylines : [shape.points]
    } catch (error) {
      console.error('Error getting Google Maps route:', error)
      return [shape.points]
    }
  }

  // Find nearest road point with custom radius
  const findNearestRoadPointWithRadius = async (point: LatLng, directionsService: any, radius: number): Promise<LatLng> => {
    const searchPoints = [
      point, // Original point
      { lat: point.lat + radius, lng: point.lng }, // North
      { lat: point.lat - radius, lng: point.lng }, // South
      { lat: point.lat, lng: point.lng + radius }, // East
      { lat: point.lat, lng: point.lng - radius }, // West
      { lat: point.lat + radius/2, lng: point.lng + radius/2 }, // NE
      { lat: point.lat - radius/2, lng: point.lng + radius/2 }, // SE
      { lat: point.lat + radius/2, lng: point.lng - radius/2 }, // NW
      { lat: point.lat - radius/2, lng: point.lng - radius/2 }, // SW
    ]

    for (const searchPoint of searchPoints) {
      try {
        const testPoint = {
          lat: searchPoint.lat + 0.00001,
          lng: searchPoint.lng + 0.00001
        }

        const result = await directionsService.route({
          origin: new window.google.maps.LatLng(searchPoint.lat, searchPoint.lng),
          destination: new window.google.maps.LatLng(testPoint.lat, testPoint.lng),
          travelMode: window.google.maps.TravelMode.WALKING
        })

        if (result.routes && result.routes[0] && result.routes[0].overview_path) {
          const firstRoutePoint = result.routes[0].overview_path[0]
          return {
            lat: firstRoutePoint.lat(),
            lng: firstRoutePoint.lng()
          }
        }
      } catch (error) {
        // Continue to next search point
      }
    }

    return point
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
      const targetDistance = shape.targetDistance || 1000 // Default 1km

      // Find scaled shape whose Google route length ~ targetDistance
      const scaling = await findScaleForTargetDistance(shape.points, userLocation, targetDistance)
      const pointsForRouting = scaling?.scaledPoints || shape.points

      // Get Google Maps route polylines for the scaled shape
      const routePolylines = await getGoogleMapsRoutePolylines({ ...shape, points: pointsForRouting })
      
      // Render each route polyline
      routePolylines.forEach((routePoints, index) => {
        const scaledPoints = routePoints.map(point => [point.lat, point.lng] as [number, number])

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
