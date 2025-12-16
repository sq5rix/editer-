import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, ZoomIn, ZoomOut, RotateCcw, ArrowRight } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface OCRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string, mode: 'append' | 'cursor') => void;
  imageSrc: string | null;
  initialText: string;
  isLoading: boolean;
  onRetry?: () => void;
}

const OCRModal: React.FC<OCRModalProps> = ({ 
  isOpen, onClose, onInsert, imageSrc, initialText, isLoading, onRetry 
}) => {
  const [text, setText] = useState(initialText);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Sync internal text state with props when done loading
  React.useEffect(() => {
    if (!isLoading) {
        setText(initialText);
    }
  }, [initialText, isLoading]);

  // Image Controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = () => setIsDragging(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-[200] backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-12 bg-white dark:bg-zinc-900 z-[210] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
             {/* Header */}
             <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
                 <div className="flex items-center gap-3">
                     <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-display">Handwriting Review</h2>
                     {isLoading && <span className="flex items-center gap-2 text-xs text-amber-500 font-medium animate-pulse"><Loader2 size={12} className="animate-spin"/> Transcribing...</span>}
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                     <X size={20} />
                 </button>
             </div>

             {/* Split View */}
             <div className="flex-1 flex flex-col md:flex-row min-h-0">
                 
                 {/* Left: Image Viewer */}
                 <div className="flex-1 bg-zinc-100 dark:bg-black/50 relative overflow-hidden flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800">
                     {imageSrc ? (
                         <div 
                           ref={imageContainerRef}
                           className="w-full h-full cursor-grab active:cursor-grabbing touch-none flex items-center justify-center overflow-hidden"
                           onPointerDown={handlePointerDown}
                           onPointerMove={handlePointerMove}
                           onPointerUp={handlePointerUp}
                           onPointerLeave={handlePointerUp}
                         >
                            <img 
                                src={imageSrc} 
                                alt="Handwriting Source" 
                                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                                className="max-w-full max-h-full object-contain transition-transform duration-75 select-none pointer-events-none"
                            />
                         </div>
                     ) : (
                         <div className="text-zinc-400 text-sm">No image loaded</div>
                     )}

                     {/* Image Tools */}
                     <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 backdrop-blur rounded-full p-2 text-white shadow-lg">
                         <button onClick={handleZoomOut} className="p-2 hover:bg-white/20 rounded-full"><ZoomOut size={16} /></button>
                         <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                         <button onClick={handleZoomIn} className="p-2 hover:bg-white/20 rounded-full"><ZoomIn size={16} /></button>
                         <div className="w-px h-4 bg-white/20 mx-1"></div>
                         <button onClick={handleReset} className="p-2 hover:bg-white/20 rounded-full" title="Reset View"><RotateCcw size={16} /></button>
                     </div>
                 </div>

                 {/* Right: Text Editor */}
                 <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900">
                     <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                         <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Transcription</span>
                         <div className="text-xs text-zinc-500 italic">Correct typos and [?] markers</div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6">
                         {isLoading ? (
                             <div className="space-y-4 animate-pulse">
                                 <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                                 <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6"></div>
                                 <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-4/6"></div>
                                 <div className="mt-8 h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                                 <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
                             </div>
                         ) : (
                             <TextareaAutosize
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full h-full bg-transparent resize-none border-none outline-none font-serif text-lg leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder-zinc-300"
                                placeholder="Transcription will appear here..."
                             />
                         )}
                     </div>

                     {/* Action Footer */}
                     <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-white dark:bg-zinc-900">
                         <button 
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                         >
                             Discard
                         </button>
                         <button 
                            onClick={() => onInsert(text, 'cursor')}
                            disabled={isLoading || !text.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                         >
                             Insert at Cursor
                         </button>
                         <button 
                            onClick={() => onInsert(text, 'append')}
                            disabled={isLoading || !text.trim()}
                            className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
                         >
                             <ArrowRight size={16} /> Append to End
                         </button>
                     </div>
                 </div>

             </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OCRModal;