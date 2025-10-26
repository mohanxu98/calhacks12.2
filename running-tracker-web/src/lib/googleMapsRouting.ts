import { LatLng } from '@/types'

// Declare Google Maps types
declare global {
  interface Window {
    google: any
  }
}

interface RouteResult {
  distance: number // in meters
  duration: number // in seconds
  points: LatLng[]
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

// Check if Google Maps is loaded
const isGoogleMapsLoaded = (): boolean => {
  return typeof window !== 'undefined' && 
         window.google && 
         window.google.maps && 
         window.google.maps.DirectionsService
}

// Smooth out points by removing points that are too close together
export const smoothShapePoints = (points: LatLng[], minDistanceMeters: number = 20): LatLng[] => {
  if (points.length <= 2) return points

  const smoothed: LatLng[] = [points[0]] // Always keep the first point
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1]
    const current = points[i]
    
    // Calculate distance between last smoothed point and current point
    const distance = calculateHaversineDistance(prev, current)
    
    // Keep points that are far enough apart, or if we have very few points
    if (distance >= minDistanceMeters || smoothed.length < 3) {
      smoothed.push(current)
    }
  }
  
  // Always keep the last point
  smoothed.push(points[points.length - 1])
  
  // If we ended up with too few points, keep more of the original points
  if (smoothed.length < 3 && points.length >= 3) {
    // Keep every other point from the original
    const everyOther = points.filter((_, index) => index % 2 === 0 || index === points.length - 1)
    return everyOther
  }
  
  return smoothed
}

// Calculate Haversine distance between two points
const calculateHaversineDistance = (point1: LatLng, point2: LatLng): number => {
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

// Get route between two points using Google Maps
export const getRouteBetweenPoints = async (start: LatLng, end: LatLng): Promise<RouteResult | null> => {
  if (!isGoogleMapsLoaded()) {
    console.warn('Google Maps not loaded, falling back to straight-line distance')
    return {
      distance: calculateHaversineDistance(start, end),
      duration: calculateHaversineDistance(start, end) / 1.4, // Assume 1.4 m/s walking speed
      points: [start, end]
    }
  }

  try {
    const directionsService = new google.maps.DirectionsService()
    
    const result = await directionsService.route({
      origin: new google.maps.LatLng(start.lat, start.lng),
      destination: new google.maps.LatLng(end.lat, end.lng),
      travelMode: google.maps.TravelMode.WALKING
    })

    const route = result.routes[0]
    const leg = route.legs[0]
    
    // Extract points from the route
    const points: LatLng[] = []
    if (route.overview_path) {
      route.overview_path.forEach(point => {
        points.push({
          lat: point.lat(),
          lng: point.lng()
        })
      })
    } else {
      // Fallback to start and end points
      points.push(start, end)
    }

    return {
      distance: leg.distance?.value || 0,
      duration: leg.duration?.value || 0,
      points
    }
  } catch (error) {
    console.error('Error getting route between points:', error)
    // Fallback to straight-line distance
    return {
      distance: calculateHaversineDistance(start, end),
      duration: calculateHaversineDistance(start, end) / 1.4,
      points: [start, end]
    }
  }
}

// Get route for a complete shape (polygon)
export const getShapeRoute = async (points: LatLng[]): Promise<RouteResult | null> => {
  if (points.length < 2) return null

  // Smooth out the points first
  const smoothedPoints = smoothShapePoints(points, 30) // 30m minimum distance
  
  if (smoothedPoints.length < 2) {
    return {
      distance: 0,
      duration: 0,
      points: smoothedPoints
    }
  }

  let totalDistance = 0
  let totalDuration = 0
  const allRoutePoints: LatLng[] = []

  // Get routes between consecutive points
  for (let i = 0; i < smoothedPoints.length; i++) {
    const start = smoothedPoints[i]
    const end = smoothedPoints[(i + 1) % smoothedPoints.length] // Wrap around for closed shapes
    
    const route = await getRouteBetweenPoints(start, end)
    if (route) {
      totalDistance += route.distance
      totalDuration += route.duration
      
      // Add route points (skip the first point to avoid duplicates)
      if (i === 0) {
        allRoutePoints.push(...route.points)
      } else {
        allRoutePoints.push(...route.points.slice(1))
      }
    }
  }

  return {
    distance: totalDistance,
    duration: totalDuration,
    points: allRoutePoints
  }
}

// Get detailed route information for display
export const getDetailedRouteInfo = async (points: LatLng[]): Promise<RouteInfo | null> => {
  if (!isGoogleMapsLoaded() || points.length < 2) return null

  try {
    const directionsService = new google.maps.DirectionsService()
    
    // Smooth the points first to get better waypoints
    const smoothedPoints = smoothShapePoints(points, 20)
    
    if (smoothedPoints.length === 2) {
      // Simple two-point route
      const result = await directionsService.route({
        origin: new google.maps.LatLng(smoothedPoints[0].lat, smoothedPoints[0].lng),
        destination: new google.maps.LatLng(smoothedPoints[1].lat, smoothedPoints[1].lng),
        travelMode: google.maps.TravelMode.WALKING
      })

      const route = result.routes[0]
      const leg = route.legs[0]
      
      const steps: RouteStep[] = leg.steps.map(step => ({
        instruction: step.instructions.replace(/<[^>]*>/g, ''),
        distance: step.distance?.text || '',
        duration: step.duration?.text || ''
      }))

      return {
        distance: leg.distance?.text || '',
        duration: leg.duration?.text || '',
        steps
      }
    } else {
      // Multi-waypoint route
      const waypoints = smoothedPoints.slice(1, -1).map(point => ({
        location: new google.maps.LatLng(point.lat, point.lng),
        stopover: true
      }))

      const result = await directionsService.route({
        origin: new google.maps.LatLng(smoothedPoints[0].lat, smoothedPoints[0].lng),
        destination: new google.maps.LatLng(smoothedPoints[smoothedPoints.length - 1].lat, smoothedPoints[smoothedPoints.length - 1].lng),
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.WALKING,
        optimizeWaypoints: true
      })

      const route = result.routes[0]
      
      // Combine all legs into one continuous route
      const allSteps: RouteStep[] = []
      let totalDistance = 0
      let totalDuration = 0

      route.legs.forEach(leg => {
        if (leg.steps) {
          leg.steps.forEach(step => {
            allSteps.push({
              instruction: step.instructions.replace(/<[^>]*>/g, ''),
              distance: step.distance?.text || '',
              duration: step.duration?.text || ''
            })
          })
        }
        totalDistance += leg.distance?.value || 0
        totalDuration += leg.duration?.value || 0
      })

      return {
        distance: `${Math.round(totalDistance)}m`,
        duration: `${Math.round(totalDuration / 60)} min`,
        steps: allSteps
      }
    }
  } catch (error) {
    console.error('Error getting detailed route info:', error)
    return null
  }
}
