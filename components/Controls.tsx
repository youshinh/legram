
import React, { useState, useRef, useCallback, memo } from 'react';
import { 
  Play, Pause, RotateCcw, 
  Settings2, Activity, Box, Waves,
  Zap, CloudRain, Circle, Loader, Rocket, X, Menu, Link, Mic, Music, ChevronDown, ChevronUp,
  Droplets, Square, Cpu, Wind
} from 'lucide-react';
import { GridSize, PlaybackState, PresetType } from '../types';

interface ControlsProps {
  gridSize: GridSize;
  setGridSize: (size: GridSize) => void;
  isDimensionsSynced: boolean;
  setIsDimensionsSynced: (v: boolean) => void;
  playback: PlaybackState;
  setPlayback: React.Dispatch<React.SetStateAction<PlaybackState>>;
  bpm: number;
  setBpm: (v: number) => void;
  isBpmSync: boolean;
  setIsBpmSync: (v: boolean) => void;
  totalFrames: number;
  onPreset: (type: PresetType) => void;
  onJsonToggle: () => void;
  bloomEnabled: boolean;
  setBloomEnabled: (v: boolean) => void;
  ledColor: string;
  setLedColor: (c: string) => void;
  brightnessMultiplier: number;
  setBrightnessMultiplier: (v: number) => void;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
  audioThreshold: number;
  setAudioThreshold: (v: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenGemini: () => void;
  onBpmTap: () => void;
}

const Controls: React.FC<ControlsProps> = memo(({ 
  gridSize, setGridSize, 
  isDimensionsSynced, setIsDimensionsSynced,
  playback, setPlayback, 
  bpm, setBpm,
  isBpmSync, setIsBpmSync,
  totalFrames, onPreset,
  onJsonToggle,
  bloomEnabled, setBloomEnabled,
  ledColor, setLedColor,
  brightnessMultiplier, setBrightnessMultiplier,
  audioEnabled, setAudioEnabled,
  audioThreshold, setAudioThreshold,
  isOpen, onToggle,
  onOpenGemini,
  onBpmTap
}) => {
  
  const [openSections, setOpenSections] = useState({
    dimensions: false,
    rhythm: true,
    sonic: false,
    photometry: false,
    presets: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSizeChange = (axis: keyof GridSize, val: string) => {
    const num = Math.min(32, Math.max(1, parseInt(val) || 1));
    if (isDimensionsSynced) {
      setGridSize({ x: num, y: num, z: num });
    } else {
      setGridSize({ ...gridSize, [axis]: num });
    }
  };

  const setSpeedMultiplier = (m: number) => {
    setPlayback(prev => ({ ...prev, speedMultiplier: m }));
  };

  const presets: {id: PresetType, label: string, icon: React.FC<any>}[] = [
    { id: 'wave', label: 'Wave', icon: Waves },
    { id: 'scan', label: 'Scan', icon: Activity },
    { id: 'pulse', label: 'Pulse', icon: Zap },
    { id: 'rain', label: 'Rain', icon: CloudRain },
    { id: 'sphere', label: 'Sphere', icon: Circle },
    { id: 'spiral', label: 'Spiral', icon: Loader },
    { id: 'fountain', label: 'Fountain', icon: Droplets },
    { id: 'cube', label: 'Cube', icon: Square },
    { id: 'dna', label: 'DNA', icon: Cpu },
    { id: 'plasma', label: 'Plasma', icon: Wind },
    { id: 'fireworks', label: 'F.Works', icon: Rocket },
    { id: 'random', label: 'Random', icon: Box },
  ];

  // パネルのスタイル定義
  // PC表示(md)の設定に合わせて、モバイルも bg-white/5 backdrop-blur-xl に統一
  const panelClasses = `
    fixed md:absolute 
    top-0 left-0 md:top-8 md:left-8 
    w-full md:w-80 h-full md:h-[calc(100vh-64px)] 
    bg-white/5 backdrop-blur-xl
    border-r md:border border-white/10 md:rounded-3xl 
    shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col z-[400] transition-all duration-500 ease-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full md:opacity-0 md:scale-95 pointer-events-none'}
  `;

  const SectionHeader = ({ title, section, open }: { title: string, section: keyof typeof openSections, open: boolean }) => (
    <button 
      onClick={() => toggleSection(section)}
      className="w-full flex justify-between items-center text-xs md:text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] mb-4 hover:text-white/60 transition-colors"
    >
      <span>{title}</span>
      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  );

  return (
    <>
      <button 
        onClick={onToggle}
        className="fixed top-6 left-6 md:top-8 md:left-8 z-[310] p-2 text-white transition-transform active:scale-90 hover:opacity-80"
        style={{ display: isOpen ? 'none' : 'block' }}
      >
        <Menu size={32} strokeWidth={1.5} />
      </button>

      <div className={panelClasses}>
        <div className="relative p-8 pt-12 md:pt-8 flex items-center justify-between">
          <h2 className="text-white font-medium tracking-[0.4em] text-xs md:text-[10px] flex items-center gap-2 uppercase">
              <Settings2 size={14} strokeWidth={1.5} /> Parameters
          </h2>
          <button 
             onClick={onToggle} 
             className="text-white/40 hover:text-white transition-colors p-2 bg-white/10 md:bg-transparent rounded-full"
          >
            <X size={24} strokeWidth={1.5}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 space-y-10 md:space-y-8 custom-scrollbar pb-10">
          
          {/* Temporal Control */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs md:text-[9px] text-white/30 font-bold uppercase tracking-[0.2em]">Temporal</div>
            <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setPlayback(p => ({ ...p, isPlaying: !p.isPlaying }))} 
                  className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-transform"
                >
                  {playback.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>
                <button 
                  onClick={() => {
                    setPlayback(p => ({ ...p, currentFrame: 0, isPlaying: false }));
                    onBpmTap(); // Also trigger BPM Tap here for consistency
                  }} 
                  className="w-16 h-16 md:w-14 md:h-14 rounded-full border border-white/10 text-white/60 flex items-center justify-center active:scale-90 active:text-cyan-400 transition-colors bpm-pulse"
                >
                  <RotateCcw size={28} />
                </button>
                <div className="flex flex-col items-end gap-1"><span className="text-[10px] md:text-[8px] font-mono text-white/30 uppercase tracking-widest">Frame</span><span className="text-xl md:text-lg font-mono text-white tabular-nums">{(playback.currentFrame + 1).toString().padStart(2, '0')}</span></div>
            </div>
          </div>

          {/* Rhythm / BPM Tap */}
          <div className="space-y-2">
            <SectionHeader title="Rhythm" section="rhythm" open={openSections.rhythm} />
            {openSections.rhythm && (
              <div className="space-y-6 animate-in fade-in duration-300 bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] md:text-[9px] text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2"><Music size={14}/> BPM Link</div>
                  <button onClick={() => setIsBpmSync(!isBpmSync)} className={`w-12 h-6 md:w-10 md:h-5 rounded-full transition-colors relative ${isBpmSync ? 'bg-white' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 md:w-3 md:h-3 rounded-full transition-all ${isBpmSync ? 'left-7 md:left-6 bg-black' : 'left-1 bg-white/40'}`} /></button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">Current BPM</span>
                    <span className="text-xl md:text-lg font-mono text-white">{bpm}</span>
                  </div>
                  <button 
                     onClick={(e) => { e.stopPropagation(); onBpmTap(); }}
                     className="w-20 h-20 md:w-16 md:h-16 bg-white/10 border border-white/10 rounded-full text-[11px] md:text-[9px] font-black uppercase hover:bg-white hover:text-black transition-all active:scale-90 flex items-center justify-center shadow-lg"
                  >
                    Tap
                  </button>
                </div>

                <div className="space-y-4">
                   <input type="range" min="40" max="220" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className={`w-full h-8 md:h-2 accent-white ${isBpmSync ? 'opacity-100' : 'opacity-20'}`} disabled={!isBpmSync}/>
                   
                   <div className="flex flex-col gap-3">
                     <span className="text-[10px] text-white/30 uppercase tracking-widest">Speed Range</span>
                     <div className="grid grid-cols-4 gap-2">
                        {[0.5, 1, 2, 4].map(m => (
                          <button 
                            key={m}
                            onClick={() => setSpeedMultiplier(m)}
                            className={`py-3 md:py-2 rounded-lg text-[10px] font-mono font-bold transition-all border ${playback.speedMultiplier === m ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'}`}
                          >
                            x{m}
                          </button>
                        ))}
                     </div>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <SectionHeader title="Dimensions" section="dimensions" open={openSections.dimensions} />
            {openSections.dimensions && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-end mb-2"><button onClick={() => setIsDimensionsSynced(!isDimensionsSynced)} className={`flex items-center gap-2 px-3 py-2 md:px-2 md:py-1 rounded-md border text-[10px] md:text-[8px] font-black uppercase tracking-wider transition-all ${isDimensionsSynced ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/20'}`}><Link size={12} /> Sync</button></div>
                {isDimensionsSynced ? (
                  <div className="space-y-3"><div className="flex justify-between text-xs md:text-[10px] font-mono text-white/60 uppercase"><span>Unified</span><span>{gridSize.x}</span></div><input type="range" min="1" max="32" value={gridSize.x} onChange={(e) => handleSizeChange('x', e.target.value)} className="w-full h-8 md:h-2 accent-white" /></div>
                ) : (
                  (['x', 'y', 'z'] as const).map(axis => (
                    <div key={axis} className="space-y-3"><div className="flex justify-between text-xs md:text-[10px] font-mono text-white/60 uppercase"><span>{axis}</span><span>{gridSize[axis]}</span></div><input type="range" min="1" max="32" value={gridSize[axis]} onChange={(e) => handleSizeChange(axis, e.target.value)} className="w-full h-8 md:h-2 accent-white" /></div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sonic Input */}
          <div className="space-y-2">
            <SectionHeader title="Sonic Input" section="sonic" open={openSections.sonic} />
            {openSections.sonic && (
              <div className="space-y-4 animate-in fade-in duration-300 bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] md:text-[9px] text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2"><Mic size={14}/> Voice Mode</div>
                  <button onClick={() => setAudioEnabled(!audioEnabled)} className={`w-12 h-6 md:w-10 md:h-5 rounded-full transition-colors relative ${audioEnabled ? 'bg-white' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 md:w-3 md:h-3 rounded-full transition-all ${audioEnabled ? 'left-7 md:left-6 bg-black' : 'left-1 bg-white/40'}`} /></button>
                </div>
                {audioEnabled && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs md:text-[10px] font-mono text-white/60 uppercase"><span>Gate</span><span>{audioThreshold}</span></div>
                    <input type="range" min="0" max="100" value={audioThreshold} onChange={(e) => setAudioThreshold(parseInt(e.target.value))} className="w-full h-8 md:h-2 accent-white"/>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visual Settings */}
          <div className="space-y-2">
            <SectionHeader title="Photometry" section="photometry" open={openSections.photometry} />
            {openSections.photometry && (
              <div className="space-y-6 animate-in fade-in duration-300 bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] md:text-[9px] text-white/60 font-medium uppercase tracking-wider">Atmosphere Bloom</span>
                  <button onClick={() => setBloomEnabled(!bloomEnabled)} className={`w-12 h-6 md:w-10 md:h-5 rounded-full transition-colors relative ${bloomEnabled ? 'bg-white' : 'bg-white/10'}`}>
                    <div className={`absolute top-1 w-4 h-4 md:w-3 md:h-3 rounded-full transition-all ${bloomEnabled ? 'left-7 md:left-6 bg-black' : 'left-1 bg-white/40'}`} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs md:text-[10px] font-mono text-white/60 uppercase"><span>Intensity</span><span>{Math.round(brightnessMultiplier)}</span></div>
                  <input type="range" min="1" max="255" value={brightnessMultiplier} onChange={(e) => setBrightnessMultiplier(parseFloat(e.target.value))} className="w-full h-8 md:h-2 accent-white" />
                </div>
                <div className="flex items-center justify-between text-xs md:text-[9px] text-white/60 font-medium uppercase tracking-wider">
                  <span>Tone Mapping</span>
                  <div className="flex items-center gap-3">
                    <input type="color" value={ledColor} onChange={(e) => setLedColor(e.target.value)} className="w-8 h-8 rounded-sm bg-transparent border-none cursor-pointer p-0" />
                    <span className="font-mono text-white/40 uppercase">{ledColor}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Presets Grid */}
          <div className="space-y-2">
            <SectionHeader title="Geometry Presets" section="presets" open={openSections.presets} />
            {openSections.presets && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
                {presets.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => onPreset(p.id)} 
                    className="flex flex-col items-center justify-center p-5 gap-3 bg-white/5 hover:bg-white text-white/40 hover:text-black border border-white/5 rounded-2xl transition-all active:scale-95 group"
                  >
                    <p.icon size={24} strokeWidth={1.5}/> 
                    <span className="text-[10px] md:text-[8px] font-bold uppercase tracking-widest">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 border-t border-white/10">
          <button onClick={onJsonToggle} className="w-full py-5 border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-xs md:text-[9px] font-bold tracking-[0.3em] rounded-full transition-all uppercase">Interface Export</button>
        </div>
      </div>
      
      {isOpen && <div className="fixed inset-0 bg-black/40 z-[390] md:hidden backdrop-blur-md" onClick={onToggle} />}
    </>
  );
});

export default Controls;
