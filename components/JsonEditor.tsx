import React, { useState, useEffect } from 'react';
import { X, Check, Copy } from 'lucide-react';
import { VoxelData } from '../types';

interface JsonEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: VoxelData;
  onImport: (data: VoxelData) => void;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ isOpen, onClose, currentData, onImport }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText(JSON.stringify(currentData, null, 2));
      setError(null);
    }
  }, [isOpen, currentData]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(text);
      // Basic validation
      if (!Array.isArray(parsed) || !Array.isArray(parsed[0]) || !Array.isArray(parsed[0][0]) || !Array.isArray(parsed[0][0][0])) {
         throw new Error("Invalid structure. Must be 4D array [Time][Z][Y][X]");
      }
      onImport(parsed);
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid JSON");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-neutral-950 w-full max-w-4xl h-[80vh] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-900/50">
          <h3 className="text-cyan-400 font-bold font-mono">JSON INTERFACE</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 relative">
           <textarea 
             className="w-full h-full bg-[#050505] text-green-500 font-mono text-xs p-6 resize-none focus:outline-none"
             value={text}
             onChange={(e) => setText(e.target.value)}
             spellCheck={false}
           />
        </div>

        {error && (
            <div className="bg-red-950/50 text-red-400 px-6 py-2 text-xs border-t border-red-900/30">
                Error: {error}
            </div>
        )}

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex justify-end gap-3">
          <button 
             onClick={handleCopy}
             className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-bold flex items-center gap-2"
          >
             <Copy size={14}/> Copy
          </button>
          <button 
             onClick={handleApply}
             className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-bold flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
             <Check size={14}/> Apply Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonEditor;
