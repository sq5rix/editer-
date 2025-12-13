import React, { useRef, useEffect, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Eye, BookOpen, GripVertical, Wand2, Sparkles, ArrowRight, X, MapPin } from 'lucide-react';
import { motion, Reorder, useDragControls, AnimatePresence } from 'framer-motion';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
  onPaste?: (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: (id: string) => void;
  onAnalyze: (id: string, type: 'sensory' | 'show-dont-tell' | 'fluency' | 'sense-of-place') => void;
  onRewrite?: (id: string, prompt: string) => void;
  typography: TypographySettings;
  isSwapSource?: boolean;
  onShuffleSelect?: (id: string) => void;
  onShuffleContextMenu?: (id: string, position: { top: number; left: number }) => void;
  onDoubleTap?: (id: string) => void;
  readOnly?: boolean;
  onRemove?: (id: string) => void;
  onEnter?: (id: string, cursorPosition: number) => void;
}

const EditorBlock: React.FC<EditorBlockProps> = ({ 
  block, 
  isActive, 
  mode, 
  onChange, 
  onPaste, 
  onFocus, 
  onAnalyze,
  onRewrite,
  typography,
  onShuffleSelect,
  onShuffleContextMenu,
  onDoubleTap,
  readOnly = false,
  onRemove,
  onEnter
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hrRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();
  
  // Ref to track last click time for manual double-tap detection
  const lastClickTime = useRef<number>(0);
  
  // Prompt State
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);

  // Focus prompt input when opened
  useEffect(() => {
    if (showPrompt && promptInputRef.current) {
        promptInputRef.current.focus();
    }
  }, [showPrompt]);

  // Reset prompt state when block loses active status
  useEffect(() => {
      if (!isActive) {
          setShowPrompt(false);
      }
  }, [isActive]);

  // Pointer handling for Shuffle Mode (Tap vs Long Press)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  // Auto-focus textarea or HR element when switching to write/edit mode if active
  useEffect(() => {
    if (isActive && (mode === 'write' || (mode === 'edit' && !readOnly)) && !showPrompt) {
      setTimeout(() => {
        if (block.type === 'hr' && hrRef.current) {
            hrRef.current.focus();
        } else if (textareaRef.current) {
            textareaRef.current.focus();
            const val = textareaRef.current.value;
            // If it's a new block (empty), this ensures focus. 
            if (document.activeElement !== textareaRef.current && document.activeElement !== promptInputRef.current) {
                textareaRef.current.setSelectionRange(val.length, val.length);
            }
        }
        // Scroll into view if off screen
        if (!showPrompt) {
            (hrRef.current || textareaRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [mode, isActive, readOnly, block.type, block.id, showPrompt]);

  const handlePromptSubmit = async () => {
      if (!promptText.trim() || !onRewrite) return;
      setIsRewriting(true);
      await onRewrite(block.id, promptText);
      setIsRewriting(false);
      setShowPrompt(false);
      setPromptText("");
      // Return focus to textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const getFontClass = () => {
    if (block.type === 'h1') return 'font-display';
    switch (typography.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      default: return 'font-serif';
    }
  };

  const textStyle = {
    fontSize: block.type === 'h1' ? `${Math.max(typography.fontSize * 2, 24)}px` : `${typography.fontSize}px`,
    lineHeight: block.type === 'h1' ? '1.2' : '1.8',
    opacity: readOnly ? typography.contrast * 0.7 : typography.contrast, // Dim read-only slightly
  };

  const commonClasses = `w-full bg-transparent outline-none border-none transition-all duration-300 ${getFontClass()} ${
    block.type === 'h1' 
      ? 'font-bold mb-6 mt-8 text-black dark:text-white' 
      : 'text-zinc-900 dark:text-white'
  }`;

  // --- CLICK / TAP HANDLER ---
  const handleClick = (e: React.MouseEvent) => {
    if (readOnly) return; 

    // Prevent closing prompt if clicking inside prompt
    if (showPrompt && (e.target as HTMLElement).closest('.prompt-box')) {
        return;
    }

    // 1. Write Mode Logic (or Edit Mode Live Pane)
    if (mode === 'write' || (mode === 'edit' && !readOnly)) {
      onFocus(block.id);
      return;
    }

    // 2. Edit Mode Double Tap Logic (if allowed)
    if (mode === 'edit' && onDoubleTap) {
      const now = Date.now();
      const timeDiff = now - lastClickTime.current;
      
      if (timeDiff < 300 && timeDiff > 0) {
        onDoubleTap(block.id);
        lastClickTime.current = 0; 
      } else {
        lastClickTime.current = now;
      }
    }
  };

  // --- SHUFFLE MODE EVENT HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'shuffle') return;
    
    // Ignore clicks on the drag handle
    const target = e.target as HTMLElement;
    if (target.closest('.drag-handle')) return;

    startPos.current = { x: e.clientX, y: e.clientY };
    
    pressTimer.current = setTimeout(() => {
        // Long Press detected
        if (onShuffleContextMenu && startPos.current) {
            onShuffleContextMenu(block.id, { top: e.clientY, left: e.clientX });
        }
        startPos.current = null; // Clear to prevent click trigger
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!startPos.current) return;
      
      const moveX = Math.abs(e.clientX - startPos.current.x);
      const moveY = Math.abs(e.clientY - startPos.current.y);
      
      if (moveX > 10 || moveY > 10) {
          if (pressTimer.current) clearTimeout(pressTimer.current);
          startPos.current = null;
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      if (startPos.current) {
          if (onShuffleSelect) onShuffleSelect(block.id);
      }
      startPos.current = null;
  };

  // --- SHUFFLE MODE RENDER ---
  if (mode === 'shuffle') {
    return (
      <Reorder.Item
        value={block}
        id={block.id}
        dragListener={false}
        dragControls={dragControls}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileDrag={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
        className="relative p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-start gap-4 ui-no-select touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        data-block-id={block.id}
      >
        <div 
          className="drag-handle mt-1 cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors p-1 touch-none select-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
           <GripVertical size={20} />
        </div>
        
        <div className="flex-1 min-w-0 pointer-events-none">
          {block.type === 'hr' ? (
              <div className="flex justify-center items-center py-2 opacity-50">
                  <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-600"></div>
                  <div className="mx-2 text-zinc-400 dark:text-zinc-500 text-xs uppercase tracking-widest">Break</div>
                  <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-600"></div>
              </div>
          ) : (
            <div 
                className="text-sm text-zinc-900 dark:text-white font-serif leading-relaxed line-clamp-3"
                style={{ opacity: typography.contrast }}
            >
                {block.content || <span className="italic opacity-50">Empty block...</span>}
            </div>
          )}
        </div>
      </Reorder.Item>
    );
  }

  // --- HORIZONTAL RULE RENDER (WRITE/EDIT) ---
  if (block.type === 'hr') {
    return (
        <motion.div
            layoutId={!readOnly ? block.id : `${block.id}-readonly`}
            ref={hrRef}
            data-block-id={block.id}
            className={`relative py-8 my-2 outline-none group cursor-pointer transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
            onClick={handleClick}
            tabIndex={0}
            onKeyDown={(e) => {
                if ((e.key === 'Backspace' || e.key === 'Delete') && !readOnly && onRemove) {
                    onRemove(block.id);
                }
            }}
        >
             <div className="flex items-center justify-center gap-4 select-none">
                 <div className="h-px w-12 bg-zinc-300 dark:bg-zinc-700"></div>
                 <div className="text-zinc-400 dark:text-zinc-600 font-serif italic text-lg tracking-widest">* * *</div>
                 <div className="h-px w-12 bg-zinc-300 dark:bg-zinc-700"></div>
             </div>
        </motion.div>
    );
  }
  
  // --- TEXT BLOCK RENDER ---
  
  return (
    <motion.div
      layoutId={!readOnly ? block.id : `${block.id}-readonly`}
      ref={containerRef}
      data-block-id={block.id}
      className={`relative group transition-all duration-500 ease-in-out my-4 pl-4 md:pl-0 ${
        isActive && mode === 'write' && !readOnly
          ? 'translate-x-0' 
          : mode === 'edit' && !readOnly 
            // Edit mode logic
            ? `${isActive ? 'bg-zinc-50 dark:bg-zinc-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30'} rounded-lg -ml-4 pl-4 pr-2 py-2` 
            : 'hover:opacity-100'
      }`}
      style={{ 
        opacity: (isActive || mode === 'edit') ? 1 : 0.8,
        zIndex: showPrompt ? 50 : 0
      }}
      onClick={handleClick}
    >
       {/* EDIT MODE TOOLS */}
       {!readOnly && mode === 'edit' && !showPrompt && (
           <div className={`absolute right-0 -top-7 flex flex-row justify-end items-center gap-2 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} pointer-events-auto z-20`}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowPrompt(true); }}
                className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shadow-sm ui-no-select touch-manipulation border border-amber-200 dark:border-amber-800"
                title="Magic Rewrite"
              >
                <Sparkles size={14} />
              </button>
              <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'fluency'); }}
                className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm ui-no-select touch-manipulation border border-zinc-200 dark:border-zinc-700"
                title="Native Polish"
              >
                <Wand2 size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'sensory'); }}
                className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm ui-no-select touch-manipulation border border-zinc-200 dark:border-zinc-700"
                title="Sensorize"
              >
                <Eye size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'show-dont-tell'); }}
                className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm ui-no-select touch-manipulation border border-zinc-200 dark:border-zinc-700"
                title="Show, Don't Tell"
              >
                <BookOpen size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'sense-of-place'); }}
                className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm ui-no-select touch-manipulation border border-zinc-200 dark:border-zinc-700"
                title="Sense of Place"
              >
                <MapPin size={14} />
              </button>
           </div>
       )}

       {/* WRITE MODE TOOLS (ACTIVE ONLY) */}
       {!readOnly && mode === 'write' && isActive && !showPrompt && (
          <div className="absolute right-0 -top-7 z-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowPrompt(true); }}
                className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 rounded-full hover:bg-amber-50 dark:hover:bg-zinc-700 transition-colors shadow-sm border border-zinc-200 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider"
                title="Magic Rewrite"
             >
                <Sparkles size={12} /> Rewrite
             </button>
          </div>
       )}

       {/* PROMPT INPUT OVERLAY */}
       <AnimatePresence>
         {showPrompt && (
           <motion.div 
             initial={{ opacity: 0, y: 5, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 5, scale: 0.95 }}
             className="prompt-box absolute left-0 right-0 -top-12 z-30 flex items-center justify-center"
           >
             <div className="w-full max-w-lg bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-amber-500/50 flex items-center p-1 pr-2 gap-2">
                 <div className="pl-3 text-amber-500">
                    <Sparkles size={16} />
                 </div>
                 <input
                    ref={promptInputRef}
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePromptSubmit();
                        } else if (e.key === 'Escape') {
                            setShowPrompt(false);
                            setTimeout(() => textareaRef.current?.focus(), 100);
                        }
                    }}
                    placeholder={isRewriting ? "Rewriting..." : "How should I change this paragraph?"}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 h-8"
                    disabled={isRewriting}
                 />
                 {promptText && (
                     <button 
                       onClick={handlePromptSubmit}
                       disabled={isRewriting}
                       className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-colors disabled:opacity-50"
                     >
                        <ArrowRight size={14} />
                     </button>
                 )}
                 <button 
                   onClick={() => { setShowPrompt(false); setTimeout(() => textareaRef.current?.focus(), 100); }}
                   className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 rounded-full transition-colors ml-1"
                 >
                    <X size={14} />
                 </button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Visual Marker for Active Paragraph - Write Mode Only */}
       <div className={`absolute left-[-20px] top-0 bottom-0 w-[3px] rounded-full bg-amber-500 transition-all duration-500 ${isActive && mode === 'write' && !readOnly ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />

      {(mode === 'write' || (mode === 'edit' && !readOnly)) ? (
        <TextareaAutosize
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onChange(block.id, e.target.value)}
          onPaste={(e) => onPaste && onPaste(block.id, e)}
          onFocus={() => onFocus(block.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && onEnter) {
                e.preventDefault();
                onEnter(block.id, e.currentTarget.selectionStart);
            }
            if ((e.key === 'Backspace' || e.key === 'Delete') && block.content === '' && onRemove) {
                onRemove(block.id);
            }
          }}
          style={textStyle}
          className={`${commonClasses} resize-none ${isRewriting ? 'opacity-50 animate-pulse' : ''}`}
          placeholder={block.type === 'h1' ? "Chapter Title..." : "Start writing..."}
          disabled={isRewriting}
        />
      ) : (
        /* Render as a DIV in ReadOnly or old Edit Mode */
        <div 
          style={textStyle}
          className={`${commonClasses} whitespace-pre-wrap cursor-text selection:bg-amber-200 dark:selection:bg-amber-900/60`}
          onContextMenu={(e) => !readOnly && e.preventDefault()}
        >
          {block.content || <span className="opacity-30 italic">Empty block</span>}
        </div>
      )}
    </motion.div>
  );
};

export default EditorBlock;