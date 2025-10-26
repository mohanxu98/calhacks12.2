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
          className="btn-primary px-8 py-3 text-lg font-semibold"
        >
          Start Run
        </button>
      ) : (
        <>
          <button
            onClick={handleStopClick}
            className="btn-danger px-8 py-3 text-lg font-semibold"
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
