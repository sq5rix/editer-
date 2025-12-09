import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Moon, Sun, Monitor, Shuffle, Copy, Type, Plus, Minus, PenTool, Edit3, Grid, Layout } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { Block, Suggestion, Theme, TypographySettings, Mode, ViewMode } from './types';
import { parseTextToBlocks, countWords, shuffleArray } from './utils';
import * as GeminiService from './services/geminiService';

import EditorBlock from './components/EditorBlock';
import FloatingMenu from './components/FloatingMenu';
import Sidebar from './components/Sidebar';

const App: React.FC = () => {
  // -- State --
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uuidv4(), type: 'p', content: '' }
  ]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [theme, setTheme] = useState<Theme>('system');
  const [mode, setMode] = useState<Mode>('write');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Settings Menus
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  // Typography Settings
  const [typography, setTypography] = useState<TypographySettings>({
    fontFamily: 'serif',
    fontSize: 18
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Theme Handling --
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // -- Text Selection Logic --
  useEffect(() => {
    const handleSelection = () => {
      // Only process selection in Edit Mode
      if (mode !== 'edit' || viewMode === 'mini') {
        if (selectionRect) {
            setSelectionRect(null);
            setSelectedText("");
        }
        return;
      }

      const selection = window.getSelection();
      
      // If no selection or empty
      if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
        setSelectionRect(null);
        setSelectedText("");
        return;
      }

      // Important: Check if we are selecting inside the editor area
      const anchorNode = selection.anchorNode;
      const isEditor = anchorNode?.parentElement?.closest('main');

      if (!isEditor) {
          setSelectionRect(null);
          return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 && rect.height === 0) return;

      setSelectionRect({
        top: rect.top,
        left: rect.left + (rect.width / 2)
      });
      setSelectedText(selection.toString());
    };

    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('scroll', handleSelection);
    
    return () => {
        document.removeEventListener('selectionchange', handleSelection);
        window.removeEventListener('scroll', handleSelection);
    };
  }, [mode, viewMode, selectionRect]); 

  // -- Block Management --
  const handleBlockChange = (id: string, newContent: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const moveBlockUp = (id: string) => {
    const index = blocks.findIndex(b => b.id === id);
    if (index > 0) {
      const newBlocks = [...blocks];
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      setBlocks(newBlocks);
    }
  };

  const moveBlockDown = (id: string) => {
    const index = blocks.findIndex(b => b.id === id);
    if (index < blocks.length - 1) {
      const newBlocks = [...blocks];
      [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
      setBlocks(newBlocks);
    }
  };

  const handleShuffle = () => {
    if (blocks.length <= 1) return;
    const newBlocks = shuffleArray([...blocks]);
    setBlocks(newBlocks);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      setLoading(true);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        try {
          const text = await GeminiService.transcribeImage(base64Data);
          const newBlocks = parseTextToBlocks(text);
          if (blocks.length === 1 && blocks[0].content === '') {
             setBlocks(newBlocks);
          } else {
             setBlocks(prev => [...prev, ...newBlocks]);
          }
        } catch (err) {
          alert('Failed to read image');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // -- AI Features --
  const handleGeminiAction = async (action: 'synonym' | 'expand' | 'grammar') => {
    if (!selectedText) return;
    
    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);

    let results: string[] = [];
    
    if (action === 'synonym') results = await GeminiService.getSynonyms(selectedText);
    if (action === 'expand') results = await GeminiService.expandText(selectedText);
    if (action === 'grammar') results = await GeminiService.checkGrammar(selectedText);

    setSuggestion({
      type: action,
      originalText: selectedText,
      options: results
    });
    setLoading(false);
  };

  const handleBlockAnalysis = async (blockId: string, type: 'sensory' | 'show-dont-tell') => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);

    const results = await GeminiService.analyzeParagraph(block.content, type);
    
    setSuggestion({
      type: type,
      originalText: block.content,
      options: results
    });
    setLoading(false);
  };

  const applySuggestion = (text: string) => {
    if (suggestion?.type === 'sensory' || suggestion?.type === 'show-dont-tell') {
       const blockIndex = blocks.findIndex(b => b.content === suggestion.originalText);
       if (blockIndex !== -1) {
           const newBlocks = [...blocks];
           newBlocks[blockIndex] = { ...newBlocks[blockIndex], content: text };
           setBlocks(newBlocks);
       }
    } else {
      const block = blocks.find(b => b.content.includes(suggestion?.originalText || ''));
      if (block) {
        const newContent = block.content.replace(suggestion?.originalText || '', text);
        handleBlockChange(block.id, newContent);
      }
    }
    setSidebarOpen(false);
    window.getSelection()?.removeAllRanges();
    setSelectionRect(null);
  };

  // -- Layout --
  return (
    <div 
      className="min-h-screen relative font-sans selection:bg-amber-200 dark:selection:bg-amber-900/50 touch-manipulation"
    >
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {/* Header / Nav */}
      <header className="fixed top-0 left-0 w-full p-4 md:p-6 flex justify-between items-center z-30 bg-gradient-to-b from-paper via-paper/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 h-24 pointer-events-none ui-no-select">
        <div className="pointer-events-auto flex items-center gap-4">
            <h1 className="font-display font-bold text-2xl tracking-wider text-ink dark:text-zinc-100 hidden md:block">InkFlow</h1>
            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2 hidden md:block"></div>
            
            {/* Mode Switcher */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 shadow-inner border border-zinc-200 dark:border-zinc-700">
                <button 
                    onClick={() => { setMode('write'); setViewMode('normal'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'write' 
                        ? 'bg-white dark:bg-zinc-700 text-ink dark:text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <PenTool size={14} /> <span className="hidden sm:inline">Write</span>
                </button>
                <button 
                    onClick={() => setMode('edit')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'edit' 
                        ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Edit3 size={14} /> <span className="hidden sm:inline">Edit</span>
                </button>
            </div>

            {/* View Mode Toggle (Mini) - Only visible when NOT in write mode */}
            {mode === 'edit' && (
              <button 
                onClick={() => setViewMode(viewMode === 'normal' ? 'mini' : 'normal')}
                className={`p-2 rounded-full transition-colors ${viewMode === 'mini' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                title="Toggle Mini Overview"
              >
                 {viewMode === 'normal' ? <Grid size={18} /> : <Layout size={18} />}
              </button>
            )}
        </div>

        <div className="pointer-events-auto flex gap-2 sm:gap-3">
             {/* Typography Menu */}
             <div className="relative">
                <button 
                  onClick={() => { setShowTypeMenu(!showTypeMenu); setShowThemeMenu(false); }} 
                  className={`p-3 rounded-full transition-all touch-manipulation ${showTypeMenu ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                >
                    <Type size={20} />
                </button>
                {showTypeMenu && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-900 shadow-xl rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4 min-w-[200px]"
                    >
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-zinc-500 uppercase font-medium">Font Family</span>
                          <div className="flex gap-1">
                             <button 
                                onClick={() => setTypography(prev => ({ ...prev, fontFamily: 'serif' }))}
                                className={`flex-1 py-2 px-3 text-sm rounded border ${typography.fontFamily === 'serif' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                             >
                                Serif
                             </button>
                             <button 
                                onClick={() => setTypography(prev => ({ ...prev, fontFamily: 'sans' }))}
                                className={`flex-1 py-2 px-3 text-sm rounded border ${typography.fontFamily === 'sans' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                             >
                                Sans
                             </button>
                             <button 
                                onClick={() => setTypography(prev => ({ ...prev, fontFamily: 'mono' }))}
                                className={`flex-1 py-2 px-3 text-sm rounded border ${typography.fontFamily === 'mono' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                             >
                                Mono
                             </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                           <span className="text-xs text-zinc-500 uppercase font-medium">Font Size</span>
                           <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-1">
                              <button onClick={() => setTypography(prev => ({ ...prev, fontSize: Math.max(12, prev.fontSize - 2) }))} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded shadow-sm transition-colors">
                                <Minus size={14} />
                              </button>
                              <span className="text-sm font-medium w-8 text-center">{typography.fontSize}</span>
                              <button onClick={() => setTypography(prev => ({ ...prev, fontSize: Math.min(48, prev.fontSize + 2) }))} className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded shadow-sm transition-colors">
                                <Plus size={14} />
                              </button>
                           </div>
                        </div>
                    </motion.div>
                )}
             </div>

             {/* Theme Toggle */}
             <div className="relative">
                <button 
                  onClick={() => { setShowThemeMenu(!showThemeMenu); setShowTypeMenu(false); }} 
                  className={`p-3 rounded-full transition-all touch-manipulation ${showThemeMenu ? 'bg-zinc-200 dark:bg-zinc-800' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                >
                    {theme === 'light' && <Sun size={20} />}
                    {theme === 'dark' && <Moon size={20} />}
                    {theme === 'system' && <Monitor size={20} />}
                </button>
                {showThemeMenu && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute right-0 top-full mt-2 bg-white dark:bg-zinc-900 shadow-xl rounded-lg p-2 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 min-w-[120px]"
                    >
                        <button onClick={() => setTheme('light')} className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-sm"><Sun size={14}/> Light</button>
                        <button onClick={() => setTheme('dark')} className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-sm"><Moon size={14}/> Dark</button>
                        <button onClick={() => setTheme('system')} className="flex items-center gap-2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-sm"><Monitor size={14}/> System</button>
                    </motion.div>
                )}
             </div>
        </div>
      </header>

      {/* Main Editor Area */}
      <main className={`max-w-3xl mx-auto pt-32 pb-48 px-6 md:px-12 relative z-10 min-h-screen ${viewMode === 'mini' ? 'grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-min' : ''}`}>
        {blocks.map((block, index) => (
            <EditorBlock
                key={block.id}
                block={block}
                isActive={activeBlockId === block.id}
                mode={mode}
                viewMode={viewMode}
                onChange={handleBlockChange}
                onFocus={setActiveBlockId}
                onAnalyze={handleBlockAnalysis}
                onMoveUp={moveBlockUp}
                onMoveDown={moveBlockDown}
                typography={typography}
                isFirst={index === 0}
                isLast={index === blocks.length - 1}
            />
        ))}

        {/* Empty state or add new block hint (Only in Write Mode) */}
        {mode === 'write' && (
          <div 
              onClick={() => {
                  const newId = uuidv4();
                  setBlocks([...blocks, { id: newId, type: 'p', content: '' }]);
                  setActiveBlockId(newId);
              }}
              className="h-32 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group ui-no-select"
          >
              <span className="text-zinc-400 font-serif italic group-hover:translate-y-1 transition-transform">Click to add new paragraph...</span>
          </div>
        )}
      </main>

      {/* Floating Action Bar (Selection - Edit Mode Only - Normal View Only) */}
      {mode === 'edit' && viewMode === 'normal' && (
          <FloatingMenu 
            position={selectionRect}
            onSynonym={() => handleGeminiAction('synonym')}
            onExpand={() => handleGeminiAction('expand')}
            onGrammar={() => handleGeminiAction('grammar')}
          />
      )}

      {/* Sidebar (Analysis) */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        suggestions={suggestion}
        onApply={applySuggestion}
        loading={loading}
      />

      {/* Bottom Sticky Toolbar */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-6 py-3 flex items-center gap-6 z-[100] transition-all duration-500 hover:scale-105 ui-no-select">
        <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 group text-zinc-500 hover:text-ink dark:hover:text-zinc-200 transition-colors touch-manipulation"
            title="Import Handwriting"
        >
            <Camera size={22} className="group-hover:-translate-y-1 transition-transform duration-300" />
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
        </button>

        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>

        <button 
            type="button"
            onClick={handleShuffle}
            className={`flex flex-col items-center gap-1 group transition-colors touch-manipulation ${blocks.length > 1 ? 'text-zinc-500 hover:text-ink dark:hover:text-zinc-200' : 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'}`}
            title="Shuffle Paragraphs"
        >
            <Shuffle size={22} className="group-hover:rotate-180 transition-transform duration-500 ease-out" />
        </button>

        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800"></div>

        <button 
            type="button"
            onClick={() => {
                const fullText = blocks.map(b => b.content).join('\n\n');
                navigator.clipboard.writeText(fullText);
            }}
            className="flex flex-col items-center gap-1 group text-zinc-500 hover:text-ink dark:hover:text-zinc-200 transition-colors touch-manipulation"
            title="Copy All"
        >
            <Copy size={22} className="group-hover:-translate-y-1 transition-transform duration-300" />
        </button>
      </div>

    </div>
  );
};

export default App;