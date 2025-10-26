'use client'

import { useState, useEffect, useRef } from 'react'
import { RouteStep, generateRoute, shapeToWaypoints } from '@/lib/routing'
import { DrawnShape, LatLng } from '@/types'
import { getDetailedRouteInfo } from '@/lib/googleMapsRouting'

interface DirectionsProps {
  shape: DrawnShape
  userLocation: LatLng
  currentPosition?: LatLng | null
  onClose: () => void
}

export default function Directions({ shape, userLocation, currentPosition, onClose }: DirectionsProps) {
  const [route, setRoute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const voiceAutoEnabledRef = useRef<boolean>(false)
  const arrivalSpokenRef = useRef<boolean>(false)
  const [steps, setSteps] = useState<Array<{ instruction: string; distanceMeters: number; start?: LatLng; end?: LatLng }>>([])
  const [totalMeters, setTotalMeters] = useState<number>(0)

  useEffect(() => {
    const generateDirections = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try Google Maps first
        const googleRoute = await getDetailedRouteInfo(shape.points)
        if (googleRoute) {
          setRoute(googleRoute)
          // Build merged steps from Google route
          const merged = mergeConsecutiveSteps(googleRoute.steps)
          setSteps(merged)
          setTotalMeters(merged.reduce((s, st) => s + st.distanceMeters, 0))
          return
        }
        
        // Fallback to mock routing
        const waypoints = shapeToWaypoints(shape.points, userLocation)
        const routeResult = await generateRoute(waypoints)
        
        if (routeResult && routeResult.routes.length > 0) {
          const r0 = routeResult.routes[0]
          setRoute(r0)
          const merged = mergeConsecutiveSteps(r0.steps)
          setSteps(merged)
          setTotalMeters(merged.reduce((s, st) => s + st.distanceMeters, 0))
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

  // Normalize instruction for comparison
  const normalizeInstruction = (s: string | undefined): string => {
    if (!s) return ''
    return s.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
  }

  // Parse distance that may be a number or a string like "120 m" or "0.2 km"
  const toMeters = (d: any): number => {
    if (typeof d === 'number' && isFinite(d)) return d
    if (typeof d === 'string') {
      const str = d.trim().toLowerCase()
      if (str.includes('km')) {
        const v = parseFloat(str.replace(/[^0-9.\-]/g, ''))
        return isFinite(v) ? v * 1000 : 0
      }
      // default meters
      const v = parseFloat(str.replace(/[^0-9.\-]/g, ''))
      return isFinite(v) ? v : 0
    }
    return 0
  }

  // Merge consecutive steps with identical instructions, summing distances, preserving start/end
  const mergeConsecutiveSteps = (rawSteps: any[]): Array<{ instruction: string; distanceMeters: number; start?: LatLng; end?: LatLng }> => {
    const out: Array<{ instruction: string; distanceMeters: number; start?: LatLng; end?: LatLng }> = []
    for (const st of rawSteps || []) {
      const instruction = (st?.instruction ?? '').toString()
      const norm = normalizeInstruction(instruction)
      const distanceMeters = toMeters(st?.distance)
      const start = (st as any)?.start as LatLng | undefined
      const end = (st as any)?.end as LatLng | undefined
      if (out.length > 0 && normalizeInstruction(out[out.length - 1].instruction) === norm) {
        out[out.length - 1].distanceMeters += distanceMeters
        if (end) out[out.length - 1].end = end
      } else {
        out.push({ instruction, distanceMeters, start, end })
      }
    }
    return out
  }

  // Speak a given text if voice is enabled and API available
  const speak = (text: string) => {
    try {
      if (!voiceEnabled) return
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
      const utterance = new SpeechSynthesisUtterance(text)
      if (selectedVoice) utterance.voice = selectedVoice
      utterance.rate = 1
      utterance.volume = 1
      window.speechSynthesis.cancel()
      try { window.speechSynthesis.resume() } catch (_) {}
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      // ignore speech errors
    }
  }

  // Load voices and pick a default
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => {
      const v = window.speechSynthesis.getVoices()
      setVoices(v)
      const preferred = v.find(voice => /en-US|en_GB|en-/.test(voice.lang)) || v[0] || null
      setSelectedVoice(preferred)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      window.speechSynthesis.onvoiceschanged = null as any
    }
  }, [])

  // On route ready, announce first instruction (optional)
  useEffect(() => {
    if (steps && steps.length > 0) {
      setCurrentStep(0)
      const first = steps[0]
      // Auto-enable voice on first load, then speak immediately
      if (!voiceAutoEnabledRef.current) {
        setVoiceEnabled(true)
        voiceAutoEnabledRef.current = true
      }
      arrivalSpokenRef.current = false
      speak(`Start. ${first.instruction}`)
    }
  }, [steps])

  // Calculate haversine distance
  const calculateDistance = (a: LatLng, b: LatLng): number => {
    const R = 6371e3
    const φ1 = (a.lat * Math.PI) / 180
    const φ2 = (b.lat * Math.PI) / 180
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180
    const c = 2 * Math.atan2(Math.sqrt(Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2), Math.sqrt(1 - (Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2)))
    return R * c
  }

  // Auto-advance step based on proximity to current step end
  useEffect(() => {
    if (!autoAdvanceEnabled) return
    if (!steps || steps.length === 0) return
    if (!currentPosition) return
    const step = steps[currentStep]
    if (!step) return
    const end = step.end as LatLng | undefined
    if (!end) return
    const dist = calculateDistance(currentPosition, end)
    const threshold = 25 // meters
    if (dist <= threshold && currentStep < steps.length - 1) {
      const nextIndex = currentStep + 1
      setCurrentStep(nextIndex)
      const nextStep = steps[nextIndex]
      speak(nextStep?.instruction || '')
    } else if (dist <= threshold && currentStep === steps.length - 1 && !arrivalSpokenRef.current) {
      // Final step reached
      arrivalSpokenRef.current = true
      speak('You have reached your destination')
    }
  }, [currentPosition, currentStep, autoAdvanceEnabled, steps])

  // Handlers for controls
  const handleToggleVoice = (checked: boolean) => {
    setVoiceEnabled(checked)
    if (checked) {
      // Provide immediate audible confirmation and re-announce current step
      const msg = route?.steps?.[currentStep]?.instruction
      speak(msg ? `Voice enabled. ${msg}` : 'Voice enabled')
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }

  const handleTestVoice = () => {
    speak('Test. Voice is working.')
  }

  const handleNextStep = () => {
    if (!steps) return
    const nextIndex = Math.min(steps.length - 1, currentStep + 1)
    setCurrentStep(nextIndex)
    const nextStep = steps[nextIndex]
    if (nextStep?.instruction) speak(nextStep.instruction)
  }

  const handleEndNavigation = () => {
    arrivalSpokenRef.current = true
    speak('Navigation ended')
    onClose()
  }

  const formatDistance = (distance: number): string => {
    if (distance < 1000) {
      return `${distance}m`
    }
    return `${(distance / 1000).toFixed(1)}km`
  }

  // Remove duration formatting since we don't want to show time estimates

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Running Directions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDistance(totalMeters)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={(e) => handleToggleVoice(e.target.checked)}
                />
                Voice
              </label>
              <button
                onClick={() => {
                  const msg = route?.steps?.[currentStep]?.instruction
                  speak(msg || 'Speaking current direction')
                }}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                title="Speak the current step now"
              >
                Speak
              </button>
              <button
                onClick={handleTestVoice}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title="Play a short test"
              >
                Test
              </button>
              <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoAdvanceEnabled}
                  onChange={(e) => setAutoAdvanceEnabled(e.target.checked)}
                />
                Auto-advance
              </label>
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
          {steps.map((step, index: number) => (
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
                    <span>{formatDistance(step.distanceMeters)}</span>
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
              Step {currentStep + 1} of {steps.length}
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
                onClick={handleNextStep}
                disabled={currentStep === steps.length - 1}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={handleEndNavigation}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                End Navigation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
