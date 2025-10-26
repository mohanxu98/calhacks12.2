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
  start?: LatLng
  end?: LatLng
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

// Sanitize Google HTML instruction into readable text
const sanitizeHtmlInstruction = (html: string): string => {
  if (!html) return ''
  let text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<div[^>]*>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  // Ensure destination phrase is separated by punctuation
  if (/destination will be/i.test(text) && !/[.!?]\s+destination will be/i.test(text)) {
    text = text.replace(/destination will be/i, '. Destination will be')
  }
  return text
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

// Determine if a shape is closed (last point near first point)
const isClosedShape = (points: LatLng[], thresholdMeters: number = 25): boolean => {
  if (points.length < 3) return false
  return calculateHaversineDistance(points[0], points[points.length - 1]) <= thresholdMeters
}

// Remove only too-close sequential points while preserving order
const dedupeSequentialPoints = (points: LatLng[], minDistanceMeters: number = 8): LatLng[] => {
  if (points.length <= 1) return points
  const deduped: LatLng[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = deduped[deduped.length - 1]
    const curr = points[i]
    const dist = calculateHaversineDistance(prev, curr)
    if (dist >= minDistanceMeters) deduped.push(curr)
  }
  // Always include the last point
  if (points.length > 1) deduped.push(points[points.length - 1])
  return deduped
}

// Chunk a long ordered list of points into multiple Directions API requests
// preserving order and stitching segments. Google typically allows up to ~23 waypoints.
const buildPointChunks = (points: LatLng[], maxWaypointsPerRequest: number = 20): LatLng[][] => {
  // Each request uses: origin + up to maxWaypointsPerRequest waypoints + destination
  // That equals maxWaypointsPerRequest + 2 total points per request
  if (points.length <= 2) return [points]
  const chunks: LatLng[][] = []
  let i = 0
  const maxPointsPerRequest = Math.max(2, Math.min(25, maxWaypointsPerRequest + 2))
  while (i < points.length - 1) {
    const lastIndex = Math.min(i + maxPointsPerRequest - 1, points.length - 1)
    const segment = points.slice(i, lastIndex + 1)
    chunks.push(segment)
    i = lastIndex
  }
  return chunks
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

  // Preserve order, dedupe only too-close sequential points
  let orderedPoints = dedupeSequentialPoints(points, 8)

  // Detect closed shape and avoid auto-closing unless intentionally closed
  const closed = isClosedShape(orderedPoints)
  if (closed && calculateHaversineDistance(orderedPoints[0], orderedPoints[orderedPoints.length - 1]) > 0) {
    // Ensure last equals first for closed loop
    orderedPoints = [...orderedPoints.slice(0, -1), orderedPoints[0]]
  }

  // Fallback if Google not available
  if (!isGoogleMapsLoaded()) {
    let totalDistance = 0
    for (let i = 0; i < orderedPoints.length - 1; i++) {
      totalDistance += calculateHaversineDistance(orderedPoints[i], orderedPoints[i + 1])
    }
    const totalDuration = totalDistance / 1.4
    return {
      distance: totalDistance,
      duration: totalDuration,
      points: orderedPoints
    }
  }

  // Use chunked multi-waypoint routing to reduce requests while preserving order
  const chunks = buildPointChunks(orderedPoints, 20)
  const directionsService = new google.maps.DirectionsService()

  let totalDistance = 0
  let totalDuration = 0
  const stitchedPoints: LatLng[] = []

  for (let c = 0; c < chunks.length; c++) {
    const segment = chunks[c]
    if (segment.length < 2) continue
    const origin = segment[0]
    const destination = segment[segment.length - 1]
    const waypoints = segment.slice(1, -1).map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      // Avoid intermediate destination announcements
      stopover: false
    }))

    try {
      const result = await directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: google.maps.TravelMode.WALKING,
        optimizeWaypoints: false
      })
      const route = result.routes[0]
      route.legs.forEach(leg => {
        totalDistance += leg.distance?.value || 0
        totalDuration += leg.duration?.value || 0
      })
      if (route.overview_path && route.overview_path.length > 0) {
        const pathPoints = route.overview_path.map(pt => ({ lat: pt.lat(), lng: pt.lng() }))
        if (c === 0) {
          stitchedPoints.push(...pathPoints)
        } else {
          // Avoid duplicate join point
          stitchedPoints.push(...pathPoints.slice(1))
        }
      } else {
        // Fallback to straight line for this segment
        if (c === 0) stitchedPoints.push(origin)
        stitchedPoints.push(destination)
      }
    } catch (e) {
      // On failure, fallback to straight line for this segment
      if (c === 0) stitchedPoints.push(origin)
      stitchedPoints.push(destination)
      totalDistance += calculateHaversineDistance(origin, destination)
      totalDuration += calculateHaversineDistance(origin, destination) / 1.4
    }
  }

  return {
    distance: totalDistance,
    duration: totalDuration,
    points: stitchedPoints.length > 1 ? stitchedPoints : orderedPoints
  }
}

// Get detailed route information for display
export const getDetailedRouteInfo = async (points: LatLng[]): Promise<RouteInfo | null> => {
  if (!isGoogleMapsLoaded() || points.length < 2) return null

  try {
    const directionsService = new google.maps.DirectionsService()
    
    // Preserve order, dedupe only too-close sequential points
    let orderedPoints = dedupeSequentialPoints(points, 8)
    const closed = isClosedShape(orderedPoints)
    if (closed && calculateHaversineDistance(orderedPoints[0], orderedPoints[orderedPoints.length - 1]) > 0) {
      orderedPoints = [...orderedPoints.slice(0, -1), orderedPoints[0]]
    }

    // Short route
    if (orderedPoints.length === 2) {
      const result = await directionsService.route({
        origin: new google.maps.LatLng(orderedPoints[0].lat, orderedPoints[0].lng),
        destination: new google.maps.LatLng(orderedPoints[1].lat, orderedPoints[1].lng),
        travelMode: google.maps.TravelMode.WALKING
      })

      const route = result.routes[0]
      const leg = route.legs[0]
      const steps: RouteStep[] = leg.steps.map(step => ({
        instruction: sanitizeHtmlInstruction(step.instructions || ''),
        distance: step.distance?.text || '',
        duration: step.duration?.text || '',
        start: step.start_location ? { lat: step.start_location.lat(), lng: step.start_location.lng() } : undefined,
        end: step.end_location ? { lat: step.end_location.lat(), lng: step.end_location.lng() } : undefined
      }))
      return {
        distance: leg.distance?.text || '',
        duration: leg.duration?.text || '',
        steps
      }
    }

    // Chunked multi-waypoint routing for long routes
    const chunks = buildPointChunks(orderedPoints, 20)
    const allSteps: RouteStep[] = []
    let totalDistance = 0
    let totalDuration = 0

    for (const segment of chunks) {
      if (segment.length < 2) continue
      const origin = segment[0]
      const destination = segment[segment.length - 1]
      const waypoints = segment.slice(1, -1).map(p => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        stopover: false
      }))
      const result = await directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: google.maps.TravelMode.WALKING,
        optimizeWaypoints: false
      })
      const route = result.routes[0]
      route.legs.forEach((leg, legIdx) => {
        if (leg.steps) {
          leg.steps.forEach((step, stepIdx) => {
            const instruction = sanitizeHtmlInstruction(step.instructions || '')
            const isDestination = /destination will be/i.test(instruction)
            const isFinalLeg = legIdx === route.legs.length - 1
            const isFinalStep = stepIdx === leg.steps.length - 1
            // Filter out intermediate destination messages
            if (isDestination && !(isFinalLeg && isFinalStep)) {
              return
            }
            allSteps.push({
              instruction,
              distance: step.distance?.text || '',
              duration: step.duration?.text || '',
              start: step.start_location ? { lat: step.start_location.lat(), lng: step.start_location.lng() } : undefined,
              end: step.end_location ? { lat: step.end_location.lat(), lng: step.end_location.lng() } : undefined
            })
          })
        }
        totalDistance += leg.distance?.value || 0
        totalDuration += leg.duration?.value || 0
      })
    }

    return {
      distance: `${Math.round(totalDistance)}m`,
      duration: `${Math.round(totalDuration / 60)} min`,
      steps: allSteps
    }
  } catch (error) {
    console.error('Error getting detailed route info:', error)
    return null
  }
}
