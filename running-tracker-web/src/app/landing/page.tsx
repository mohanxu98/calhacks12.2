import Link from 'next/link'

export default function LandingPage() {
  // Random map preview location (avoids poles)
  const lat = Math.random() * 120 - 60
  const lon = Math.random() * 360 - 180
  const dLat = 0.02
  const dLon = 0.02
  const bbox = `${(lon - dLon).toFixed(4)},${(lat - dLat).toFixed(4)},${(lon + dLon).toFixed(4)},${(lat + dLat).toFixed(4)}`
  const marker = `${lat.toFixed(4)},${lon.toFixed(4)}`
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">


      {/* Hero */}
      <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Run the route you planned.
              </h1>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-prose">
                Draw a route, set a distance, and follow clear, turn‑by‑turn directions. No fluff—just the tools you need.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/" className="px-5 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">
                  Start Running
                </Link>
                <Link href="/route-planner" className="px-5 py-3 rounded-md border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800">
                  Try Route Planner
                </Link>
              </div>
            </div>
            <div>
              <div className="rounded-2xl bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-[1px] shadow-xl">
                <div className="relative rounded-2xl overflow-hidden bg-white/80 dark:bg-gray-900/80">
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-xs font-medium bg-black/70 text-white backdrop-blur">
                    Preview
                  </div>
                  <div className="aspect-[16/10]">
                    <iframe
                      title="Runr preview map"
                      className="w-full h-full"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`}
                      style={{ border: 0 }}
                    />
                    {/* Vignette overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-black/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="Draw routes"
              desc="Freehand near your location. We preserve your point order."
              icon={
                <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a3 3 0 1 1 6 0v1h6a3 3 0 1 1 0 6H9v5a3 3 0 1 1-6 0V6z"/></svg>
              }
            />
            <FeatureCard
              title="Distance fit"
              desc="We scale and re‑route to match your target distance."
              icon={
                <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M4 12h16M4 6h10M4 18h10"/></svg>
              }
            />
            <FeatureCard
              title="Voice directions"
              desc="Short prompts with auto‑advance and arrival notice."
              icon={
                <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v18m9-9H3"/></svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Step n={1} title="Draw your shape" desc="Sketch the path you want. We’ll preserve your point order." />
            <Step n={2} title="Auto‑fit distance" desc="We scale and re‑route to match your target distance precisely." />
            <Step n={3} title="Run with guidance" desc="Start the run and follow the voice directions—hands‑free." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Ready to run?</h2>
            <p className="mt-2 text-gray-700 dark:text-gray-300">Open the app and create your first exact‑distance route.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/" className="px-5 py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700">Open App</Link>
              <Link href="/route-planner" className="px-5 py-3 rounded-md border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800">Plan a Route</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">© {new Date().getFullYear()} Runr</p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">App</Link>
            <Link href="/route-planner" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Route Planner</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/5 p-6 ring-1 ring-black/5 dark:ring-white/10 hover:shadow-lg transition-shadow">
      <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{desc}</p>
    </div>
  )
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl bg-white/70 dark:bg-white/5 p-6 ring-1 ring-black/5 dark:ring-white/10">
      <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold grid place-items-center shadow-md">{n}</div>
      <h4 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h4>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{desc}</p>
    </div>
  )
}
