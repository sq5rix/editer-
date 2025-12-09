import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode, ViewMode } from '../types';
import { Eye, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  viewMode: ViewMode;
  onChange: (id: string, newContent: string) => void;
  onFocus: (id: string) => void;
  onAnalyze: (id: string, type: 'sensory' | 'show-dont-tell') => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  typography: TypographySettings;
  isFirst: boolean;
  isLast: boolean;
}

const EditorBlock: React.FC<EditorBlockProps> = ({ 
  block, isActive, mode, viewMode, onChange, onFocus, onAnalyze, onMoveUp, onMoveDown, typography, isFirst, isLast 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when switching to write mode if active
  useEffect(() => {
    if (isActive && mode === 'write' && viewMode === 'normal' && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
        const val = textareaRef.current?.value;
        if (val) {
          textareaRef.current.setSelectionRange(val.length, val.length);
        }
      }, 50);
    }
  }, [mode, isActive, viewMode]);

  const getFontClass = () => {
    if (block.type === 'h1') return 'font-display';
    switch (typography.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      default: return 'font-serif';
    }
  };

  // Styles for Normal vs Mini Mode
  const isMini = viewMode === 'mini';

  const fontSizeStyle = {
    fontSize: isMini 
      ? '4px' 
      : block.type === 'h1' ? `${Math.max(typography.fontSize * 2, 24)}px` : `${typography.fontSize}px`,
    lineHeight: isMini ? '1.4' : (block.type === 'h1' ? '1.2' : '1.8'),
  };

  const commonClasses = `w-full bg-transparent outline-none border-none transition-all duration-300 ${getFontClass()} ${
    block.type === 'h1' 
      ? 'font-bold' 
      : ''
  } ${
    isMini ? 'text-zinc-400 dark:text-zinc-600 overflow-hidden' : 'text-zinc-800 dark:text-zinc-300'
  }`;
  
  // Prevent native context menu in Edit Mode to suppress "Look Up / Copy"
  const handleContextMenu = (e: React.MouseEvent) => {
    if (mode === 'edit' || viewMode === 'mini') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  return (
    <motion.div
      layoutId={block.id}
      ref={containerRef}
      className={`relative group transition-all duration-300 ease-in-out pl-4 md:pl-0 
        ${isMini ? 'my-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm hover:border-amber-400 cursor-grab active:cursor-grabbing' : 'my-4'}
        ${mode === 'edit' && !isMini ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30 rounded-lg -ml-12 pl-12 pr-2 py-2 border-l-2 border-transparent hover:border-amber-200 dark:hover:border-amber-800' : ''}
        ${!isActive && mode === 'write' ? 'opacity-80 hover:opacity-100' : 'opacity-100'}
      `}
      onClick={() => {
        if (mode === 'write') onFocus(block.id);
      }}
    >
       {/* 
          MARGIN BORDER CONTROLS 
          Visible in: Edit Mode (Normal View) OR Mini Mode
       */}
       <div className={`absolute left-0 top-0 h-full w-10 flex flex-col justify-start items-center gap-1 py-2 transition-opacity duration-200 
          ${(mode === 'edit' || isMini) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
       >
          {/* Move Up/Down Controls */}
          <div className="flex flex-col gap-1 mb-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onMoveUp(block.id); }}
              disabled={isFirst}
              className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-ink dark:hover:text-white transition-colors ${isFirst ? 'opacity-20' : ''}`}
            >
              <ChevronUp size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onMoveDown(block.id); }}
              disabled={isLast}
              className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-ink dark:hover:text-white transition-colors ${isLast ? 'opacity-20' : ''}`}
            >
              <ChevronDown size={14} />
            </button>
          </div>
       </div>

       {/* AI Analysis Tools (Only visible in Edit Mode + Normal View) */}
       <div className={`absolute -right-10 top-0 h-full flex flex-col justify-start pt-2 gap-2 transition-opacity duration-300 
          ${(mode === 'edit' && !isMini) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
       >
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'sensory'); }}
            className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select"
            title="Sensorize"
          >
            <Eye size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'show-dont-tell'); }}
            className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select"
            title="Show, Don't Tell"
          >
            <BookOpen size={14} />
          </button>
       </div>

       {/* Visual Marker for Active Paragraph - Write Mode Only */}
       <div className={`absolute left-[-16px] top-0 bottom-0 w-[2px] rounded-full bg-amber-500 transition-all duration-500 ${isActive && mode === 'write' ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />

      {mode === 'write' && !isMini ? (
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
        /* Render as DIV in Edit/Mini Mode */
        <div 
          style={fontSizeStyle}
          className={`${commonClasses} whitespace-pre-wrap ${isMini ? 'mini-mode-text h-12 overflow-hidden select-none' : 'editor-content cursor-text selection:bg-amber-200 dark:selection:bg-amber-900/60'}`}
          onContextMenu={handleContextMenu}
        >
          {block.content || <span className="opacity-30 italic">Empty block</span>}
        </div>
      )}
    </motion.div>
  );
};

export default EditorBlock;