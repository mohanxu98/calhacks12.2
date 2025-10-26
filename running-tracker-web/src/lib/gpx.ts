import { RunData } from '@/types'

export function exportRunAsGPX(run: RunData): string {
  const formatTime = (date: Date): string => {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Runr" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <time>${formatTime(new Date(run.date))}</time>
  </metadata>
  <trk>
    <name>Run on ${new Date(run.date).toLocaleDateString()}</name>
    <trkseg>
${run.route.map((point, index) => `      <trkpt lat="${point.lat}" lon="${point.lng}">
        <ele>0</ele>
        <time>${formatTime(new Date(run.date.getTime() + (index * (run.duration / run.route.length))))}</time>
      </trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`

  return gpx
}

export function downloadGPX(gpxContent: string, filename: string): void {
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
