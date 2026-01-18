
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles, Play, Pause, RotateCcw } from 'lucide-react';

import VoxelScene from './components/VoxelScene';
import Controls from './components/Controls';
import JsonEditor from './components/JsonEditor';
import GeminiPanel from './components/GeminiPanel';
import { generatePattern } from './utils/generators';
import { GridSize, VoxelData, PlaybackState, PresetType, VoxelFrame } from './types';

export default function App() {
  const [gridSize, setGridSize] = useState<GridSize>({ x: 8, y: 8, z: 8 });
  const [isDimensionsSynced, setIsDimensionsSynced] = useState(true);
  const [voxelData, setVoxelData] = useState<VoxelData>([]);
  const [bpm, setBpm] = useState(120);
  const [isBpmSync, setIsBpmSync] = useState(true);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentFrame: 0,
    speedMultiplier: 1,
    fps: 12,
  });
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [ledColor, setLedColor] = useState('#ffffff'); 
  const [brightnessMultiplier, setBrightnessMultiplier] = useState(50);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioThreshold, setAudioThreshold] = useState(30);
  
  const [showJson, setShowJson] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(window.innerWidth >= 768);
  
  // BPM Visual Feedback State
  const [bpmFeedback, setBpmFeedback] = useState<{ value: number, visible: boolean }>({ value: 120, visible: false });

  const timerRef = useRef<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const bpmTimeoutRef = useRef<number | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Generate 32 frames (2 bars at 4/4 time) for BPM sync
    const initialData = generatePattern('wave', gridSize, 32);
    setVoxelData(initialData);
    
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsControlsOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); 

  useEffect(() => {
    if (audioEnabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (playback.isPlaying && voxelData.length > 0) {
      // Logic: 60000ms / BPM / 4 = 16th note duration (assuming 4 frames per beat)
      // At 120 BPM: 60000 / 120 / 4 = 125ms per frame.
      // 32 frames * 125ms = 4000ms = 4 seconds = 2 bars (8 beats).
      const intervalMs = isBpmSync 
        ? (60000 / bpm / 4) / playback.speedMultiplier
        : (1000 / playback.fps) / playback.speedMultiplier;

      const safeInterval = Math.max(16, intervalMs);

      timerRef.current = window.setInterval(() => {
        setPlayback(prev => ({ 
          ...prev, 
          currentFrame: (prev.currentFrame + 1) % voxelData.length 
        }));
      }, safeInterval);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playback.isPlaying, playback.speedMultiplier, playback.fps, bpm, isBpmSync, voxelData.length, audioEnabled]);

  useEffect(() => {
    if (audioEnabled) {
      startAudio();
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [audioEnabled, gridSize]);

  const handleBpmTap = useCallback(() => {
    const now = performance.now();
    
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current[tapTimesRef.current.length - 1] > 2000) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);
    
    if (tapTimesRef.current.length > 5) {
      tapTimesRef.current.shift();
    }
    
    if (tapTimesRef.current.length >= 4) {
      const diffs = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        diffs.push(tapTimesRef.current[i] - tapTimesRef.current[i-1]);
      }
      const avgInterval = diffs.reduce((a, b) => a + b) / diffs.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      const finalBpm = Math.min(240, Math.max(40, calculatedBpm));
      
      setBpm(finalBpm);
      
      // Show visual feedback
      setBpmFeedback({ value: finalBpm, visible: true });
      if (bpmTimeoutRef.current) clearTimeout(bpmTimeoutRef.current);
      bpmTimeoutRef.current = window.setTimeout(() => {
        setBpmFeedback(prev => ({ ...prev, visible: false }));
      }, 1500);
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Only allow double-click toggle on desktop (md breakpoint is usually 768px)
    if (window.innerWidth >= 768) {
      setPlayback(p => ({ ...p, isPlaying: !p.isPlaying }));
    }
  }, []);

  const createEmptyFrame = useCallback((size: GridSize): VoxelFrame => {
    return Array.from({ length: size.z }, () =>
      Array.from({ length: size.y }, () =>
        Array.from({ length: size.x }, () => 0)
      )
    );
  }, []);

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      setVoxelData([createEmptyFrame(gridSize)]);
      setPlayback(p => ({ ...p, currentFrame: 0, isPlaying: false }));
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioIntervalRef.current = window.setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) if (dataArray[i] > maxVal) maxVal = dataArray[i];
        if (maxVal > audioThreshold) {
          setVoxelData(prevData => {
            const currentFrame = prevData[0] || createEmptyFrame(gridSize);
            const newFrame: VoxelFrame = createEmptyFrame(gridSize);
            for (let z = gridSize.z - 1; z > 0; z--) newFrame[z] = currentFrame[z - 1];
            const binsPerBand = Math.floor(bufferLength / gridSize.x);
            for (let x = 0; x < gridSize.x; x++) {
              let sum = 0;
              for (let j = 0; j < binsPerBand; j++) sum += dataArray[x * binsPerBand + j];
              const avg = sum / binsPerBand;
              const height = (avg / 255) * gridSize.y;
              for (let y = 0; y < gridSize.y; y++) {
                if (y < height) newFrame[0][y][x] = 255;
                else newFrame[0][y][x] = 0;
              }
            }
            return [newFrame];
          });
        }
      }, 50);
    } catch (err) {
      console.error("Audio initialization failed:", err);
      setAudioEnabled(false);
    }
  };

  const stopAudio = () => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    audioIntervalRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
  };

  const handleGridSizeChange = useCallback((newSize: GridSize) => {
    setGridSize(newSize);
    if (!audioEnabled) {
      // 32 frames for BPM sync
      const newData = generatePattern('wave', newSize, 32);
      setVoxelData(newData);
      setPlayback(p => ({ ...p, currentFrame: 0 }));
    }
  }, [audioEnabled]);

  const handlePreset = useCallback((type: PresetType) => {
    setAudioEnabled(false);
    setPlayback(p => ({ ...p, isPlaying: false, currentFrame: 0 }));
    // 32 frames for BPM sync
    const newData = generatePattern(type, gridSize, 32);
    setVoxelData(newData);
    setTimeout(() => setPlayback(p => ({ ...p, isPlaying: true })), 100);
  }, [gridSize]);

  const handleJsonImport = useCallback((newData: VoxelData) => {
    setAudioEnabled(false);
    setPlayback(p => ({ ...p, isPlaying: false, currentFrame: 0 }));
    if (newData.length > 0) {
       const z = newData[0].length;
       const y = newData[0][0].length;
       const x = newData[0][0][0].length;
       setGridSize({ x, y, z });
    }
    setVoxelData(newData);
    setTimeout(() => setPlayback(p => ({ ...p, isPlaying: true })), 200);
  }, []);

  const handleAiData = useCallback((data: VoxelData) => {
    if (!data || data.length === 0) return;
    setAudioEnabled(false);
    const z = data[0].length;
    const y = data[0][0]?.length || 0;
    const x = data[0][0]?.[0]?.length || 0;
    if (x > 0 && y > 0 && z > 0) setGridSize({ x, y, z });
    setVoxelData(data);
    setPlayback(p => ({ ...p, currentFrame: 0, isPlaying: true }));
  }, []);

  // 1 measure (4 beats) duration in seconds
  const measureDuration = (60 / bpm) * 4;

  return (
    <div 
      className="relative w-full h-screen bg-[#000] text-white overflow-hidden font-sans select-none"
      onDoubleClick={handleDoubleClick}
    >
      <style>{`
        @keyframes measure-pulse {
          0%, 100% { opacity: 0.5; box-shadow: 0 0 0px transparent; }
          5% { opacity: 1; box-shadow: 0 0 15px rgba(255,255,255,0.5); text-shadow: 0 0 10px white; }
          30% { opacity: 0.5; box-shadow: 0 0 0px transparent; }
        }
        .bpm-pulse {
          animation: measure-pulse ${measureDuration}s infinite cubic-bezier(0.1, 0, 0.2, 1);
        }
      `}</style>
      
      <Canvas 
        dpr={[1, 2]} 
        camera={{ position: [15, 15, 15], fov: 35 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <VoxelScene 
           data={voxelData} 
           currentFrame={playback.currentFrame} 
           gridSize={gridSize}
           bloomEnabled={bloomEnabled}
           ledColor={ledColor}
           brightnessMultiplier={brightnessMultiplier}
        />
      </Canvas>

      <div className="absolute top-0 left-0 w-full h-24 flex items-center justify-center pointer-events-none z-30">
        <h1 className="text-4xl md:text-5xl font-extralight tracking-[0.4em] text-white/90">
          Le<span className="font-black text-white/50">:</span>gram
        </h1>
      </div>

      {/* BPM Visual Feedback Overlay */}
      <div 
        className={`absolute inset-0 flex items-center justify-center z-[200] pointer-events-none transition-all duration-700 ease-out ${bpmFeedback.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="flex flex-col items-center">
           <span className="text-[120px] md:text-[180px] font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] tabular-nums leading-none">
             {bpmFeedback.value}
           </span>
           <span className="text-xl md:text-2xl font-light tracking-[1em] text-cyan-400 uppercase mt-4 animate-pulse">
             BPM SET
           </span>
        </div>
      </div>

      {/* AI Access button - Desktop Bottom Right, icon only, Static (no pulse) */}
      <div className="hidden md:block absolute bottom-12 right-12 z-[110]">
        <button 
           onClick={() => setShowGemini(!showGemini)}
           className={`flex items-center justify-center w-14 h-14 transition-all active:scale-90 text-white/80 hover:text-white`}
           title="AI Architect"
        >
           <Sparkles 
             size={28} 
             className={showGemini ? "text-white drop-shadow-[0_0_12px_white]" : ""} 
           />
        </button>
      </div>

      {!isControlsOpen && (
        <div className="md:hidden fixed bottom-10 left-1/2 -translate-x-1/2 w-[92%] bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full p-2 flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-8 duration-700 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-3 px-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setPlayback(p => ({ ...p, isPlaying: !p.isPlaying })); }}
              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center active:scale-90"
            >
              {playback.isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                // Reset frame AND register BPM tap
                setPlayback(p => ({ ...p, currentFrame: 0 })); 
                handleBpmTap();
              }}
              className="text-white/80 active:scale-90 p-2 active:text-cyan-400 transition-colors bpm-pulse rounded-full"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <div className="flex-1 px-2 h-1 relative">
             <div className="w-full bg-white/10 h-full rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-300 shadow-[0_0_10px_white]" 
                  style={{ width: `${((playback.currentFrame + 1) / (voxelData.length || 1)) * 100}%` }}
                />
             </div>
          </div>
          
          <div className="text-[10px] font-mono font-bold text-white/50 tabular-nums">
             {(playback.currentFrame + 1).toString().padStart(2, '0')}
          </div>

          <button 
             onClick={(e) => { e.stopPropagation(); setShowGemini(!showGemini); }}
             className={`w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90 ${showGemini ? 'text-white' : 'text-white/40'}`}
          >
             <Sparkles size={20} className="" />
          </button>
        </div>
      )}

      <Controls 
        gridSize={gridSize}
        setGridSize={handleGridSizeChange} 
        isDimensionsSynced={isDimensionsSynced}
        setIsDimensionsSynced={setIsDimensionsSynced}
        playback={playback}
        setPlayback={setPlayback}
        bpm={bpm}
        setBpm={setBpm}
        isBpmSync={isBpmSync}
        setIsBpmSync={setIsBpmSync}
        totalFrames={voxelData.length}
        onPreset={handlePreset}
        onJsonToggle={() => setShowJson(true)}
        bloomEnabled={bloomEnabled}
        setBloomEnabled={setBloomEnabled}
        ledColor={ledColor}
        setLedColor={setLedColor}
        brightnessMultiplier={brightnessMultiplier}
        setBrightnessMultiplier={setBrightnessMultiplier}
        audioEnabled={audioEnabled}
        setAudioEnabled={setAudioEnabled}
        audioThreshold={audioThreshold}
        setAudioThreshold={setAudioThreshold}
        isOpen={isControlsOpen}
        onToggle={() => setIsControlsOpen(prev => !prev)}
        onOpenGemini={() => setShowGemini(!showGemini)}
        onBpmTap={handleBpmTap}
      />

      <GeminiPanel 
        isOpen={showGemini}
        onClose={() => setShowGemini(false)}
        gridSize={gridSize}
        onDataGenerated={handleAiData}
      />

      <JsonEditor 
         isOpen={showJson}
         onClose={() => setShowJson(false)}
         currentData={voxelData}
         onImport={handleJsonImport}
      />
    </div>
  );
}
