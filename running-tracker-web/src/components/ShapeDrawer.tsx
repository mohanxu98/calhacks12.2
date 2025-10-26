'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { LatLng } from '@/types'
import Directions from './Directions'
import { getShapeRoute, getDetailedRouteInfo } from '@/lib/googleMapsRouting'

// Declare Google Maps types
declare global {
  interface Window {
    google: any
  }
}

export interface DrawnShape {
  id: string
  type: 'freehand'
  points: LatLng[]
  name?: string
  color?: string
}

interface ShapeDrawerProps {
  onShapeComplete: (shape: DrawnShape) => void
  onShapeUpdate?: (shape: DrawnShape) => void
  onShapeDelete?: (shapeId: string) => void
  initialShapes?: DrawnShape[]
  userLocation: LatLng
  width?: number
  height?: number
}

export default function ShapeDrawer({ 
  onShapeComplete, 
  onShapeUpdate,
  onShapeDelete,
  initialShapes = [],
  userLocation,
  width = 400,
  height = 300 
}: ShapeDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentShape, setCurrentShape] = useState<DrawnShape | null>(null)
  const [shapes, setShapes] = useState<DrawnShape[]>(initialShapes)
  
  // Sync local shapes with parent shapes when they change
  useEffect(() => {
    setShapes(initialShapes)
  }, [initialShapes])
  const [drawMode, setDrawMode] = useState<'freehand'>('freehand')
  const [targetDistance, setTargetDistance] = useState<number>(1000) // Default 1km in meters
  const [showDirections, setShowDirections] = useState<DrawnShape | null>(null)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [routeDistances, setRouteDistances] = useState<Map<string, number>>(new Map())
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false)


  // Convert canvas coordinates to lat/lng based on user location (without scaling during drawing)
  const canvasToLatLng = useCallback((x: number, y: number): LatLng => {
    // Convert pixel coordinates to lat/lng offsets around user location
    // Don't apply scaling during drawing - we'll scale after completion
    const metersPerPixel = 1 // 1 meter per pixel
    const latOffset = (y - height / 2) * metersPerPixel / 111320 // Convert meters to degrees latitude
    const lngOffset = (x - width / 2) * metersPerPixel / (111320 * Math.cos(userLocation.lat * Math.PI / 180)) // Convert meters to degrees longitude
    
    return {
      lat: userLocation.lat + latOffset,
      lng: userLocation.lng + lngOffset
    }
  }, [width, height, userLocation])

  // Convert lat/lng to canvas coordinates based on user location with scaling
  const latLngToCanvas = useCallback((lat: number, lng: number): { x: number; y: number } => {
    const metersPerPixel = 1 // 1 meter per pixel
    const latOffset = (lat - userLocation.lat) * 111320 // Convert degrees to meters
    const lngOffset = (lng - userLocation.lng) * (111320 * Math.cos(userLocation.lat * Math.PI / 180)) // Convert degrees to meters
    
    const x = width / 2 + lngOffset / metersPerPixel
    const y = height / 2 + latOffset / metersPerPixel
    
  return { x, y }
}, [width, height, userLocation])

  // Draw all shapes on canvas
  const drawShapes = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, height)
      ctx.stroke()
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(width, i)
      ctx.stroke()
    }

    // Draw user location marker (center of canvas)
    ctx.fillStyle = '#39FF14'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, 8, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
    
    // Draw crosshairs at user location
    ctx.strokeStyle = '#39FF14'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(width / 2 - 15, height / 2)
    ctx.lineTo(width / 2 + 15, height / 2)
    ctx.moveTo(width / 2, height / 2 - 15)
    ctx.lineTo(width / 2, height / 2 + 15)
    ctx.stroke()

    // Draw existing shapes
    shapes.forEach(shape => {
      drawShape(ctx, shape)
    })

    // Draw current shape being drawn
    if (currentShape && currentShape.points.length > 0) {
      drawShape(ctx, currentShape, true)
    }
  }, [shapes, currentShape, width, height])

  // Draw a single shape
  const drawShape = (ctx: CanvasRenderingContext2D, shape: DrawnShape, isCurrent = false) => {
    if (shape.points.length === 0) return

    ctx.strokeStyle = isCurrent ? '#39FF14' : (shape.color || '#3b82f6')
    ctx.fillStyle = isCurrent ? 'rgba(57, 255, 20, 0.1)' : 'rgba(59, 130, 246, 0.1)'
    ctx.lineWidth = isCurrent ? 3 : 2

    const canvasPoints = shape.points.map(point => latLngToCanvas(point.lat, point.lng))

    if (shape.type === 'polygon' || shape.type === 'freehand') {
      ctx.beginPath()
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y)
      for (let i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y)
      }
      if (shape.type === 'polygon' && canvasPoints.length > 2) {
        ctx.closePath()
        ctx.fill()
      }
      ctx.stroke()
    } else if (shape.type === 'rectangle' && canvasPoints.length >= 2) {
      const start = canvasPoints[0]
      const end = canvasPoints[1]
      const rectWidth = end.x - start.x
      const rectHeight = end.y - start.y
      
      ctx.beginPath()
      ctx.rect(start.x, start.y, rectWidth, rectHeight)
      ctx.fill()
      ctx.stroke()
    } else if (shape.type === 'circle' && canvasPoints.length >= 2) {
      const start = canvasPoints[0]
      const end = canvasPoints[1]
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
      
      ctx.beginPath()
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    }

    // Draw points
    canvasPoints.forEach((point, index) => {
      ctx.fillStyle = isCurrent ? '#39FF14' : '#3b82f6'
      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  // Handle mouse down - start freehand drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Clear any existing shapes when starting a new one (only allow one shape at a time)
    if (shapes.length > 0) {
      shapes.forEach(shape => {
        onShapeDelete?.(shape.id)
      })
      setShapes([])
    }

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newShape: DrawnShape = {
      id: Date.now().toString(),
      type: 'freehand',
      points: [canvasToLatLng(x, y)],
      targetDistance
    }
    setCurrentShape(newShape)
    setIsDrawing(true)
  }

  // Handle mouse move - continue freehand drawing with direction-based consolidation
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newPoint = canvasToLatLng(x, y)
    const currentPoints = currentShape.points

    // Only add point if there's a significant direction change or minimum distance
    if (shouldAddPoint(currentPoints, newPoint)) {
      const updatedShape = {
        ...currentShape,
        points: [...currentPoints, newPoint],
        targetDistance
      }
      setCurrentShape(updatedShape)
      onShapeUpdate?.(updatedShape)
    }
  }

  // Determine if a new point should be added based on direction and distance
  const shouldAddPoint = (currentPoints: LatLng[], newPoint: LatLng): boolean => {
    if (currentPoints.length === 0) return true

    const lastPoint = currentPoints[currentPoints.length - 1]
    
    // Always add if we have very few points
    if (currentPoints.length < 3) return true

    // Calculate distance from last point
    const distance = calculateDistance(lastPoint, newPoint)
    const minDistance = 2 // Minimum 2 meters between points (reduced from 5)

    // Add if distance is too small
    if (distance < minDistance) return false

    // Calculate direction change
    const directionChange = calculateDirectionChange(currentPoints, newPoint)
    const maxDirectionChange = 15 // Maximum 15 degrees before adding new point (reduced from 30)

    // Add if direction change is significant OR if we haven't added a point in a while
    return directionChange > maxDirectionChange || distance > 10 // Add point every 10 meters regardless of direction
  }

  // Calculate the change in direction between the last few points and the new point
  const calculateDirectionChange = (currentPoints: LatLng[], newPoint: LatLng): number => {
    if (currentPoints.length < 2) return 0

    const lastPoint = currentPoints[currentPoints.length - 1]
    const secondLastPoint = currentPoints[currentPoints.length - 2]

    // Calculate direction from second-to-last to last point
    const prevDirection = Math.atan2(
      lastPoint.lng - secondLastPoint.lng,
      lastPoint.lat - secondLastPoint.lat
    )

    // Calculate direction from last point to new point
    const newDirection = Math.atan2(
      newPoint.lng - lastPoint.lng,
      newPoint.lat - lastPoint.lat
    )

    // Calculate the difference in angles
    let angleDiff = Math.abs(newDirection - prevDirection)
    
    // Normalize to 0-180 degrees
    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff
    }

    // Convert to degrees
    return (angleDiff * 180) / Math.PI
  }

  // Calculate distance between two points
  const calculateDistance = (point1: LatLng, point2: LatLng): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180
    const φ2 = (point2.lat * Math.PI) / 180
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Handle mouse up - complete freehand drawing
  const handleMouseUp = () => {
    if (!isDrawing || !currentShape) return

    // Post-process the shape to consolidate points further
    const consolidatedPoints = consolidatePoints(currentShape.points)
    
    // Complete freehand drawing with consolidated points
    const completedShape = { 
      ...currentShape, 
      points: consolidatedPoints 
    }
    setShapes(prev => [...prev, completedShape])
    onShapeComplete(completedShape)
    setCurrentShape(null)
    setIsDrawing(false)
  }

  // Post-process points to further consolidate based on direction
  const consolidatePoints = (points: LatLng[]): LatLng[] => {
    if (points.length <= 2) return points

    const consolidated: LatLng[] = [points[0]] // Always keep first point
    let i = 1

    while (i < points.length - 1) {
      const currentPoint = points[i]
      const nextPoint = points[i + 1]
      
      // Calculate direction change
      const directionChange = calculateDirectionChange([consolidated[consolidated.length - 1], currentPoint], nextPoint)
      
      // If direction change is small, skip this point
      if (directionChange < 20) { // 20 degrees threshold for post-processing
        i++
        continue
      }
      
      // Add the current point and move to next
      consolidated.push(currentPoint)
      i++
    }

    // Always keep the last point
    consolidated.push(points[points.length - 1])
    
    console.log(`Consolidated from ${points.length} to ${consolidated.length} points`)
    return consolidated
  }


  // Redraw when shapes change
  useEffect(() => {
    drawShapes()
  }, [drawShapes])

  // Clear all shapes
  const clearShapes = () => {
    // Clear local state
    setShapes([])
    setCurrentShape(null)
    setIsDrawing(false)
    
    // Notify parent to clear all shapes from map
    shapes.forEach(shape => {
      onShapeDelete?.(shape.id)
    })
  }

  // Delete a shape
  const deleteShape = (shapeId: string) => {
    const updatedShapes = shapes.filter(shape => shape.id !== shapeId)
    setShapes(updatedShapes)
    onShapeDelete?.(shapeId)
  }

  // Calculate Google Maps route distance for a shape
  const calculateRouteDistance = useCallback(async (shape: DrawnShape) => {
    if (shape.points.length < 2) return 0

    try {
      const routeResult = await getShapeRoute(shape.points)
      return routeResult?.distance || 0
    } catch (error) {
      console.error('Error calculating route distance:', error)
      return 0
    }
  }, [])

  // Calculate route distances for all shapes
  const calculateAllRouteDistances = useCallback(async () => {
    if (shapes.length === 0) return

    setIsCalculatingRoute(true)
    const newDistances = new Map<string, number>()

    for (const shape of shapes) {
      const distance = await calculateRouteDistance(shape)
      newDistances.set(shape.id, distance)
    }

    setRouteDistances(newDistances)
    setIsCalculatingRoute(false)
  }, [shapes, calculateRouteDistance])

  // Check if Google Maps is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (typeof window !== 'undefined' && window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true)
      } else {
        setTimeout(checkGoogleMaps, 500)
      }
    }
    checkGoogleMaps()
  }, [])

  // Calculate route distances when shapes change
  useEffect(() => {
    if (shapes.length > 0 && isGoogleMapsLoaded) {
      calculateAllRouteDistances()
    }
  }, [shapes, calculateAllRouteDistances, isGoogleMapsLoaded])

  // Handle distance input change
  const handleDistanceChange = (distance: number) => {
    setTargetDistance(distance)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Draw Running Route
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Draw a shape around your location (green marker) to create a running route. The shape will automatically scale to match your target distance.
        </p>
        
        {/* Distance Input */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Target Distance:
            </label>
            <input
              type="number"
              value={targetDistance}
              onChange={(e) => handleDistanceChange(Number(e.target.value))}
              min="100"
              max="50000"
              step="100"
              className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">meters</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            The shape will be scaled to this distance when displayed on the map
          </p>
          
          {/* Route Distance Info */}
          {shapes.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Google Maps Route Distance:
                </span>
                {!isGoogleMapsLoaded ? (
                  <span className="text-sm text-yellow-600 dark:text-yellow-300">Loading Google Maps...</span>
                ) : isCalculatingRoute ? (
                  <span className="text-sm text-blue-600 dark:text-blue-300">Calculating...</span>
                ) : (
                  <span className="text-sm text-blue-600 dark:text-blue-300">
                    {Array.from(routeDistances.values()).reduce((sum, dist) => sum + dist, 0).toFixed(0)}m
                  </span>
                )}
              </div>
              <button
                onClick={calculateAllRouteDistances}
                disabled={isCalculatingRoute || !isGoogleMapsLoaded}
                className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {!isGoogleMapsLoaded ? 'Loading...' : isCalculatingRoute ? 'Calculating...' : 'Recalculate Routes'}
              </button>
            </div>
          )}
        </div>
        
        {/* Drawing mode indicator */}
        <div className="mb-4 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Smart Freehand Drawing
            </span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-300 mt-1">
            Click and drag to draw your running route. Points are automatically consolidated based on direction changes.
          </p>
        </div>

        {/* Canvas */}
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="cursor-crosshair"
            style={{ display: 'block' }}
          />
        </div>

        {/* Scale indicator */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Scale: 1 pixel = 1m | Canvas: {width}m × {height}m
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={clearShapes}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Clear All
          </button>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            {shapes.length} shape{shapes.length !== 1 ? 's' : ''} drawn
          </div>
        </div>
      </div>

      {/* Shape list */}
      {shapes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Drawn Shapes:
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {shapes.map((shape) => (
              <div
                key={shape.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: shape.color || '#3b82f6' }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {shape.type} ({shape.points.length} points)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDirections(shape)}
                    className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Directions
                  </button>
                  <button
                    onClick={() => deleteShape(shape.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directions Modal */}
      {showDirections && (
        <Directions
          shape={showDirections}
          userLocation={userLocation}
          onClose={() => setShowDirections(null)}
        />
      )}
    </div>
  )
}
