import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { GridSize, VoxelData } from '../types';

// Extend the JSX namespace to include Three.js elements
// declare global {
//   namespace JSX {
//     interface IntrinsicElements {
//       instancedMesh: any;
//       sphereGeometry: any;
//       meshBasicMaterial: any;
//       gridHelper: any;
//       color: any;
//     }
//   }
// }

interface VoxelSceneProps {
  data: VoxelData;
  currentFrame: number;
  gridSize: GridSize;
  bloomEnabled: boolean;
  ledColor: string;
  brightnessMultiplier: number; // 0-255
}

const VoxelScene: React.FC<VoxelSceneProps> = ({ data, currentFrame, gridSize, bloomEnabled, ledColor, brightnessMultiplier }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Add dataRef to track data object identity changes
  const lastUpdateRef = useRef({ frame: -1, color: '', brightness: -1, grid: '', data: null as VoxelData | null });
  
  const count = gridSize.x * gridSize.y * gridSize.z;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  const targetColor = useMemo(() => new THREE.Color(ledColor), [ledColor]);
  const offColor = useMemo(() => new THREE.Color(0.015, 0.015, 0.015), []); 

  useEffect(() => {
    if (!meshRef.current) return;
    let i = 0;
    const offsetX = (gridSize.x - 1) / 2;
    const offsetY = (gridSize.y - 1) / 2;
    const offsetZ = (gridSize.z - 1) / 2;

    for (let z = 0; z < gridSize.z; z++) {
      for (let y = 0; y < gridSize.y; y++) {
        for (let x = 0; x < gridSize.x; x++) {
          dummy.position.set(x - offsetX, y - offsetY, z - offsetZ);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
          meshRef.current.setColorAt(i, offColor);
          i++;
        }
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
    lastUpdateRef.current.grid = `${gridSize.x}-${gridSize.y}-${gridSize.z}`;
    lastUpdateRef.current.frame = -1; // Reset to force update
    lastUpdateRef.current.data = null; 
  }, [gridSize, dummy, offColor]);

  useFrame(() => {
    if (!meshRef.current || !data[currentFrame]) return;
    
    // Performance Guard: Skip update if nothing meaningful changed
    // CRITICAL FIX: Check if data reference has changed. If the AI loads new data, 
    // we must update even if the frame number happens to be the same (e.g., 0).
    if (
      lastUpdateRef.current.frame === currentFrame && 
      lastUpdateRef.current.color === ledColor && 
      lastUpdateRef.current.brightness === brightnessMultiplier &&
      lastUpdateRef.current.data === data 
    ) return;

    const frameData = data[currentFrame];
    let i = 0;
    lastUpdateRef.current.frame = currentFrame;
    lastUpdateRef.current.color = ledColor;
    lastUpdateRef.current.brightness = brightnessMultiplier;
    lastUpdateRef.current.data = data;

    const intensityFactor = (brightnessMultiplier / 255) * 45.0;

    // Cache local variables for hot loop performance
    const mesh = meshRef.current;
    const zLen = gridSize.z;
    const yLen = gridSize.y;
    const xLen = gridSize.x;

    for (let z = 0; z < zLen; z++) {
      const zData = frameData[z];
      for (let y = 0; y < yLen; y++) {
        const yData = zData ? zData[y] : null;
        for (let x = 0; x < xLen; x++) {
          const brightnessValue = yData ? yData[x] : 0;
          
          if (brightnessValue <= 2) {
            mesh.setColorAt(i, offColor);
          } else {
            const normalized = brightnessValue / 255;
            const intensity = Math.pow(normalized, 1.1) * intensityFactor;
            colorObj.copy(targetColor).multiplyScalar(intensity); 
            mesh.setColorAt(i, colorObj);
          }
          i++;
        }
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={['#000000']} />
      
      <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <gridHelper args={[64, 64, 0x121212, 0x080808]} position={[0, -gridSize.y/2 - 1.2, 0]} />
      
      {bloomEnabled && (
        <EffectComposer enableNormalPass={false}>
          <Bloom 
            luminanceThreshold={0.05} 
            mipmapBlur 
            intensity={Math.max(1.5, (brightnessMultiplier / 255) * 4.5)} 
            radius={0.8} 
          />
        </EffectComposer>
      )}

      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </>
  );
};

export default VoxelScene;