import React, { useRef, useEffect, useState, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Sparkles, ArrowRight, X, Trash2, MoreHorizontal, Heading1, Heading2, AlignLeft, Bandage, Wand2, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { simpleWordDiff } from '../utils';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
  onTypeChange?: (id: string, type: 'h1' | 'h2' | 'p' | 'hr') => void;
  onPaste?: (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus: (id: string) => void;
  onAnalyze: (id: string, type: any) => void;
  onRewrite?: (id: string, prompt: string) => void;
  typography: TypographySettings;
  readOnly?: boolean;
  onRemove?: (id: string) => void;
  onEnter?: (id: string, cursorPosition: number) => void;
  isDirty?: boolean;
  isProcessing?: boolean;
  originalContent?: string;
  searchQuery?: string;
  onQuickFix?: (id: string) => void;
}

const EditorBlock: React.FC<EditorBlockProps> = ({ 
  block, 
  isActive, 
  mode, 
  onChange,
  onTypeChange,
  onPaste, 
  onFocus, 
  onAnalyze,
  onRewrite,
  typography,
  readOnly = false,
  onRemove,
  onEnter,
  isDirty,
  isProcessing,
  originalContent,
  searchQuery = "",
  onQuickFix
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  useEffect(() => {
    if (showPrompt && promptInputRef.current) promptInputRef.current.focus();
  }, [showPrompt]);

  useEffect(() => {
      if (!isActive) { setShowPrompt(false); setShowTypeMenu(false); }
  }, [isActive]);

  const showTextarea = (mode === 'write' || (mode === 'edit' && !readOnly)) && (isActive && !isProcessing);
  
  useEffect(() => {
    if (showTextarea && !showPrompt && !showTypeMenu) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            if (textareaRef.current.value && document.activeElement === textareaRef.current) {
                 const len = textareaRef.current.value.length;
                 textareaRef.current.setSelectionRange(len, len);
            }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showTextarea, showPrompt, showTypeMenu]);

  const diffSegments = useMemo(() => {
      if (mode === 'edit' && isDirty && originalContent) return simpleWordDiff(originalContent, block.content);
      return null;
  }, [mode, isDirty, originalContent, block.content]);

  const handlePromptSubmit = async () => {
      if (!promptText.trim() || !onRewrite) return;
      await onRewrite(block.id, promptText);
      setShowPrompt(false);
      setPromptText("");
  };

  const getFontClass = () => {
    if (block.type === 'h1' || block.type === 'h2') return 'font-display';
    switch (typography.fontFamily) {
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      default: return 'font-serif';
    }
  };

  const textStyle = {
    fontSize: block.type === 'h1' ? `${Math.max(typography.fontSize * 2, 32)}px` : block.type === 'h2' ? `${Math.max(typography.fontSize * 1.5, 24)}px` : `${typography.fontSize}px`,
    lineHeight: '1.7',
    opacity: readOnly ? typography.contrast * 0.6 : typography.contrast,
  };

  const getCommonClasses = () => {
    return `w-full bg-transparent border-none outline-none transition-all duration-300 ${getFontClass()} ${
      block.type === 'h1' ? 'font-bold mb-8 mt-4 text-black dark:text-white tracking-tight' : 
      block.type === 'h2' ? 'font-bold mb-6 mt-4 text-zinc-800 dark:text-zinc-100 tracking-tight' : 
      isDirty && !isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-200'
    }`;
  };

  if (block.type === 'hr') {
    return (
        <div data-block-id={block.id} className="relative py-12 my-8 opacity-30 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer group" onClick={() => !readOnly && onFocus(block.id)}>
             <div className="h-0.5 w-32 bg-zinc-300 dark:bg-zinc-700"></div>
             {!readOnly && isActive && (
                <button onClick={(e) => { e.stopPropagation(); onRemove?.(block.id); }} className="absolute right-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 size={16}/></button>
             )}
        </div>
    );
  }

  const containerClasses = [
    'group/block relative transition-all duration-500 px-6 py-4 rounded-2xl',
    isProcessing 
      ? 'bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-400 animate-pulse' 
      : isActive 
        ? 'bg-white dark:bg-zinc-900/50 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 border-l-4 border-accent z-10' 
        : isDirty 
          ? 'bg-indigo-50/30 dark:bg-indigo-900/5 border-l-4 border-indigo-400' 
          : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-900/5 border-l-4 border-transparent'
  ].join(' ');

  return (
    <div
      data-block-id={block.id}
      className={containerClasses}
      onClick={() => !readOnly && onFocus(block.id)}
    >
       {!readOnly && isActive && !showPrompt && !isProcessing && (
           <div className="absolute right-4 -top-12 flex items-center gap-2 z-50">
              <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowTypeMenu(!showTypeMenu); }} className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-xl text-zinc-500 hover:text-accent transition-all hover:scale-110"><MoreHorizontal size={18} /></button>
                  <AnimatePresence>
                    {showTypeMenu && onTypeChange && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute right-0 top-full mt-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl py-2 w-48 z-50 overflow-hidden"
                        >
                            <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'h1'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest"><Heading1 size={16} className="text-zinc-400"/> Title</button>
                            <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'h2'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest"><Heading2 size={16} className="text-zinc-400"/> Subtitle</button>
                            <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'p'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest"><AlignLeft size={16} className="text-zinc-400"/> Body Paragraph</button>
                        </motion.div>
                    )}
                  </AnimatePresence>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onQuickFix?.(block.id); }} className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all hover:scale-110" title="Quick Fix"><Bandage size={18} /></button>
              <button onClick={(e) => { e.stopPropagation(); setShowPrompt(true); }} className="p-2.5 bg-amber-500 text-white rounded-full shadow-xl hover:bg-amber-400 transition-all hover:scale-110" title="AI Rewrite"><Sparkles size={18} /></button>
              <button onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'fluency'); }} className="p-2.5 bg-accent text-white rounded-full shadow-xl hover:bg-indigo-400 transition-all hover:scale-110" title="Editorial Polish"><Wand2 size={18} /></button>
           </div>
       )}

       <AnimatePresence>
         {showPrompt && (
           <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} className="absolute inset-x-0 -top-16 z-50 flex justify-center px-4">
             <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-full shadow-2xl border border-amber-500/40 flex items-center p-2 px-5 gap-4">
                 <Sparkles size={18} className="text-amber-500"/>
                 <input ref={promptInputRef} type="text" value={promptText} onChange={(e) => setPromptText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePromptSubmit(); else if (e.key === 'Escape') setShowPrompt(false); }} placeholder="e.g. Make this more gothic and atmospheric" className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-zinc-800 dark:text-zinc-100 h-10"/>
                 <button onClick={handlePromptSubmit} className="p-2 bg-amber-500 text-white rounded-full hover:bg-amber-400 transition-all shadow-md"><ArrowRight size={18}/></button>
                 <button onClick={() => setShowPrompt(false)} className="p-2 text-zinc-400 hover:text-zinc-600 transition-all"><X size={18}/></button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

      {showTextarea ? (
        <TextareaAutosize
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onChange(block.id, e.target.value)}
          onPaste={(e) => onPaste?.(block.id, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(block.id, e.currentTarget.selectionStart); }
            if ((e.key === 'Backspace' || e.key === 'Delete') && !block.content && onRemove) onRemove(block.id);
          }}
          style={textStyle}
          className={getCommonClasses()}
          placeholder="Start writing your editorial piece..."
        />
      ) : (
        <div style={textStyle} className={`${getCommonClasses()} whitespace-pre-wrap`}>
          {diffSegments ? (
              <span>{diffSegments.map((seg, idx) => (<span key={idx} className={seg.type === 'added' ? 'text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/30 underline decoration-indigo-300' : ''}>{seg.text}</span>))}</span>
          ) : (
             block.content || <span className="opacity-30 italic font-light">Drafting...</span>
          )}
        </div>
      )}
      
      {!readOnly && isActive && !isProcessing && (
          <div className="absolute left-[-2rem] top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-opacity hidden md:block">
              <div className="p-2 text-zinc-300 dark:text-zinc-700 cursor-grab">
                  <GripVertical size={20} />
              </div>
          </div>
      )}
    </div>
  );
};

export default EditorBlock;