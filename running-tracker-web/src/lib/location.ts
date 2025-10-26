import { LatLng } from '@/types'

function getNavigatorLocation(options?: PositionOptions): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => reject(err),
      options || { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  })
}

async function getGoogleGeolocation(): Promise<LatLng | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return null
    const res = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true })
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
      return { lat: data.location.lat, lng: data.location.lng }
    }
    return null
  } catch {
    return null
  }
}

export async function getBestEffortLocation(): Promise<LatLng | null> {
  try {
    const loc = await getNavigatorLocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
    return loc
  } catch {
    // Fallback to Google Geolocation API (approximate, IP-based if no wifi/cell info)
    const google = await getGoogleGeolocation()
    return google
  }
}


