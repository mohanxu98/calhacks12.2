'use client'

import { useState, useEffect } from 'react'
import { RouteStep, generateRoute, shapeToWaypoints } from '@/lib/routing'
import { DrawnShape, LatLng } from '@/types'
import { getDetailedRouteInfo } from '@/lib/googleMapsRouting'

interface DirectionsProps {
  shape: DrawnShape
  userLocation: LatLng
  onClose: () => void
}

export default function Directions({ shape, userLocation, onClose }: DirectionsProps) {
  const [route, setRoute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const generateDirections = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try Google Maps first
        const googleRoute = await getDetailedRouteInfo(shape.points)
        if (googleRoute) {
          setRoute(googleRoute)
          return
        }
        
        // Fallback to mock routing
        const waypoints = shapeToWaypoints(shape.points, userLocation)
        const routeResult = await generateRoute(waypoints)
        
        if (routeResult && routeResult.routes.length > 0) {
          setRoute(routeResult.routes[0])
        } else {
          setError('Unable to generate directions for this route')
        }
      } catch (err) {
        console.error('Error generating directions:', err)
        setError('Failed to generate directions')
      } finally {
        setLoading(false)
      }
    }

    generateDirections()
  }, [shape, userLocation])

  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${distance}m`
    }
    return `${(distance / 1000).toFixed(1)}km`
  }

  // Remove duration formatting since we don't want to show time estimates

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-gray-700 dark:text-gray-300">Generating directions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Unable to Generate Directions
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!route) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Running Directions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDistance(route.distance)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Route Summary */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-700 dark:text-gray-300">Start</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-gray-700 dark:text-gray-300">Finish</span>
            </div>
          </div>
        </div>

        {/* Directions List */}
        <div className="overflow-y-auto max-h-96">
          {route.steps.map((step: RouteStep, index: number) => (
            <div
              key={index}
              className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                currentStep === index
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => setCurrentStep(index)}
            >
              <div className="flex items-start">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-3 flex-shrink-0 ${
                  currentStep === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    {step.instruction}
                  </p>
                  <div className="flex items-center mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <span>{formatDistance(step.distance)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep + 1} of {route.steps.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentStep(Math.min(route.steps.length - 1, currentStep + 1))}
                disabled={currentStep === route.steps.length - 1}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
