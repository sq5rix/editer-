import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Trash2, Check, Brain, User, Feather, Book, ArrowRightLeft, ThumbsUp } from 'lucide-react';
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
  const [originalSnapshot, setOriginalSnapshot] = useState<Block[]>([]); // For Edit Mode "Right Pane"

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

  // Context Menu State
  const [menuMode, setMenuMode] = useState<'selection' | 'block'>('selection');
  const [contextBlockId, setContextBlockId] = useState<string | null>(null); // Targeted block for AI ops
  
  // Scroll Sync Refs
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

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

  // -- Mode Switching Logic --
  const handleModeSwitch = (newMode: Mode) => {
    // When entering edit mode, take a snapshot if we haven't recently? 
    // Actually, simply overwrite snapshot with current state to start "fresh" session
    if (newMode === 'edit') {
       setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
       setSelectionRect(null); // Clear any old menus
    }
    setMode(newMode);
    setSelectionRect(null);
  };

  const handleApproveChanges = () => {
    // Update the "Original" snapshot to match current Live blocks
    setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
    // Optional visual feedback could go here
  };

  // -- Scroll Sync Logic (Edit Mode) --
  const handleScrollSync = (source: 'left' | 'right') => {
    if (mode !== 'edit') return;
    if (isSyncingScroll.current) return;

    isSyncingScroll.current = true;
    const left = leftPaneRef.current;
    const right = rightPaneRef.current;

    if (left && right) {
        const src = source === 'left' ? left : right;
        const dest = source === 'left' ? right : left;
        
        // Calculate percentage
        const percentage = src.scrollTop / (src.scrollHeight - src.clientHeight);
        
        // Apply to dest (if scrollable)
        if (dest.scrollHeight > dest.clientHeight) {
            dest.scrollTop = percentage * (dest.scrollHeight - dest.clientHeight);
        }
    }

    // Debounce lock
    setTimeout(() => {
        isSyncingScroll.current = false;
    }, 50);
  };

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

      const anchorNode = selection.anchorNode;
      const isEditor = anchorNode?.parentElement?.closest('main');

      if (!isEditor) {
          setSelectionRect(null);
          return;
      }

      // Identify which block ID this selection belongs to
      const blockElement = anchorNode?.parentElement?.closest('[data-block-id]');
      const blockId = blockElement?.getAttribute('data-block-id');
      if (blockId) setContextBlockId(blockId);

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 && rect.height === 0) return;

      setSelectionRect({
        top: rect.bottom, 
        left: rect.left + (rect.width / 2)
      });
      setSelectedText(selection.toString());
      setMenuMode('selection');
    };

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
    // In edit mode (split screen), we don't switch to 'write' mode globally 
    // because edit mode *is* now the writing interface for the left pane.
  };

  const handleBlockPaste = (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    
    if (text.includes('\n') || text.length > 150) {
      e.preventDefault();
      saveHistory(); 
      
      const newBlocksData = parseTextToBlocks(text);
      if (newBlocksData.length === 0) return;

      setBlocks(prev => {
        const index = prev.findIndex(b => b.id === id);
        if (index === -1) return prev;

        const currentBlock = prev[index];
        const newBlockList = [...prev];

        if (currentBlock.content.trim() === '') {
           newBlockList.splice(index, 1, ...newBlocksData);
        } else {
           newBlockList.splice(index + 1, 0, ...newBlocksData);
        }
        
        return newBlockList;
      });
    }
  };

  const handleShuffleReorder = (newBlocks: Block[]) => {
      saveHistory(); 
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
          saveHistory(); 
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
      setSelectionRect(null); 
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
    setSelectionRect(null);

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
    // If context block isn't set (e.g. from margin button), set it
    if (!contextBlockId) setContextBlockId(blockId);
    
    // Find content from LIVE blocks, not snapshot, to ensure we analyze current state
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);
    setSelectionRect(null);

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
      type: 'expand',
      originalText: textToAnalyze,
      options: results
    });
    setLoading(false);
  };

  const applySuggestion = (text: string) => {
    saveHistory(); 
    
    // Logic: Always apply to the Live Blocks state using contextBlockId
    // If contextBlockId is missing, fallback to string matching (less reliable)

    if (contextBlockId) {
       setBlocks(prev => prev.map(b => {
           if (b.id !== contextBlockId) return b;
           
           // If it's a full replacement (sensory/show-dont-tell)
           if (suggestion?.type === 'sensory' || suggestion?.type === 'show-dont-tell') {
               return { ...b, content: text };
           }

           // If it's a partial replacement (synonym/grammar)
           // We try to replace the *original selected text* within the block
           if (suggestion?.originalText && b.content.includes(suggestion.originalText)) {
               return { ...b, content: b.content.replace(suggestion.originalText, text) };
           }
           
           return b;
       }));
    } else {
        // Fallback for when ID is lost
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
                    onClick={() => handleModeSwitch('metadata')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'metadata' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Book size={14} /> <span className="hidden sm:inline">Meta</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('braindump')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'braindump' 
                        ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Brain size={14} /> <span className="hidden sm:inline">Brain</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('characters')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'characters' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <User size={14} /> <span className="hidden sm:inline">Characters</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('research')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'research' 
                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Globe size={14} /> <span className="hidden sm:inline">Research</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('write')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'write' 
                        ? 'bg-white dark:bg-zinc-700 text-ink dark:text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <PenTool size={14} /> <span className="hidden sm:inline">Write</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('edit')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'edit' 
                        ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Edit3 size={14} /> <span className="hidden sm:inline">Edit</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('shuffle')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                        mode === 'shuffle' 
                        ? 'bg-white dark:bg-zinc-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                >
                    <Shuffle size={14} /> <span className="hidden sm:inline">Shuffle</span>
                </button>
                <button 
                    onClick={() => handleModeSwitch('analysis')}
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
             {/* Common Tools - Available everywhere except modal-like modes */}
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

                 {mode !== 'edit' && (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200 transition-all"
                        title="Import Handwriting"
                    >
                        <Camera size={18} />
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                    </button>
                 )}
               </>
             )}

             <button 
                onClick={handleGlobalCopy}
                className={`p-2 rounded-full transition-all ${globalCopySuccess ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}
                title="Copy Content"
             >
                {globalCopySuccess ? <Check size={18} /> : <Copy size={18} />}
             </button>

             {/* Approve Button (Only Edit Mode) */}
             {mode === 'edit' && (
                <button
                    onClick={handleApproveChanges}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all"
                    title="Sync Original with Live"
                >
                    <ThumbsUp size={14} /> Approve
                </button>
             )}

             {mode !== 'research' && mode !== 'braindump' && mode !== 'characters' && mode !== 'analysis' && mode !== 'metadata' && mode !== 'edit' && (
               <button 
                  onClick={handleClearText}
                  className="p-2 rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                  title="Clear Text"
               >
                  <Trash2 size={18} />
               </button>
             )}

             <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

             {/* Settings Button */}
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
      {/* Dynamic styling for Edit Mode (Split Screen) - Use full viewport height and disable outer scroll */}
      <main className={`mx-auto relative z-10 transition-all duration-300 flex flex-col ${
          mode === 'edit' 
            ? 'w-full md:max-w-7xl h-[100dvh] pt-28 pb-4 px-4 md:px-8 overflow-hidden' 
            : 'max-w-3xl min-h-screen pt-32 pb-24 px-6 md:px-12'
      }`}>
        
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
        ) : mode === 'edit' ? (
           // -- SPLIT SCREEN EDIT MODE --
           // Use flex-1 min-h-0 to ensure children scroll properly within the fixed parent height
           <div className="grid grid-cols-2 gap-4 md:gap-8 flex-1 min-h-0">
               
               {/* LEFT PANE (LIVE / EDITABLE) */}
               <div className="flex flex-col h-full min-h-0">
                   <div className="flex-none mb-2 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                       <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                       Live Editor
                   </div>
                   <div 
                      ref={leftPaneRef}
                      onScroll={() => handleScrollSync('left')}
                      className="flex-1 overflow-y-auto pl-4 pr-4 border-r border-zinc-200 dark:border-zinc-800"
                   >
                        {blocks.map((block) => (
                            <EditorBlock
                                key={block.id}
                                block={block}
                                isActive={activeBlockId === block.id}
                                onChange={handleBlockChange}
                                onPaste={handleBlockPaste}
                                onFocus={(id) => { setActiveBlockId(id); setContextBlockId(id); }}
                                onAnalyze={handleBlockAnalysis}
                                typography={typography}
                                mode="edit" // Pass edit mode so the margin buttons appear
                                readOnly={false}
                            />
                        ))}
                   </div>
               </div>

               {/* RIGHT PANE (ORIGINAL / SNAPSHOT) */}
               <div className="flex flex-col h-full min-h-0">
                   <div className="flex-none mb-2 flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                       <ArrowRightLeft size={12} />
                       Original
                   </div>
                   <div 
                       ref={rightPaneRef}
                       onScroll={() => handleScrollSync('right')}
                       className="flex-1 overflow-y-auto pl-4 opacity-70 hover:opacity-100 transition-opacity"
                   >
                        {originalSnapshot.map((block) => (
                            <EditorBlock
                                key={block.id}
                                block={block}
                                isActive={false}
                                mode="edit"
                                onChange={() => {}}
                                onFocus={() => {}}
                                onAnalyze={() => {}}
                                typography={typography}
                                readOnly={true} // Force static render
                            />
                        ))}
                   </div>
               </div>
           </div>
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
          // -- STANDARD WRITE MODE --
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

    </div>
  );
};

export default App;