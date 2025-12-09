import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Eye, BookOpen, GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
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
  onFocus, 
  onAnalyze, 
  typography,
  isSwapSource,
  onShuffleSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // --- SHUFFLE MODE RENDER ---
  if (mode === 'shuffle') {
    return (
      <motion.div
        layoutId={`shuffle-${block.id}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onShuffleSelect && onShuffleSelect(block.id)}
        className={`
          relative p-6 rounded-xl cursor-pointer transition-all duration-200 my-4 ui-no-select group
          ${isSwapSource 
            ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500 shadow-lg scale-[1.02]' 
            : 'bg-white dark:bg-zinc-800 hover:shadow-md border border-zinc-200 dark:border-zinc-700/50 hover:border-amber-300 dark:hover:border-amber-700'}
        `}
      >
        <div className="flex items-start justify-between gap-4">
          <div className={`text-sm ${isSwapSource ? 'text-amber-900 dark:text-amber-100' : 'text-zinc-600 dark:text-zinc-400'} font-serif leading-relaxed line-clamp-3 pointer-events-none`}>
            {block.content || <span className="italic opacity-50">Empty block...</span>}
          </div>
          <GripVertical size={16} className={`shrink-0 ${isSwapSource ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
        </div>
        
        {/* Visual hint for H1 */}
        {block.type === 'h1' && (
           <div className="absolute top-0 right-0 left-0 h-1 bg-zinc-900 dark:bg-zinc-100 opacity-10 rounded-t-xl"></div>
        )}
      </motion.div>
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