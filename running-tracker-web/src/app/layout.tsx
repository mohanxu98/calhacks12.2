import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Runr',
  description: 'Track your runs with GPS and view your progress',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <a href="/landing" className="text-base font-semibold text-gray-900 dark:text-white">
                  Runr
                </a>
                <div className="flex items-center gap-6 text-sm">
                  <a href="/" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">App</a>
                  <a href="/route-planner" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Route Planner</a>
                  <a href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Dashboard</a>
                </div>
              </div>
            </nav>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
