import { RunData } from '@/types'

const STORAGE_KEY = 'running-tracker-runs'

export function saveRun(runData: Omit<RunData, 'id'>): RunData {
  const runs = getRuns()
  const newRun: RunData = {
    ...runData,
    id: generateId(),
  }

  runs.push(newRun)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs))
  return newRun
}

export function getRuns(): RunData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading runs from localStorage:', error)
    return []
  }
}

export function deleteRun(id: string): void {
  const runs = getRuns()
  const filteredRuns = runs.filter(run => run.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRuns))
}

export function clearAllRuns(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
