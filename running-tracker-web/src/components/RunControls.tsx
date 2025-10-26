'use client'

import { useState } from 'react'

interface RunControlsProps {
  isRunning: boolean
  onStart: () => void
  onStop: () => void
}

export function RunControls({ isRunning, onStart, onStop }: RunControlsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleStopClick = () => {
    setShowConfirmDialog(true)
  }

  const handleConfirmStop = () => {
    onStop()
    setShowConfirmDialog(false)
  }

  const handleCancelStop = () => {
    setShowConfirmDialog(false)
  }

  return (
    <div className="flex items-center justify-center space-x-4">
      {!isRunning ? (
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-blue-600 text-white text-base sm:text-lg font-semibold shadow-sm hover:bg-blue-700 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 transition"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.5 5.5v9l8-4.5-8-4.5z" />
          </svg>
          Start Run
        </button>
      ) : (
        <>
          <button
            onClick={handleStopClick}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full bg-red-600 text-white text-base sm:text-lg font-semibold shadow-sm hover:bg-red-700 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 transition"
          >
            Stop Run
          </button>

          {/* Confirmation Dialog */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Stop Run?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Are you sure you want to stop this run? Your current progress will be saved.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmStop}
                    className="btn-danger flex-1"
                  >
                    Yes, Stop
                  </button>
                  <button
                    onClick={handleCancelStop}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
