
export interface GridSize {
  x: number;
  y: number;
  z: number;
}

// Data[Time][Z][Y][X] - Brightness 0-255
export type VoxelFrame = number[][][];
export type VoxelData = VoxelFrame[];

export type PresetType = 'wave' | 'scan' | 'random' | 'pulse' | 'clear' | 'rain' | 'sphere' | 'spiral' | 'fireworks' | 'audio' | 'fountain' | 'cube' | 'dna' | 'plasma';

export interface PlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  speedMultiplier: number; // 0.5 to 4
  fps: number; // Base FPS
}

export interface AppConfig {
  bloomEnabled: boolean;
  autoInterpolation: boolean;
  gridColor: string;
  brightnessMultiplier: number;
  audioEnabled: boolean;
  audioThreshold: number;
}

export interface AIReponsePattern {
  name: string;
  description: string;
  data: VoxelData;
}

export interface HistoryItem {
  id: string;
  name: string;
  description: string;
  data: VoxelData;
  gridSize: GridSize;
  timestamp: number;
}
