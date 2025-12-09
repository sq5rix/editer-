import React, { useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Eye, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
  onFocus: (id: string) => void;
  onAnalyze: (id: string, type: 'sensory' | 'show-dont-tell') => void;
  typography: TypographySettings;
}

const EditorBlock: React.FC<EditorBlockProps> = ({ block, isActive, mode, onChange, onFocus, onAnalyze, typography }) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
  
  return (
    <motion.div
      layoutId={block.id}
      ref={containerRef}
      className={`relative group transition-all duration-500 ease-in-out my-4 pl-4 md:pl-0 ${
        isActive && mode === 'write'
          ? 'translate-x-0' 
          : mode === 'edit' ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/30 rounded-lg -ml-4 pl-4 pr-2' : 'opacity-80 hover:opacity-100'
      }`}
    >
       {/* Active Block Indicator / Margin Actions - ONLY IN EDIT MODE */}
       <div className={`absolute -left-12 top-0 h-full flex flex-col justify-center items-end gap-2 pr-2 transition-opacity duration-300 ${mode === 'edit' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <button 
            onClick={() => onAnalyze(block.id, 'sensory')}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select"
            title="Sensorize"
          >
            <Eye size={16} />
          </button>
          <button 
            onClick={() => onAnalyze(block.id, 'show-dont-tell')}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-500 transition-colors shadow-sm ui-no-select"
            title="Show, Don't Tell"
          >
            <BookOpen size={16} />
          </button>
       </div>

       {/* Visual Marker for Active Paragraph - Write Mode Only */}
       <div className={`absolute left-[-20px] top-0 bottom-0 w-[3px] rounded-full bg-amber-500 transition-all duration-500 ${isActive && mode === 'write' ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />

      <TextareaAutosize
        readOnly={mode === 'edit'}
        value={block.content}
        onChange={(e) => onChange(block.id, e.target.value)}
        onFocus={() => onFocus(block.id)}
        style={fontSizeStyle}
        className={`w-full bg-transparent resize-none outline-none border-none transition-all duration-300 ${getFontClass()} ${
          block.type === 'h1' 
            ? 'font-bold mb-6 mt-8 text-ink dark:text-zinc-100' 
            : 'text-zinc-800 dark:text-zinc-300'
        } ${mode === 'edit' ? 'cursor-text selection:bg-amber-200 dark:selection:bg-amber-900/60' : ''}`}
        placeholder={block.type === 'h1' ? "Chapter Title..." : "Start writing..."}
      />
    </motion.div>
  );
};

export default EditorBlock;