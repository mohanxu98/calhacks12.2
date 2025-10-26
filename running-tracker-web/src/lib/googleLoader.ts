declare global {
  interface Window {
    google: any
  }
}

let googleMapsLoadingPromise: Promise<void> | null = null

export function loadGoogleMaps(libraries: string[] = ['geometry']): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google && window.google.maps) return Promise.resolve()
  if (googleMapsLoadingPromise) return googleMapsLoadingPromise

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'))

  // If a script tag already exists, reuse and wait
  const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src.includes('maps.googleapis.com/maps/api/js'))
  if (existing) {
    googleMapsLoadingPromise = new Promise<void>((resolve) => {
      const check = () => {
        if (window.google && window.google.maps) resolve()
        else setTimeout(check, 100)
      }
      check()
    })
    return googleMapsLoadingPromise
  }

  googleMapsLoadingPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries.join(',')}`
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    script.onload = () => {
      // wait one tick for availability
      setTimeout(() => resolve(), 50)
    }
    document.head.appendChild(script)
  })

  return googleMapsLoadingPromise
}


