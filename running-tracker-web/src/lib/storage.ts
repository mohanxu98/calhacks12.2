import { RunData, DrawnShape } from '@/types'

const STORAGE_KEY = 'running-tracker-runs'
const SHAPES_STORAGE_KEY = 'running-tracker-shapes'

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

// Shape management functions
export function saveShapes(shapes: DrawnShape[]): void {
  try {
    localStorage.setItem(SHAPES_STORAGE_KEY, JSON.stringify(shapes))
  } catch (error) {
    console.error('Error saving shapes:', error)
  }
}

export function getShapes(): DrawnShape[] {
  try {
    const shapes = localStorage.getItem(SHAPES_STORAGE_KEY)
    return shapes ? JSON.parse(shapes) : []
  } catch (error) {
    console.error('Error loading shapes:', error)
    return []
  }
}

export function saveShape(shape: DrawnShape): void {
  try {
    const existingShapes = getShapes()
    const updatedShapes = [...existingShapes, shape]
    saveShapes(updatedShapes)
  } catch (error) {
    console.error('Error saving shape:', error)
  }
}

export function deleteShape(shapeId: string): void {
  try {
    const existingShapes = getShapes()
    const updatedShapes = existingShapes.filter(shape => shape.id !== shapeId)
    saveShapes(updatedShapes)
  } catch (error) {
    console.error('Error deleting shape:', error)
  }
}

export function clearAllShapes(): void {
  localStorage.removeItem(SHAPES_STORAGE_KEY)
}
