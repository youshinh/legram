
import { GridSize, VoxelData, VoxelFrame, PresetType } from '../types';

const createEmptyFrame = (size: GridSize): VoxelFrame => {
  return Array.from({ length: size.z }, () =>
    Array.from({ length: size.y }, () =>
      Array.from({ length: size.x }, () => 0)
    )
  );
};

// Default frames set to 32 (2 bars of 4/4 at 4 frames/beat)
export const generatePattern = (type: PresetType, size: GridSize, frames: number = 32): VoxelData => {
  const data: VoxelData = [];
  const cx = size.x / 2;
  const cy = size.y / 2;
  const cz = size.z / 2;

  for (let t = 0; t < frames; t++) {
    const frame = createEmptyFrame(size);
    
    // Normalized time 0.0 to 1.0 representing 2 bars
    const progress = t / frames;
    const phase = progress * Math.PI * 2; 

    for (let z = 0; z < size.z; z++) {
      for (let y = 0; y < size.y; y++) {
        for (let x = 0; x < size.x; x++) {
          let val = 0;
          const dx = x - cx + 0.5;
          const dy = y - cy + 0.5;
          const dz = z - cz + 0.5;

          switch (type) {
            case 'random':
              // Sync chaos level changes to 16th notes
              const tStep = Math.floor(t / 2); 
              const seed = Math.sin(x * 12.9 + y * 78.2 + z * 37.7 + tStep * 13.1) * 43758.5;
              val = (seed - Math.floor(seed)) > 0.92 ? 255 : 0;
              break;

            case 'wave':
              // 2 bars = 2 full waves (1 wave per bar)
              const d = Math.sqrt(dx * dx + dz * dz);
              // phase * 2 ensures 2 cycles over 32 frames
              const waveY = Math.sin(d * 0.5 - phase * 2) * (size.y * 0.35) + cy;
              val = Math.max(0, 255 - Math.abs(y - waveY) * 150);
              break;

            case 'scan':
              // 2 bars = 2 full scans (1 scan per bar)
              // Use sawtooth-like wave or sin for scan
              const scanPhase = (phase * 2) % (Math.PI * 2);
              const scanPos = ((Math.sin(scanPhase) + 1) / 2) * (size.z - 1);
              val = Math.max(0, 255 - Math.abs(z - scanPos) * 200);
              // Add a secondary scan line for visual interest
              const scanPos2 = ((Math.cos(scanPhase) + 1) / 2) * (size.x - 1);
              val = Math.max(val, 255 - Math.abs(x - scanPos2) * 200);
              break;

            case 'pulse':
              // Slowed down to half speed (every 2 beats / 8 frames) based on user request
              // phase * 4 = 4 cycles over 32 frames
              const beatPhase = (phase * 4) % (Math.PI * 2);
              // Power 4 makes the pulse sharp but visible
              const pulseStrength = Math.pow(Math.max(0, Math.sin(beatPhase - Math.PI/2)), 4); 
              const pR = pulseStrength * Math.min(cx, cy, cz) * 1.2;
              const distP = Math.sqrt(dx*dx + dy*dy + dz*dz);
              // Create a hollow shell that expands
              val = Math.max(0, 255 - Math.abs(distP - pR) * 200);
              // Add core flash on beat
              if (distP < 1.0 && pulseStrength > 0.8) val = 255;
              break;

            case 'rain':
              // Continuous loop, speed adjusted to look natural but fast
              const rainSeed = (x * 17.3 + z * 31.7);
              const rainRand = (Math.sin(rainSeed) * 0.5 + 0.5);
              const rainSpeed = 1.0 + rainRand * 0.5; // Faster rain
              // Loop rain smoothly
              const dropY = (size.y * 1.5 - ((t * rainSpeed + rainRand * size.y) % (size.y * 1.5)));
              
              if (Math.abs(y - dropY) < 1.0) {
                val = 255; 
              } else if (y > dropY && y < dropY + 2.5) {
                val = 150 * (1 - (y - dropY) / 2.5);
              }
              break;

            case 'sphere':
              // Breathe once per bar (2 cycles total)
              const sphereDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              // Reduced max size to approx 85% of previous (0.7 -> 0.6 max) to prevent visual clipping
              const breathR = (Math.sin(phase * 2) * 0.2 + 0.4) * Math.min(size.x, size.y, size.z);
              val = Math.max(0, 255 - Math.abs(sphereDist - breathR) * 120);
              break;

            case 'spiral':
              // Rotate twice per 32 frames (1 rotation per bar)
              const angle = Math.atan2(dz, dx);
              const spiralY = ((angle + phase * 2) / (Math.PI * 2) * size.y * 2) % size.y;
              val = Math.max(0, 255 - Math.abs(y - spiralY) * 100);
              break;

            case 'fireworks':
              // 16 frames = 1 bar. Launch on beat 1.
              // Cycle 0-15 (Bar 1), 16-31 (Bar 2)
              const fwT = t % 16;
              const fwProgress = fwT / 16;
              
              if (fwT < 6) {
                // Rising (Frames 0-5)
                const riseY = (fwT / 6) * (size.y * 0.7);
                if (Math.abs(x - cx + 0.5) < 1 && Math.abs(z - cz + 0.5) < 1 && Math.abs(y - riseY) < 1.5) {
                   val = 255;
                }
              } else {
                // Explosion (Frames 6-15)
                const expP = (fwT - 6) / 10; // 0.0 to 1.0
                const expR = expP * Math.min(cx, cy, cz) * 2.0;
                const fwDist = Math.sqrt(dx*dx + (y - size.y*0.7)**2 + dz*dz);
                // Shell
                if (Math.abs(fwDist - expR) < 1.0) val = 255 * (1 - expP);
                // Sparkles
                if (Math.random() > 0.8 && fwDist < expR) val = 200 * (1 - expP);
              }
              break;

            case 'fountain':
              // Loop every bar (16 frames)
              const fCycle = (t % 16) / 16;
              const fY = fCycle * size.y;
              const fDist = Math.sqrt(dx*dx + dz*dz);
              // Cone shape expanding outward
              const coneR = fY * 0.6;
              
              // Rising water
              if (Math.abs(fDist - coneR) < 1.5 && Math.abs(y - fY) < 2) {
                val = 255 * (1 - fCycle * 0.5);
              }
              // Center column
              if (fDist < 1.0 && y < fY) val = 200;
              break;

            case 'cube':
              // Bouncing cube size, 1 bounce per bar (2 cycles)
              const side = ((Math.sin(phase * 2) + 1) / 2) * (Math.min(cx, cy, cz) * 0.7) + 1;
              const maxC = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
              // Wireframe-ish
              if (Math.abs(maxC - side) < 0.8) val = 255;
              // Fill slightly
              if (maxC < side) val = Math.max(val, 30);
              break;

            case 'dna':
              // Rotate once per 2 bars (slow rotation)
              const dnaA = (y / size.y) * Math.PI * 2 + phase;
              const dX1 = Math.cos(dnaA) * (size.x * 0.25) + cx;
              const dZ1 = Math.sin(dnaA) * (size.z * 0.25) + cz;
              const dX2 = Math.cos(dnaA + Math.PI) * (size.x * 0.25) + cx;
              const dZ2 = Math.sin(dnaA + Math.PI) * (size.z * 0.25) + cz;
              if (Math.sqrt((x-dX1)**2 + (z-dZ1)**2) < 0.8) val = 255;
              if (Math.sqrt((x-dX2)**2 + (z-dZ2)**2) < 0.8) val = 255;
              // Connecting rungs
              if (Math.abs(y % 2) < 0.5) {
                 // Check if point is on line between strands
                 // Simplify: Just draw lines at specific Ys
              }
              break;

            case 'plasma':
              // 2 cycles per 32 frames for active motion
              const pV = Math.sin(x * 0.5 + phase * 2) + Math.sin(y * 0.5 + phase * 3) + Math.sin(z * 0.5 + phase);
              val = (pV + 1.2) * 100;
              break;

            case 'clear':
              val = 0;
              break;
          }
          frame[z][y][x] = Math.floor(Math.max(0, Math.min(255, val)));
        }
      }
    }
    data.push(frame);
  }
  return data;
};
