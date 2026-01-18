
import React, { useState, useEffect, memo } from 'react';
import { Send, X, Sparkles, Loader2 } from 'lucide-react';
import { GridSize, VoxelData, HistoryItem } from '../types';
import { chatWithGeminiSimple, generateAnimationWithAI } from '../services/geminiService';

interface GeminiPanelProps {
  gridSize: GridSize;
  onDataGenerated: (data: VoxelData) => void;
  isOpen: boolean;
  onClose: () => void;
}

const GeminiPanel: React.FC<GeminiPanelProps> = memo(({ gridSize, onDataGenerated, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string; error?: boolean }[]>([]);
  const [genHistory, setGenHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxel_history');
      if (saved) {
        setGenHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (genHistory.length > 0) {
      try {
        localStorage.setItem('voxel_history', JSON.stringify(genHistory));
      } catch (e) {
        console.error("Failed to save history", e);
      }
    }
  }, [genHistory]);

  const saveToHistory = (name: string, description: string, data: VoxelData) => {
    // Generate a unique ID and save to state
    // Note: data is forced to 8x8x8 by the service now
    const newItem: HistoryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      name,
      description,
      data,
      gridSize: { x: 8, y: 8, z: 8 }, 
      timestamp: Date.now()
    };
    
    setGenHistory(prev => [newItem, ...prev].slice(0, 30));
  };

  const handleGenerate = async (prompt: string, isImage: boolean = false, base64?: string) => {
    setIsLoading(true);
    // Service now ignores current gridSize and forces 8x8x8 output
    const result = await generateAnimationWithAI(prompt, gridSize, isImage, base64);
    setIsLoading(false);

    if (result && result.data && Array.isArray(result.data)) {
      onDataGenerated(result.data);
      saveToHistory(result.name, result.description, result.data);
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: `【${result.name}】\n${result.description}\n\nSynthesis Complete. Display switched to 8x8x8.` 
      }]);
    } else {
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        error: true,
        text: "Synthesis Failed. Structure invalid." 
      }]);
    }
  };

  const handleSendChat = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);

    const isGenIntent = /(生成|作成|作って|描画|表示|シミュレート|セット|再現|データ)/i.test(userMsg);
    const isObjectIntent = /(きのこ|キノコ|花|木|ビル|ハート|球体|らせん|立方体|ピラミッド|mushroom|flower|heart|spiral|box|object|fountain|fireworks|wave)/i.test(userMsg);
    const isContextualGen = /(それで(よい|いい|ok|オッケー)|お願い|やって)/i.test(userMsg) && chatHistory.length > 0;

    if (isGenIntent || isObjectIntent || isContextualGen) {
      await handleGenerate(userMsg);
    } else {
      setIsLoading(true);
      const response = await chatWithGeminiSimple(userMsg, gridSize);
      setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
      setIsLoading(false);
    }
  };

  const applyFromHistory = (item: HistoryItem) => {
    onDataGenerated(item.data);
    setChatHistory(prev => [...prev, { role: 'ai', text: `Restored: ${item.name}` }]);
    setActiveTab('chat');
  };

  if (!isOpen) return null;

  // Full screen container classes
  const containerClasses = `
    fixed inset-0
    w-full h-full
    bg-black/85 backdrop-blur-[60px] 
    flex flex-col z-[450] animate-in slide-in-from-bottom duration-500 ease-out
  `;

  return (
    <div className="fixed inset-0 z-[440]">
      <div className={containerClasses}>
        
        {/* Header */}
        <div className="relative p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-black/20 shrink-0">
          <div className="flex items-center gap-4 text-white">
            <Sparkles size={24} strokeWidth={1.5} className="text-cyan-400"/>
            <span className="font-bold text-xs md:text-[11px] tracking-[0.6em] uppercase text-white/90">Voxel Synthesis System</span>
          </div>
          <button 
             onClick={onClose} 
             className="text-white/50 hover:text-white transition-all p-2.5 hover:bg-white/10 rounded-full"
          >
             <X size={26} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 shrink-0">
          <button onClick={() => setActiveTab('chat')} className={`flex-1 py-5 text-[11px] md:text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'chat' ? 'text-white' : 'text-white/25'}`}>
            Interaction
            {activeTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />}
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-5 text-[11px] md:text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'history' ? 'text-white' : 'text-white/25'}`}>
            Archive
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-14 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
          {activeTab === 'chat' ? (
            <>
              {chatHistory.length === 0 && (
                <div className="text-center mt-20 md:mt-28 opacity-30 flex flex-col items-center">
                  <div className="p-8 rounded-full bg-white/5 mb-8 border border-white/10 shadow-2xl">
                    <Sparkles size={60} strokeWidth={0.5} />
                  </div>
                  <p className="text-[11px] tracking-[0.6em] uppercase font-light">System Ready</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[70%] rounded-[1.5rem] px-8 py-6 text-sm md:text-[13px] leading-relaxed shadow-lg border ${
                    msg.role === 'user' 
                      ? 'bg-white/10 text-white border-white/20' 
                      : msg.error 
                        ? 'bg-red-500/10 text-red-200 border-red-500/30'
                        : 'bg-cyan-900/10 text-cyan-50 border-cyan-500/20'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center gap-4 text-cyan-300/80 text-[10px] font-bold tracking-[0.3em] uppercase py-8 animate-pulse">
                  <Loader2 className="animate-spin" size={16} /> Processing Logic
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
              {genHistory.length === 0 ? (
                <p className="col-span-full text-center text-white/20 text-[10px] mt-28 font-bold uppercase tracking-[0.4em]">Empty Archive</p>
              ) : (
                genHistory.map(item => (
                  <div key={item.id} className="p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{item.name}</span>
                      <span className="text-[9px] text-white/30 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-2 mb-6 font-light">{item.description}</p>
                    <button onClick={() => applyFromHistory(item)} className="w-full py-4 bg-white/5 hover:bg-white text-white hover:text-black text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors">
                      Load Pattern
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 md:p-10 border-t border-white/10 bg-black/40 backdrop-blur-xl shrink-0 pb-10 md:pb-12">
          <div className="flex gap-4 max-w-4xl mx-auto items-end">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Describe motion or shape..."
              className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] px-8 py-5 text-sm md:text-[13px] text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-white/20"
            />
            <button 
              onClick={handleSendChat} 
              disabled={isLoading} 
              className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50 flex-shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            >
              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GeminiPanel;
