export interface RunData {
  id: string;
  date: string;
  duration: number; // in milliseconds
  distance: number; // in meters
  averagePace: number; // in seconds per km
  route: LatLng[]; // array of coordinates
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RunStats {
  distance: number; // in meters
  duration: number; // in milliseconds
  averagePace: number; // in seconds per km
}

export interface MapPosition {
  lat: number;
  lng: number;
  zoom: number;
}

export interface RunState {
  isRunning: boolean;
  currentPosition: LatLng | null;
  route: LatLng[];
  startTime: Date | null;
  elapsedTime: number; // in milliseconds
}

export interface DrawnShape {
  id: string;
  type: 'polygon' | 'freehand' | 'rectangle' | 'circle';
  points: LatLng[];
  name?: string;
  color?: string;
  targetDistance?: number;
}
