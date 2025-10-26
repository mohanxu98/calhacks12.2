import { LatLng } from '@/types'

export interface RouteStep {
  instruction: string
  distance: number
  duration: number
  type: number
  name: string
  way_points: number[]
}

export interface Route {
  distance: number
  duration: number
  steps: RouteStep[]
  geometry: {
    coordinates: number[][]
  }
}

export interface RoutingResult {
  routes: Route[]
  way_points: number[]
}

// Convert shape points to waypoints for routing
export function shapeToWaypoints(shapePoints: LatLng[], userLocation: LatLng): LatLng[] {
  // Start from user location
  const waypoints = [userLocation]
  
  // For shapes with many points, reduce to key waypoints to avoid repetitive directions
  if (shapePoints.length > 8) {
    // Take every nth point to reduce waypoints
    const step = Math.ceil(shapePoints.length / 6) // Max 6 waypoints
    for (let i = 0; i < shapePoints.length; i += step) {
      waypoints.push(shapePoints[i])
    }
  } else {
    // Add all shape points for smaller shapes
    waypoints.push(...shapePoints)
  }
  
  // Return to start for closed shapes
  if (shapePoints.length > 2) {
    waypoints.push(userLocation)
  }
  
  return waypoints
}

// Generate route using OpenRouteService
export async function generateRoute(waypoints: LatLng[]): Promise<RoutingResult | null> {
  try {
    // Convert waypoints to the format expected by OpenRouteService
    const coordinates = waypoints.map(point => [point.lng, point.lat])
    
    // For demo purposes, we'll use a mock routing service
    // In production, you would use OpenRouteService API
    const mockRoute = generateMockRoute(waypoints)
    
    return mockRoute
  } catch (error) {
    console.error('Error generating route:', error)
    return null
  }
}

// Mock route generation for demo purposes
function generateMockRoute(waypoints: LatLng[]): RoutingResult {
  const steps: RouteStep[] = []
  let totalDistance = 0
  let totalDuration = 0
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i]
    const next = waypoints[i + 1]
    
    // Calculate distance between points
    const distance = calculateDistance(current, next)
    const duration = distance / 1.4 // Assume 1.4 m/s walking speed
    
    totalDistance += distance
    totalDuration += duration
    
    // Only create steps for significant distances (avoid tiny steps)
    if (distance > 10) { // Only include steps longer than 10m
      const instruction = generateInstruction(current, next, steps.length, waypoints.length - 1)
      
      steps.push({
        instruction,
        distance: Math.round(distance),
        duration: Math.round(duration),
        type: steps.length === 0 ? 0 : 1, // 0 = start, 1 = turn
        name: `Step ${steps.length + 1}`,
        way_points: [i, i + 1]
      })
    }
  }
  
  // If no significant steps, create a simple route
  if (steps.length === 0) {
    steps.push({
      instruction: "Follow the route around the area",
      distance: Math.round(totalDistance),
      duration: Math.round(totalDuration),
      type: 0,
      name: "Route",
      way_points: [0, waypoints.length - 1]
    })
  }
  
  return {
    routes: [{
      distance: Math.round(totalDistance),
      duration: Math.round(totalDuration),
      steps,
      geometry: {
        coordinates: waypoints.map(point => [point.lng, point.lat])
      }
    }],
    way_points: waypoints.map((_, index) => index)
  }
}

// Calculate distance between two points
function calculateDistance(point1: LatLng, point2: LatLng): number {
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

// Generate instruction based on direction
function generateInstruction(current: LatLng, next: LatLng, stepIndex: number, totalSteps: number): string {
  const latDiff = next.lat - current.lat
  const lngDiff = next.lng - current.lng
  
  // Calculate the angle to determine direction
  const angle = Math.atan2(lngDiff, latDiff) * 180 / Math.PI
  
  let direction = ''
  let turnType = ''
  
  // Determine primary direction
  if (angle >= -22.5 && angle < 22.5) {
    direction = 'north'
  } else if (angle >= 22.5 && angle < 67.5) {
    direction = 'northeast'
  } else if (angle >= 67.5 && angle < 112.5) {
    direction = 'east'
  } else if (angle >= 112.5 && angle < 157.5) {
    direction = 'southeast'
  } else if (angle >= 157.5 || angle < -157.5) {
    direction = 'south'
  } else if (angle >= -157.5 && angle < -112.5) {
    direction = 'southwest'
  } else if (angle >= -112.5 && angle < -67.5) {
    direction = 'west'
  } else if (angle >= -67.5 && angle < -22.5) {
    direction = 'northwest'
  }
  
  if (stepIndex === 0) {
    return `Start by heading ${direction}`
  } else if (stepIndex === totalSteps - 1) {
    return `Continue ${direction} to finish the route`
  } else {
    // Add variety to turn instructions
    const turnInstructions = [
      `Turn ${direction}`,
      `Head ${direction}`,
      `Go ${direction}`,
      `Continue ${direction}`,
      `Follow the path ${direction}`
    ]
    return turnInstructions[stepIndex % turnInstructions.length]
  }
}

// Real OpenRouteService integration (commented out for demo)
/*
export async function generateRouteWithOpenRouteService(waypoints: LatLng[]): Promise<RoutingResult | null> {
  try {
    const coordinates = waypoints.map(point => [point.lng, point.lat])
    
    const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'YOUR_API_KEY_HERE' // Replace with actual API key
      },
      body: JSON.stringify({
        coordinates,
        format: 'geojson',
        instructions: true,
        geometry: true
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error with OpenRouteService:', error)
    return null
  }
}
*/
