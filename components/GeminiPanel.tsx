
import React, { useState, useEffect, memo, useRef } from 'react';
import { Send, X, Sparkles, Loader2, Image as ImageIcon, Trash2, Settings, Plus, Paperclip } from 'lucide-react';
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string; error?: boolean; image?: string }[]>([]);
  const [genHistory, setGenHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // History Settings
  const [historyLimit, setHistoryLimit] = useState(30);
  const [showHistorySettings, setShowHistorySettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history & settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem('voxel_history');
      if (saved) setGenHistory(JSON.parse(saved));
      
      const savedLimit = localStorage.getItem('voxel_history_limit');
      if (savedLimit) setHistoryLimit(parseInt(savedLimit));
    } catch (e) { console.error("Failed to load history", e); }
  }, []);

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem('voxel_history', JSON.stringify(genHistory));
    } catch (e) { console.error("Failed to save history", e); }
  }, [genHistory]);

  // Save limit setting
  useEffect(() => {
    localStorage.setItem('voxel_history_limit', historyLimit.toString());
  }, [historyLimit]);

  const saveToHistory = (name: string, description: string, data: VoxelData) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      name, description, data, gridSize, timestamp: Date.now()
    };
    // Apply limit
    setGenHistory(prev => [newItem, ...prev].slice(0, historyLimit));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGenHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setGenHistory([]);
    }
  };

  const handleGenerate = async (prompt: string, imageBase64?: string) => {
    setIsLoading(true);
    const result = await generateAnimationWithAI(prompt, gridSize, imageBase64);
    setIsLoading(false);

    if (result && result.data && Array.isArray(result.data)) {
      onDataGenerated(result.data);
      saveToHistory(result.name, result.description, result.data);
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: `【${result.name}】\n${result.description}\n\nSynthesis Complete.` 
      }]);
    } else {
      setChatHistory(prev => [...prev, { 
        role: 'ai', error: true, text: "Synthesis Failed. Structure invalid." 
      }]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file?: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Paste Event Handler
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
          e.preventDefault(); // Prevent pasting the image filename as text
        }
        break;
      }
    }
  };

  const handleSendChat = async () => {
    if (!input.trim() && !selectedImage) return;
    const userMsg = input;
    const userImg = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setChatHistory(prev => [...prev, { role: 'user', text: userMsg, image: userImg || undefined }]);

    const recentHistory = chatHistory.slice(-2).map(msg => 
      `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`
    ).join('\n');

    const promptWithContext = recentHistory 
      ? `Previous Conversation:\n${recentHistory}\n\nCurrent Request: ${userMsg}`
      : userMsg;

    const isGenIntent = /(生成|作成|作って|描画|表示|シミュレート|セット|再現|データ|image|picture|photo)/i.test(userMsg);
    const isObjectIntent = /(きのこ|キノコ|花|木|ビル|ハート|球体|らせん|立方体|ピラミッド|mushroom|flower|heart|spiral|box|object|fountain|fireworks|wave)/i.test(userMsg);
    const isContextualGen = /(それで(よい|いい|ok|オッケー)|お願い|やって|直して|修正|もっと|早く|遅く)/i.test(userMsg) && chatHistory.length > 0;
    
    if (userImg || isGenIntent || isObjectIntent || isContextualGen) {
      await handleGenerate(promptWithContext, userImg || undefined);
    } else {
      setIsLoading(true);
      const response = await chatWithGeminiSimple(promptWithContext, gridSize);
      setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // 背景の透明度を上げてすりガラスを強調 (bg-black/85 -> bg-black/40)
  const containerClasses = `
    fixed inset-0 w-full h-[100dvh] bg-black/40 backdrop-blur-[60px] 
    flex flex-col z-[450] animate-in slide-in-from-bottom duration-500 ease-out
  `;

  return (
    <div className="fixed inset-0 z-[440]">
      <div className={containerClasses}>
        
        {/* Header */}
        <div className="relative p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-black/20 shrink-0">
          <div className="flex items-center gap-4 text-white">
            <Sparkles size={24} strokeWidth={1.5} className="text-cyan-400"/>
            <span className="font-bold text-xs md:text-[11px] tracking-[0.6em] uppercase text-white/90">Voxel Synthesis</span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-all p-2.5 hover:bg-white/10 rounded-full">
             <X size={26} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 shrink-0">
          <button onClick={() => setActiveTab('chat')} className={`flex-1 py-5 text-[11px] md:text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'chat' ? 'text-white' : 'text-white/25'}`}>
            Interaction {activeTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />}
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-5 text-[11px] md:text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'history' ? 'text-white' : 'text-white/25'}`}>
            Archive {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-14 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
          {activeTab === 'chat' ? (
            <div className="space-y-8 pb-20">
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
                  <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.image && (
                      <img src={msg.image} alt="User Upload" className="max-w-[200px] rounded-xl border border-white/20 mb-2" />
                    )}
                    {/* Added 'select-text' class to enable text selection */}
                    <div className={`rounded-[1.5rem] px-8 py-6 text-sm md:text-[13px] leading-relaxed shadow-lg border select-text ${
                      msg.role === 'user' 
                        ? 'bg-white/10 text-white border-white/20' 
                        : msg.error 
                          ? 'bg-red-500/10 text-red-200 border-red-500/30'
                          : 'bg-cyan-900/10 text-cyan-50 border-cyan-500/20'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center justify-center gap-4 text-cyan-300/80 text-[10px] font-bold tracking-[0.3em] uppercase py-8 animate-pulse">
                  <Loader2 className="animate-spin" size={16} /> Processing Logic
                </div>
              )}
            </div>
          ) : (
            <div className="pb-20">
              {/* History Settings Header */}
              <div className="flex justify-between items-center mb-6 px-2">
                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setShowHistorySettings(!showHistorySettings)}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                   >
                     <Settings size={14} /> Settings
                   </button>
                   {genHistory.length > 0 && (
                      <button 
                        onClick={clearAllHistory}
                        className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors ml-4"
                      >
                        <Trash2 size={14} /> Clear All
                      </button>
                   )}
                </div>
              </div>

              {/* Collapsible Settings */}
              {showHistorySettings && (
                <div className="mb-8 bg-white/5 border border-white/10 rounded-xl p-4 animate-in slide-in-from-top-2">
                  <label className="text-[10px] text-white/60 uppercase tracking-widest block mb-2">
                    Max History Items: {historyLimit}
                  </label>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    step="5"
                    value={historyLimit}
                    onChange={(e) => setHistoryLimit(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <p className="text-[9px] text-white/30 mt-2">Oldest items will be removed automatically when limit is reached.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {genHistory.length === 0 ? <p className="col-span-full text-center text-white/20 text-[10px] mt-28 font-bold uppercase tracking-[0.4em]">Empty Archive</p> : (
                  genHistory.map(item => (
                    <div key={item.id} className="p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group relative">
                      {/* Delete Button */}
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="absolute top-4 right-4 p-2 text-white/20 hover:text-red-400 hover:bg-white/5 rounded-full transition-all opacity-0 group-hover:opacity-100"
                        title="Remove from history"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="flex justify-between items-start mb-4 pr-8">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{item.name}</span>
                        <span className="text-[9px] text-white/30 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-white/50 line-clamp-2 mb-6 font-light">{item.description}</p>
                      <button onClick={() => { onDataGenerated(item.data); setActiveTab('chat'); }} className="w-full py-4 bg-white/5 hover:bg-white text-white hover:text-black text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors">Load Pattern</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input Area - Padding Bottom increased significantly to prevent cutoff on mobile */}
        <div className="p-4 md:p-10 border-t border-white/10 bg-black/40 backdrop-blur-xl shrink-0 pb-24 md:pb-12">
          {selectedImage && (
            <div className="max-w-4xl mx-auto mb-4 flex items-start animate-in slide-in-from-bottom-2">
              <div className="relative group">
                <img src={selectedImage} alt="Selected" className="h-20 rounded-lg border border-white/30" />
                <button 
                  onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}
          
          <div className="flex gap-3 max-w-4xl mx-auto items-end">
            
             {/* Hidden Inputs */}
             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            
             {/* Unified Attachment Button */}
             <button 
               onClick={() => fileInputRef.current?.click()}
               className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 border ${selectedImage ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}
               title="Attach Image"
             >
               <Paperclip size={20} strokeWidth={1.5} />
             </button>

            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              onPaste={handlePaste} // Clipboard paste handler
              placeholder={selectedImage ? "Describe animation..." : "Describe motion... (Paste image supported)"}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-[2rem] px-6 py-4 text-sm md:text-[13px] text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-white/20"
            />
            <button 
              onClick={handleSendChat} 
              disabled={isLoading} 
              className="w-12 h-12 md:w-14 md:h-14 bg-white text-black rounded-full flex items-center justify-center transition-transform active:scale-90 disabled:opacity-50 flex-shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            >
              {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={20} className="ml-0.5 md:w-6 md:h-6" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GeminiPanel;
