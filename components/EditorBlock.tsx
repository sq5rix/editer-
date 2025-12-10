import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Eye, BookOpen, GripVertical } from 'lucide-react';
import { motion, Reorder, useDragControls } from 'framer-motion';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
  onPaste?: (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: (id: string) => void;
  onAnalyze: (id: string, type: 'sensory' | 'show-dont-tell') => void;
  typography: TypographySettings;
  isSwapSource?: boolean;
  onShuffleSelect?: (id: string) => void;
}

const EditorBlock: React.FC<EditorBlockProps> = ({ 
  block, 
  isActive, 
  mode, 
  onChange, 
  onPaste,
  onFocus, 
  onAnalyze, 
  typography,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragControls = useDragControls();

  // Auto-focus textarea when switching to write mode if active
  useEffect(() => {
    if (isActive && mode === 'write' && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
        const val = textareaRef.current?.value;
        if (val) {
          textareaRef.current.setSelectionRange(val.length, val.length);
        }
      }, 50);
    }
  }, [mode, isActive]);

  const getFontClass = () => {
    if (block.type === 'h1') return 'font-display';
    switch (typography.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      default: return 'font-serif';
    }
  };

  const fontSizeStyle = {
    fontSize: block.type === 'h1' ? `${Math.max(typography.fontSize * 2, 24)}px` : `${typography.fontSize}px`,
    lineHeight: block.type === 'h1' ? '1.2' : '1.8',
  };

  const commonClasses = `w-full bg-transparent outline-none border-none transition-all duration-300 ${getFontClass()} ${
    block.type === 'h1' 
      ? 'font-bold mb-6 mt-8 text-ink dark:text-zinc-100' 
      : 'text-zinc-800 dark:text-zinc-300'
  }`;

  // --- SHUFFLE MODE RENDER (REORDER ITEM) ---
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
        className="relative p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-start gap-4 ui-no-select"
      >
        <div 
          className="mt-1 cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors p-1 touch-none select-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
           <GripVertical size={20} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm text-zinc-600 dark:text-zinc-400 font-serif leading-relaxed line-clamp-3 pointer-events-none">
              {block.content || <span className="italic opacity-50">Empty block...</span>}
          </div>
        </div>
        
        {/* Visual hint for H1 */}
        {block.type === 'h1' && (
           <div className="absolute right-4 top-4 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
             Heading
           </div>
        )}
      </Reorder.Item>
    );
  }
  
  // --- WRITE / EDIT MODE RENDER ---
  return (
    <motion.div
      layoutId={block.id}
      ref={containerRef}
      className={`relative group transition-all duration-500 ease-in-out my-4 pl-4 md:pl-0 ${
        isActive && mode === 'write'
          ? 'translate-x-0' 
          : mode === 'edit' ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30 rounded-lg -ml-4 pl-4 pr-2 py-2' : 'opacity-80 hover:opacity-100'
      }`}
      onClick={() => {
        if (mode === 'write') onFocus(block.id);
      }}
    >
       {/* Active Block Indicator / Margin Actions - ONLY IN EDIT MODE */}
       <div className={`absolute -left-12 top-0 h-full flex flex-col justify-center items-end gap-2 pr-2 transition-opacity duration-300 ${mode === 'edit' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'sensory'); }}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select touch-manipulation"
            title="Sensorize"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'show-dont-tell'); }}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select touch-manipulation"
            title="Show, Don't Tell"
          >
            <BookOpen size={16} />
          </button>
       </div>

       {/* Visual Marker for Active Paragraph - Write Mode Only */}
       <div className={`absolute left-[-20px] top-0 bottom-0 w-[3px] rounded-full bg-amber-500 transition-all duration-500 ${isActive && mode === 'write' ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />

      {mode === 'write' ? (
        <TextareaAutosize
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onChange(block.id, e.target.value)}
          onPaste={(e) => onPaste && onPaste(block.id, e)}
          onFocus={() => onFocus(block.id)}
          style={fontSizeStyle}
          className={`${commonClasses} resize-none`}
          placeholder={block.type === 'h1' ? "Chapter Title..." : "Start writing..."}
        />
      ) : (
        /* Render as a DIV in Edit Mode */
        <div 
          style={fontSizeStyle}
          className={`${commonClasses} whitespace-pre-wrap cursor-text selection:bg-amber-200 dark:selection:bg-amber-900/60`}
          onContextMenu={(e) => e.preventDefault()}
        >
          {block.content || <span className="opacity-30 italic">Empty block</span>}
        </div>
      )}
    </motion.div>
  );
};

export default EditorBlock;