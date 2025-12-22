
import React, { useRef, useEffect, useState, useMemo } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Block, TypographySettings, Mode } from '../types';
import { Eye, BookOpen, Sparkles, ArrowRight, X, MapPin, Trash2, MoreHorizontal, Heading1, Heading2, AlignLeft, Bandage, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { simpleWordDiff } from '../utils';

interface EditorBlockProps {
  block: Block;
  isActive: boolean;
  mode: Mode;
  onChange: (id: string, newContent: string) => void;
  onTypeChange?: (id: string, type: 'h1' | 'h2' | 'p') => void;
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
  const [isRewriting, setIsRewriting] = useState(false);
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
      setIsRewriting(true);
      await onRewrite(block.id, promptText);
      setIsRewriting(false);
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
    fontSize: block.type === 'h1' ? `${Math.max(typography.fontSize * 2, 24)}px` : block.type === 'h2' ? `${Math.max(typography.fontSize * 1.5, 20)}px` : `${typography.fontSize}px`,
    lineHeight: '1.8',
    opacity: readOnly ? typography.contrast * 0.7 : typography.contrast,
  };

  const commonClasses = `w-full bg-transparent outline-none border-none transition-all duration-300 ${getFontClass()} ${
    block.type === 'h1' ? 'font-bold mb-6 mt-8 text-black dark:text-white' : block.type === 'h2' ? 'font-bold mb-4 mt-6 text-zinc-800 dark:text-zinc-100' : isDirty ? 'text-orange-900 dark:text-orange-100' : 'text-zinc-900 dark:text-white'
  }`;

  if (block.type === 'hr') {
    return (
        <div data-block-id={block.id} className="relative py-6 my-2 opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => !readOnly && onFocus(block.id)}>
             <div className="h-px w-full max-w-lg bg-zinc-400 dark:bg-zinc-600"></div>
             {!readOnly && isActive && (
                <button onClick={(e) => { e.stopPropagation(); onRemove?.(block.id); }} className="absolute right-0 p-1.5 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full shadow-sm"><Trash2 size={14}/></button>
             )}
        </div>
    );
  }

  return (
    <div
      data-block-id={block.id}
      className={`relative transition-all duration-300 ${isProcessing ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-400 pl-4 py-2 animate-pulse' : isDirty ? 'bg-orange-50/40 dark:bg-orange-900/10 border-l-4 border-orange-400 pl-4 py-2' : isActive ? 'bg-zinc-50 dark:bg-zinc-900/30 pl-4 py-2 rounded-lg' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 pl-4 py-2 rounded-lg'}`}
      onClick={() => !readOnly && onFocus(block.id)}
    >
       {!readOnly && isActive && !showPrompt && !isProcessing && (
           <div className="absolute right-0 -top-7 flex items-center gap-2 z-20">
              <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowTypeMenu(!showTypeMenu); }} className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 rounded-full shadow-sm text-zinc-500"><MoreHorizontal size={14} /></button>
                  {showTypeMenu && onTypeChange && (
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 shadow-xl rounded-lg py-1 w-40 z-50 overflow-hidden">
                          <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'h1'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 text-xs font-bold uppercase"><Heading1 size={14}/> Title</button>
                          <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'h2'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 text-xs font-bold uppercase"><Heading2 size={14}/> Subtitle</button>
                          <button onClick={(e) => { e.stopPropagation(); onTypeChange(block.id, 'p'); setShowTypeMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 text-xs font-bold uppercase"><AlignLeft size={14}/> Body</button>
                      </div>
                  )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onQuickFix?.(block.id); }} className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 rounded-full shadow-sm text-teal-600"><Bandage size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); setShowPrompt(true); }} className="p-1.5 bg-amber-500 text-white rounded-full shadow-sm"><Sparkles size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); onAnalyze(block.id, 'fluency'); }} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-full border border-indigo-200"><Wand2 size={14} /></button>
           </div>
       )}

       <AnimatePresence>
         {showPrompt && (
           <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute inset-x-0 -top-12 z-30 flex justify-center px-4">
             <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-amber-500/30 flex items-center p-1 px-3 gap-2">
                 <Sparkles size={14} className="text-amber-500"/>
                 <input ref={promptInputRef} type="text" value={promptText} onChange={(e) => setPromptText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handlePromptSubmit(); else if (e.key === 'Escape') setShowPrompt(false); }} placeholder="How should I rewrite this?" className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 h-8"/>
                 <button onClick={handlePromptSubmit} className="p-1.5 bg-amber-500 text-white rounded-full"><ArrowRight size={14}/></button>
                 <button onClick={() => setShowPrompt(false)} className="p-1.5 text-zinc-400"><X size={14}/></button>
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
          className={`${commonClasses} resize-none`}
          placeholder="..."
        />
      ) : (
        <div style={textStyle} className={`${commonClasses} whitespace-pre-wrap`}>
          {diffSegments ? (
              <span>{diffSegments.map((seg, idx) => (<span key={idx} className={seg.type === 'added' ? 'text-orange-600 bg-orange-50 underline decoration-orange-300' : ''}>{seg.text}</span>))}</span>
          ) : (
             block.content || <span className="opacity-30 italic">...</span>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorBlock;
