import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Trash2, Check, Brain, User, Feather, Book } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { Block, Suggestion, Theme, TypographySettings, Mode } from './types';
import { parseTextToBlocks, countWords } from './utils';
import * as GeminiService from './services/geminiService';

import EditorBlock from './components/EditorBlock';
import FloatingMenu from './components/FloatingMenu';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import ResearchView from './components/ResearchView';
import BraindumpView from './components/BraindumpView';
import CharactersView from './components/CharactersView';
import StyleAnalysisView from './components/StyleAnalysisView';
import MetadataView from './components/MetadataView';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Research & Braindump & Metadata State
  const [auxContent, setAuxContent] = useState(""); // Used for global copy in Research/Braindump/Meta
  const [globalCopySuccess, setGlobalCopySuccess] = useState(false);
  
  // Undo/Redo History
  const [history, setHistory] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);

  // Context Menu State for Shuffle Mode
  const [menuMode, setMenuMode] = useState<'selection' | 'block'>('selection');
  const [contextBlockId, setContextBlockId] = useState<string | null>(null);
  
  // Typography Settings
  const [typography, setTypography] = useState<TypographySettings>({
    fontFamily: 'serif',
    fontSize: 18,
    contrast: 0.95
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

  // -- Undo/Redo Logic --
  const saveHistory = useCallback(() => {
    setHistory(prev => {
      // Limit history to 20 steps to save memory
      const newHistory = [...prev, blocks];
      if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
      return newHistory;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, [blocks]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const previousBlocks = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setRedoStack(prev => [...prev, blocks]); // Push current state to Redo
    setBlocks(previousBlocks);
    setHistory(newHistory);
  }, [history, blocks]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextBlocks = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    setHistory(prev => [...prev, blocks]); // Push current to History
    setBlocks(nextBlocks);
    setRedoStack(newRedo);
  }, [redoStack, blocks]);

  // -- Text Selection Logic --
  useEffect(() => {
    const handleSelection = () => {
      // Only process selection in Edit Mode
      if (mode !== 'edit') {
        if (mode === 'write') {
             // In write mode, we generally don't show the menu unless explicitly requested
             if (menuMode === 'selection' && selectionRect) {
                 setSelectionRect(null);
                 setSelectedText("");
             }
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
      
      // Safety check for weird zero-rects
      if (rect.width === 0 && rect.height === 0) return;

      // Position logic: Use bottom to place menu BELOW selection (avoiding iOS menu which is above)
      setSelectionRect({
        top: rect.bottom, 
        left: rect.left + (rect.width / 2)
      });
      setSelectedText(selection.toString());
      setMenuMode('selection');
    };

    // 'selectionchange' fires on document
    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('scroll', handleSelection);
    
    return () => {
        document.removeEventListener('selectionchange', handleSelection);
        window.removeEventListener('scroll', handleSelection);
    };
  }, [mode, selectionRect, menuMode]);

  // -- Block Management --
  const handleBlockChange = (id: string, newContent: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const handleBlockDoubleTap = (id: string) => {
    setActiveBlockId(id);
    setMode('write');
  };

  const handleBlockPaste = (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    
    // Check if the pasted text has structure that needs parsing (newlines or long text)
    if (text.includes('\n') || text.length > 150) {
      e.preventDefault();
      saveHistory(); // Save before paste
      
      const newBlocksData = parseTextToBlocks(text);
      if (newBlocksData.length === 0) return;

      setBlocks(prev => {
        const index = prev.findIndex(b => b.id === id);
        if (index === -1) return prev;

        const currentBlock = prev[index];
        const newBlockList = [...prev];

        // If the current block is effectively empty, replace it with the pasted blocks
        if (currentBlock.content.trim() === '') {
           newBlockList.splice(index, 1, ...newBlocksData);
        } else {
           // Otherwise, insert the new blocks after the current one
           newBlockList.splice(index + 1, 0, ...newBlocksData);
        }
        
        return newBlockList;
      });
    }
  };

  const handleShuffleReorder = (newBlocks: Block[]) => {
      saveHistory(); // Save before reorder
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
          saveHistory(); // Save before OCR import
          const text = await GeminiService.transcribeImage(base64Data);
          const newBlocks = parseTextToBlocks(text);
          if (blocks.length === 1 && blocks[0].content === '') {
             setBlocks(newBlocks);
          } else {
             setBlocks(prev => [...prev, ...newBlocks]);
          }
        } catch (err) {
          console.error(err);
          alert('Failed to read image. Please try again.');
        } finally {
          setLoading(false);
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearText = () => {
    saveHistory();
    const newId = uuidv4();
    setBlocks([{ id: newId, type: 'p', content: '' }]);
    setActiveBlockId(newId);
    if (mode === 'shuffle') setMode('write');
  };

  const handleGlobalCopy = () => {
    const textToCopy = (mode === 'research' || mode === 'braindump' || mode === 'characters' || mode === 'metadata')
        ? auxContent 
        : blocks.map(b => b.content).join('\n\n');
    
    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        setGlobalCopySuccess(true);
        setTimeout(() => setGlobalCopySuccess(false), 2000);
    }
  };

  // -- Interaction Handlers for Shuffle Mode --
  const handleShuffleSelect = (id: string) => {
      setActiveBlockId(id);
      setMode('write');
      setSelectionRect(null); // Close any open menu
  };

  const handleShuffleContextMenu = (id: string, position: { top: number; left: number }) => {
      setContextBlockId(id);
      setSelectionRect(position);
      setMenuMode('block');
  };

  // -- AI Features --
  const handleGeminiAction = async (action: 'synonym' | 'expand' | 'grammar') => {
    if (!selectedText) return;
    
    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);
    setSelectionRect(null); // Hide menu while processing

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
    setSelectionRect(null); // Hide menu

    const results = await GeminiService.analyzeParagraph(block.content, type);
    
    setSuggestion({
      type: type,
      originalText: block.content,
      options: results
    });
    setLoading(false);
  };

  const handleCustomPrompt = async (prompt: string) => {
    let textToAnalyze = selectedText;
    
    // If no text selected, but contextBlockId exists (from shuffle mode), use that block
    if (!textToAnalyze && contextBlockId && menuMode === 'block') {
        const block = blocks.find(b => b.id === contextBlockId);
        if (block) textToAnalyze = block.content;
    }

    if (!textToAnalyze) return;

    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);
    setSelectionRect(null);

    const results = await GeminiService.customRewrite(textToAnalyze, prompt);

    setSuggestion({
      type: 'expand', // 'expand' works well as a generic type for the UI (shows "Variations")
      originalText: textToAnalyze,
      options: results
    });
    setLoading(false);
  };

  const applySuggestion = (text: string) => {
    saveHistory(); // Save before applying changes
    
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
      // Clear menu if clicking elsewhere
      onClick={(e) => {
          // Don't close if clicking inside the floating menu (buttons, inputs)
          if ((e.target as HTMLElement).closest('.fixed.z-50')) return;
          
          if (selectionRect && (e.target as HTMLElement).tagName !== 'BUTTON') {
              setSelectionRect(null);
          }
      }}
    >
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {/* Global Loading Overlay (for OCR) */}
      {loading && !sidebarOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm">
             <div className="bg-white dark:bg-zinc-800 p-4 rounded-full shadow-2xl animate-bounce">
                <Loader2 className="animate-spin text-amber-500" size={32} />
             </div>
          </div>
      )}

      {/* Header / Nav */}
      <header className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-30 bg-gradient-to-b from-paper via-paper/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 h-24 pointer-events-none ui-no-select">
        <div className="pointer-events-auto flex items-center gap-4">
            <h1 className="font-display font-bold text-2xl tracking-wider text-ink dark:text-zinc-100 hidden md:block">InkFlow</h1>
            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2 hidden md:block"></div>
            
            {/* Mode Switcher */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 shadow-inner border border-zinc-200 dark:border-zinc-700">
                <button 
                    onClick={() => { setMode('metadata'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'metadata' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Book size={14} /> <span className="hidden sm:inline">Meta</span>
                </button>
                <button 
                    onClick={() => { setMode('braindump'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'braindump' 
                        ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Brain size={14} /> <span className="hidden sm:inline">Brain</span>
                </button>
                <button 
                    onClick={() => { setMode('characters'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'characters' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <User size={14} /> <span className="hidden sm:inline">Characters</span>
                </button>
                <button 
                    onClick={() => { setMode('research'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'research' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Globe size={14} /> <span className="hidden sm:inline">Research</span>
                </button>
                <button 
                    onClick={() => { setMode('write'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'write' 
                        ? 'bg-white dark:bg-zinc-700 text-ink dark:text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <PenTool size={14} /> <span className="hidden sm:inline">Write</span>
                </button>
                <button 
                    onClick={() => { setMode('edit'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'edit' 
                        ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Edit3 size={14} /> <span className="hidden sm:inline">Edit</span>
                </button>
                <button 
                    onClick={() => { setMode('shuffle'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'shuffle' 
                        ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Shuffle size={14} /> <span className="hidden sm:inline">Shuffle</span>
                </button>
                <button 
                    onClick={() => { setMode('analysis'); setSelectionRect(null); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'analysis' 
                        ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Feather size={14} /> <span className="hidden sm:inline">Style</span>
                </button>
            </div>
            
            <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2"></div>
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest hidden sm:block">
                {countWords(blocks)} Words
            </div>
        </div>

        <div className="pointer-events-auto flex gap-2 sm:gap-3 items-center">
             {mode !== 'research' && mode !== 'braindump' && mode !== 'characters' && mode !== 'analysis' && mode !== 'metadata' && (
               <>
                 <button 
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className={`p-2 rounded-full transition-all ${history.length === 0 ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}
                    title="Undo"
                 >
                     <RotateCcw size={18} />
                 </button>

                 <button 
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className={`p-2 rounded-full transition-all ${redoStack.length === 0 ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}
                    title="Redo"
                 >
                     <RotateCw size={18} />
                 </button>
                 
                 <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200 transition-all"
                    title="Import Handwriting"
                 >
                    <Camera size={18} />
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                 </button>
               </>
             )}

             <button 
                onClick={handleGlobalCopy}
                className={`p-2 rounded-full transition-all ${globalCopySuccess ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}
                title="Copy Content"
             >
                {globalCopySuccess ? <Check size={18} /> : <Copy size={18} />}
             </button>

             {mode !== 'research' && mode !== 'braindump' && mode !== 'characters' && mode !== 'analysis' && mode !== 'metadata' && (
               <button 
                  onClick={handleClearText}
                  className="p-2 rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                  title="Clear Text"
               >
                  <Trash2 size={18} />
               </button>
             )}

             <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

             {/* Consolidated Settings Button */}
             <button 
               onClick={() => setSettingsOpen(true)} 
               className="p-3 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all touch-manipulation text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-200"
               title="Settings"
             >
                 <Settings size={20} />
             </button>
        </div>
      </header>

      {/* Main Editor Area */}
      <main className={`mx-auto pt-32 pb-24 px-6 md:px-12 relative z-10 min-h-screen transition-all duration-300 max-w-3xl flex flex-col`}>
        {mode === 'braindump' ? (
           <BraindumpView 
              typography={typography}
              onCopy={(text) => {
                 navigator.clipboard.writeText(text);
              }}
              onActiveContentUpdate={setAuxContent}
           />
        ) : mode === 'research' ? (
          <ResearchView 
             typography={typography}
             onCopy={(text) => {
                navigator.clipboard.writeText(text);
             }} 
             onActiveContentUpdate={setAuxContent}
          />
        ) : mode === 'characters' ? (
           <CharactersView 
              typography={typography}
              onCopy={(text) => {
                 navigator.clipboard.writeText(text);
              }}
              onActiveContentUpdate={setAuxContent}
           />
        ) : mode === 'metadata' ? (
           <MetadataView 
              typography={typography}
              onCopy={(text) => navigator.clipboard.writeText(text)}
              manuscriptText={blocks.map(b => b.content).join('\n')}
              onActiveContentUpdate={setAuxContent}
           />
        ) : mode === 'analysis' ? (
           <StyleAnalysisView 
              text={blocks.map(b => b.content).join('\n\n')}
              typography={typography}
           />
        ) : mode === 'shuffle' ? (
           <Reorder.Group axis="y" values={blocks} onReorder={handleShuffleReorder} className="flex flex-col gap-4">
              {blocks.map((block) => (
                <EditorBlock
                    key={block.id}
                    block={block}
                    isActive={false}
                    mode={mode}
                    onChange={handleBlockChange}
                    onPaste={handleBlockPaste}
                    onFocus={() => {}}
                    onAnalyze={() => {}}
                    typography={typography}
                    onShuffleSelect={handleShuffleSelect}
                    onShuffleContextMenu={handleShuffleContextMenu}
                />
              ))}
           </Reorder.Group>
        ) : (
          <>
            {blocks.map((block) => (
                <EditorBlock
                    key={block.id}
                    block={block}
                    isActive={activeBlockId === block.id}
                    mode={mode}
                    onChange={handleBlockChange}
                    onPaste={handleBlockPaste}
                    onFocus={setActiveBlockId}
                    onAnalyze={handleBlockAnalysis}
                    typography={typography}
                    onDoubleTap={handleBlockDoubleTap}
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
          </>
        )}
      </main>

      {/* Floating Action Bar / Context Menu */}
      {(mode === 'edit' || (mode === 'shuffle' && menuMode === 'block')) && (
          <FloatingMenu 
            position={selectionRect}
            menuType={menuMode}
            onSynonym={() => handleGeminiAction('synonym')}
            onExpand={() => handleGeminiAction('expand')}
            onGrammar={() => handleGeminiAction('grammar')}
            onSensory={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sensory')}
            onShowDontTell={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'show-dont-tell')}
            onCustom={handleCustomPrompt}
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

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        typography={typography}
        onTypographyChange={setTypography}
      />
      
      {/* Removed Bottom Toolbar */}

    </div>
  );
};

export default App;