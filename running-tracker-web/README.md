# Running Tracker

A modern, full-featured running tracker web application built with Next.js, TypeScript, and OpenStreetMap. Track your runs with GPS, view detailed statistics, and analyze your progress over time.

## Features

### Core Features ✅
- **Interactive Map**: Real-time GPS tracking with OpenStreetMap integration via Leaflet.js
- **Live Run Tracking**: Start/Stop run functionality with live position updates
- **Real-time Stats**: Distance, elapsed time, and average pace calculated in real-time
- **Run History**: Complete run history stored locally in browser storage
- **Dashboard**: Comprehensive dashboard with statistics and run history
- **Responsive Design**: Clean, minimal fitness app aesthetic with Tailwind CSS

### Bonus Features ✅
- **Dark Mode**: Toggle between light and dark themes with system preference detection
- **GPX Export**: Export your runs as GPX files for use in other fitness apps (Strava, Garmin, etc.)
- **Pace Chart**: Visual progress tracking showing pace improvement over time using Recharts
- **Confirmation Dialog**: Prevents accidental run stops with confirmation prompt
- **No Backend Required**: Fully functional in the browser with localStorage
- **Mobile Friendly**: Responsive design works great on mobile devices

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **Charts**: Recharts for data visualization
- **State Management**: React hooks (useState, useEffect)
- **Storage**: Browser localStorage

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn package manager

### Installation

1. **Clone or download the project**
   ```bash
   cd running-tracker-web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Starting a Run
1. **Enable Location Services**: Make sure your browser has location access enabled
2. **Click "Start Run"**: The map will center on your current location
3. **Run**: Your route will be tracked in real-time with a blue line on the map
4. **View Stats**: See your distance, time, and pace update live
5. **Stop Run**: Click "Stop Run" to finish and save your run data

### Viewing Your Data
- **Dashboard**: View your complete run history and statistics
- **Statistics**: Total runs, distance, time, and average pace
- **Export**: Download individual runs as GPX files
- **Progress**: Track your pace improvement with the built-in chart

### Theme
- **Toggle**: Use the theme toggle in the navigation to switch between light and dark modes

## Project Structure

```
running-tracker/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Dashboard page
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main map page
│   ├── components/
│   │   ├── Map.tsx               # Leaflet map component
│   │   ├── PaceChart.tsx         # Progress visualization
│   │   ├── RunControls.tsx       # Start/Stop buttons
│   │   ├── RunStats.tsx          # Live run statistics
│   │   ├── ThemeProvider.tsx     # Theme context
│   │   └── ThemeToggle.tsx       # Theme switcher
│   ├── lib/
│   │   ├── gpx.ts                # GPX export utilities
│   │   └── storage.ts            # localStorage operations
│   └── types/
│       └── index.ts              # TypeScript interfaces
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Key Components

### Map Component
- Integrates Leaflet.js with OpenStreetMap
- Real-time GPS position tracking
- Dynamic route rendering with polyline
- Custom position markers

### Run Tracking
- GPS coordinate collection every few seconds
- Haversine formula for accurate distance calculation
- Real-time pace and distance calculations
- Automatic run data persistence

### Dashboard Features
- Run history with detailed statistics
- Summary cards with totals
- GPX export functionality
- Pace progression visualization

## Browser Compatibility

- Modern browsers with Geolocation API support
- Chrome, Firefox, Safari, Edge (recent versions)
- Mobile browsers with GPS capabilities

## Privacy & Data

- **No Account Required**: Runs entirely in your browser
- **Local Storage Only**: All data stored locally in browser localStorage
- **No Data Collection**: No personal data sent to external servers
- **Export Control**: Full control over your run data with GPX export

## Contributing

This is a complete, functional running tracker application. Feel free to:
- Fork and modify for personal use
- Add additional features
- Improve the UI/UX
- Optimize performance

## License

This project is open source and available under the [MIT License](LICENSE).
