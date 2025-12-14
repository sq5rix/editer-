import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Trash2, Check, Brain, User, Feather, Book, ArrowRightLeft, ThumbsUp, ThumbsDown, Wand2 } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { Block, Suggestion, Theme, TypographySettings, Mode, User as UserType, BookEntry } from './types';
import { parseTextToBlocks, countWords } from './utils';
import * as GeminiService from './services/geminiService';
import * as FirebaseService from './services/firebase';

import EditorBlock from './components/EditorBlock';
import FloatingMenu from './components/FloatingMenu';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import ResearchView from './components/ResearchView';
import BraindumpView from './components/BraindumpView';
import CharactersView from './components/CharactersView';
import StyleAnalysisView from './components/StyleAnalysisView';
import MetadataView from './components/MetadataView';
import ShuffleSidebar from './components/ShuffleSidebar';

const App: React.FC = () => {
  // -- Auth State --
  const [user, setUser] = useState<(UserType & { uid?: string }) | null>(null);

  // -- Book Management State --
  const [books, setBooks] = useState<BookEntry[]>(() => {
    try {
        const saved = localStorage.getItem('inkflow_books_index');
        if (saved) return JSON.parse(saved);
        return [{ id: 'default', title: 'Untitled Draft', createdAt: Date.now(), lastModified: Date.now() }];
    } catch {
        return [{ id: 'default', title: 'Untitled Draft', createdAt: Date.now(), lastModified: Date.now() }];
    }
  });
  
  const [currentBookId, setCurrentBookId] = useState<string>(() => {
     return localStorage.getItem('inkflow_active_book_id') || 'default';
  });

  // Ensure current book exists in list
  useEffect(() => {
     if (!books.find(b => b.id === currentBookId)) {
         setCurrentBookId(books[0]?.id || 'default');
     }
     localStorage.setItem('inkflow_active_book_id', currentBookId);
  }, [books, currentBookId]);

  // Save Book Index
  useEffect(() => {
      localStorage.setItem('inkflow_books_index', JSON.stringify(books));
      if (user?.uid) {
          FirebaseService.saveData(user.uid, 'settings', 'books_index', { books });
      }
  }, [books, user]);

  // -- Manuscript State (Specific to Current Book) --
  const [blocks, setBlocks] = useState<Block[]>([{ id: uuidv4(), type: 'p', content: '' }]);
  
  // Load Manuscript when Book ID Changes
  useEffect(() => {
    const loadManuscript = async () => {
        // 1. Try Cloud if logged in
        if (user?.uid) {
             const data = await FirebaseService.loadData(user.uid, 'manuscript', currentBookId);
             if (data && data.blocks) {
                 setBlocks(data.blocks);
                 return;
             }
        }
        
        // 2. Fallback to Local
        const localKey = `inkflow_manuscript_${currentBookId}`;
        const saved = localStorage.getItem(localKey);
        
        // Migration check: if new book (default) but empty, and old legacy key exists, import it
        if (!saved && currentBookId === 'default' && localStorage.getItem('inkflow_manuscript')) {
             const legacy = localStorage.getItem('inkflow_manuscript');
             if (legacy) {
                 setBlocks(JSON.parse(legacy));
                 return;
             }
        }

        if (saved) {
            setBlocks(JSON.parse(saved));
        } else {
            setBlocks([{ id: uuidv4(), type: 'p', content: '' }]);
        }
    };
    loadManuscript();
  }, [currentBookId, user]);

  // Save Manuscript
  useEffect(() => {
      if (!currentBookId) return;
      
      const localKey = `inkflow_manuscript_${currentBookId}`;
      localStorage.setItem(localKey, JSON.stringify(blocks));

      if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'manuscript', currentBookId, { blocks });
            // Update last modified of book
            setBooks(prev => prev.map(b => b.id === currentBookId ? { ...b, lastModified: Date.now() } : b));
        }, 2000);
        return () => clearTimeout(timer);
      }
  }, [blocks, user, currentBookId]);


  const [originalSnapshot, setOriginalSnapshot] = useState<Block[]>([]); 

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [theme, setTheme] = useState<Theme>('system');
  const [mode, setMode] = useState<Mode>('write');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAutoCorrecting, setIsAutoCorrecting] = useState(false);
  const [correctionProgress, setCorrectionProgress] = useState<{ current: number; total: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Research & Braindump & Metadata State
  const [auxContent, setAuxContent] = useState(""); 
  const [globalCopySuccess, setGlobalCopySuccess] = useState(false);
  
  // Undo/Redo History
  const [history, setHistory] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);

  // Context Menu State
  const [menuMode, setMenuMode] = useState<'selection' | 'block'>('selection');
  const [contextBlockId, setContextBlockId] = useState<string | null>(null);
  
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

  // -- Auth Logic --
  useEffect(() => {
    const unsubscribe = FirebaseService.subscribeToAuth((firebaseUser) => {
        if (firebaseUser) {
            setUser({
                name: firebaseUser.displayName || 'Writer',
                email: firebaseUser.email || '',
                picture: firebaseUser.photoURL || '',
                uid: firebaseUser.uid
            });
            // Load Books Index
            FirebaseService.loadData(firebaseUser.uid, 'settings', 'books_index').then(data => {
                if (data && data.books) {
                    setBooks(data.books);
                }
            });
        } else {
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, []);


  const handleLogin = async () => {
      try {
          await FirebaseService.loginWithGoogle();
          setSettingsOpen(false);
      } catch (e) {
          alert("Login failed. Check console or config.");
      }
  };

  const handleLogout = async () => {
      await FirebaseService.logout();
      setUser(null);
  };

  // -- Book Management Handlers --
  const handleCreateBook = () => {
      const newBook: BookEntry = {
          id: uuidv4(),
          title: "Untitled Draft",
          createdAt: Date.now(),
          lastModified: Date.now()
      };
      setBooks(prev => [...prev, newBook]);
      setCurrentBookId(newBook.id);
  };

  const handleDeleteBook = (id: string) => {
      if (books.length <= 1) return; 
      const newBooks = books.filter(b => b.id !== id);
      setBooks(newBooks);
      if (currentBookId === id) setCurrentBookId(newBooks[0].id);
  };

  const handleRenameBook = (id: string, newTitle: string) => {
      setBooks(prev => prev.map(b => b.id === id ? { ...b, title: newTitle } : b));
  };


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
    if (newMode === 'edit') {
       setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
       setSelectionRect(null); 
    }
    setMode(newMode);
    setSelectionRect(null);
  };

  const handleApproveChanges = () => {
    setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
  };

  const handleRevertChanges = () => {
      if (window.confirm("Discard all changes made in the Live Editor?")) {
          setBlocks(JSON.parse(JSON.stringify(originalSnapshot)));
      }
  };

  const handleAutoCorrect = async () => {
      if (!window.confirm("This will process the entire document to correct simple punctuation and grammar mistakes. Continue?")) return;
      
      saveHistory();
      setIsAutoCorrecting(true);
      setCorrectionProgress({ current: 0, total: 0 });

      try {
          // Use a copy to update state incrementally
          let currentBlocks = JSON.parse(JSON.stringify(blocks));
          
          // Identify eligible blocks first to show accurate progress
          const eligibleIndices = currentBlocks.reduce((acc: number[], block: Block, index: number) => {
              if (block.type !== 'hr' && block.content && block.content.trim().length > 5) {
                   // Skip very short H1s
                   if (block.type === 'h1' && block.content.length < 3) return acc;
                   acc.push(index);
              }
              return acc;
          }, []);

          if (eligibleIndices.length === 0) {
            setIsAutoCorrecting(false);
            alert("No text found suitable for correction.");
            return;
          }

          setCorrectionProgress({ current: 0, total: eligibleIndices.length });

          for (let i = 0; i < eligibleIndices.length; i++) {
              const idx = eligibleIndices[i];
              const block = currentBlocks[idx];
              
              setCorrectionProgress({ current: i + 1, total: eligibleIndices.length });

              // Await the API call
              const corrected = await GeminiService.autoCorrect(block.content);
              
              // Update local array
              currentBlocks[idx] = { ...block, content: corrected };
              
              // Force update UI so user sees changes incrementally behind overlay
              setBlocks([...currentBlocks]);
          }

      } catch (e) {
          console.error("Auto-correction error:", e);
          alert("An error occurred during auto-correction. Some changes may not have been applied.");
      } finally {
          setIsAutoCorrecting(false);
          setCorrectionProgress(null);
      }
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
        
        const percentage = src.scrollTop / (src.scrollHeight - src.clientHeight);
        
        if (dest.scrollHeight > dest.clientHeight) {
            dest.scrollTop = percentage * (dest.scrollHeight - dest.clientHeight);
        }
    }

    setTimeout(() => {
        isSyncingScroll.current = false;
    }, 50);
  };

  // -- Undo/Redo Logic --
  const saveHistory = useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev, blocks];
      if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
      return newHistory;
    });
    setRedoStack([]); 
  }, [blocks]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const previousBlocks = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setRedoStack(prev => [...prev, blocks]); 
    setBlocks(previousBlocks);
    setHistory(newHistory);
  }, [history, blocks]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextBlocks = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    setHistory(prev => [...prev, blocks]); 
    setBlocks(nextBlocks);
    setRedoStack(newRedo);
  }, [redoStack, blocks]);

  // -- Text Selection Logic --
  useEffect(() => {
    const handleSelection = () => {
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
    // Recognize --- as break
    if (newContent.trim() === '---') {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'hr', content: '' } : b));
        return;
    }
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const handleBlockEnter = (id: string, cursorPosition: number) => {
    saveHistory();
    const newId = uuidv4();
    
    setBlocks(prev => {
        const index = prev.findIndex(b => b.id === id);
        if (index === -1) return prev;
        
        const currentBlock = prev[index];
        const textBefore = currentBlock.content.slice(0, cursorPosition);
        const textAfter = currentBlock.content.slice(cursorPosition);
        
        const newBlocks = [...prev];
        // Update current block content to text before cursor
        newBlocks[index] = { ...currentBlock, content: textBefore };
        
        // Insert new block with content after cursor
        newBlocks.splice(index + 1, 0, {
            id: newId,
            type: 'p',
            content: textAfter
        });
        
        return newBlocks;
    });
    
    setActiveBlockId(newId);
  };

  const handleRemoveBlock = (id: string) => {
      const index = blocks.findIndex(b => b.id === id);
      if (index > 0) {
          setActiveBlockId(blocks[index - 1].id);
      } else if (blocks.length > 1) {
          setActiveBlockId(blocks[index + 1].id);
      } else {
          setActiveBlockId(null);
      }
      setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleBlockRewrite = async (id: string, prompt: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block || block.type === 'hr') return;

    // Set context so we know where to apply the suggestion
    setContextBlockId(id);

    try {
        const results = await GeminiService.customRewrite(block.content, prompt);
        
        setSuggestion({
            type: 'custom',
            originalText: block.content,
            options: results
        });
        setSidebarOpen(true);
    } catch (e) {
        console.error("Rewrite failed", e);
    }
  };

  const handleBlockDoubleTap = (id: string) => {
    setActiveBlockId(id);
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
  
  // -- Shuffle Drop Logic --
  const handleShuffleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
          handleShuffleInsert(text);
      }
  };
  
  const handleShuffleInsert = (text: string) => {
      saveHistory();
      const newBlock: Block = {
          id: uuidv4(),
          type: 'p',
          content: text
      };
      setBlocks(prev => [...prev, newBlock]);
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
    if (!window.confirm("Are you sure you want to clear the entire manuscript?")) return;
    saveHistory();
    const newId = uuidv4();
    setBlocks([{ id: newId, type: 'p', content: '' }]);
    setActiveBlockId(newId);
    if (mode === 'shuffle') setMode('write');
  };

  const handleGlobalCopy = () => {
    const textToCopy = (mode === 'research' || mode === 'braindump' || mode === 'characters' || mode === 'metadata')
        ? auxContent 
        : blocks.map(b => b.type === 'hr' ? '---' : b.content).join('\n\n'); // Include --- in copy
    
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

  const handleBlockAnalysis = async (blockId: string, type: 'sensory' | 'show-dont-tell' | 'fluency' | 'sense-of-place') => {
    if (!contextBlockId) setContextBlockId(blockId);
    
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type === 'hr') return;

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
        if (block && block.type !== 'hr') textToAnalyze = block.content;
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
    
    if (contextBlockId) {
       setBlocks(prev => prev.map(b => {
           if (b.id !== contextBlockId) return b;
           if (suggestion?.type === 'sensory' || suggestion?.type === 'show-dont-tell' || suggestion?.type === 'fluency' || suggestion?.type === 'custom' || suggestion?.type === 'sense-of-place') {
               return { ...b, content: text };
           }
           if (suggestion?.originalText && b.content.includes(suggestion.originalText)) {
               return { ...b, content: b.content.replace(suggestion.originalText, text) };
           }
           return b;
       }));
    } else {
        if (suggestion?.type === 'sensory' || suggestion?.type === 'show-dont-tell' || suggestion?.type === 'fluency' || suggestion?.type === 'custom' || suggestion?.type === 'sense-of-place') {
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

  const ModeBtn = ({ id, icon: Icon, label }: { id: Mode, icon: any, label: string }) => {
      const isActive = mode === id;
      return (
        <button 
            onClick={() => handleModeSwitch(id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all touch-manipulation ${
                isActive 
                ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
            title={label}
        >
            <Icon size={14} /> 
            <span className={`${isActive ? 'inline' : 'hidden lg:inline'}`}>{label}</span>
        </button>
      );
  };

  // -- Layout --
  return (
    <div 
      className="min-h-screen relative font-sans selection:bg-amber-200 dark:selection:bg-amber-900/50 touch-manipulation"
      onClick={(e) => {
          if ((e.target as HTMLElement).closest('.fixed.z-50')) return;
          if (selectionRect && (e.target as HTMLElement).tagName !== 'BUTTON') {
              setSelectionRect(null);
          }
      }}
    >
      
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {/* Global Loading */}
      {loading && !sidebarOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm">
             <div className="bg-white dark:bg-zinc-800 p-4 rounded-full shadow-2xl animate-bounce">
                <Loader2 className="animate-spin text-amber-500" size={32} />
             </div>
          </div>
      )}

      {/* Auto-Correct Blocking Overlay */}
      {isAutoCorrecting && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm cursor-wait">
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-zinc-200 dark:border-zinc-700 w-80">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <div className="text-center w-full">
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">Polishing Manuscript</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {correctionProgress 
                            ? `Correcting paragraph ${correctionProgress.current} of ${correctionProgress.total}...` 
                            : "Initializing..."}
                    </p>
                </div>
                {/* Progress Bar */}
                {correctionProgress && correctionProgress.total > 0 && (
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden mt-1">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${(correctionProgress.current / correctionProgress.total) * 100}%` }}
                        />
                    </div>
                )}
             </div>
          </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-30 bg-gradient-to-b from-paper via-paper/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 h-24 pointer-events-none ui-no-select flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center pointer-events-auto">
            <div className="flex items-center gap-2 md:gap-4 flex-shrink min-w-0">
                <div className="hidden md:block">
                    <h1 className="font-display font-bold text-xl tracking-wider text-ink dark:text-zinc-100 leading-none">InkFlow</h1>
                    <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1">
                        {countWords(blocks)} Words
                    </div>
                </div>
                <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2 hidden md:block"></div>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-x-auto no-scrollbar max-w-[60vw] md:max-w-none">
                    <ModeBtn id="metadata" icon={Book} label="Meta" />
                    <ModeBtn id="braindump" icon={Brain} label="Brain" />
                    <ModeBtn id="characters" icon={User} label="Chars" />
                    <ModeBtn id="research" icon={Globe} label="Research" />
                    <ModeBtn id="write" icon={PenTool} label="Write" />
                    <ModeBtn id="edit" icon={Edit3} label="Edit" />
                    <ModeBtn id="shuffle" icon={Shuffle} label="Shuffle" />
                    <ModeBtn id="analysis" icon={Feather} label="Style" />
                </div>
            </div>

            <div className="flex gap-1 md:gap-2 items-center flex-shrink-0 ml-2">
                {mode !== 'research' && mode !== 'braindump' && mode !== 'characters' && mode !== 'analysis' && mode !== 'metadata' && (
                <>
                    <button onClick={handleUndo} disabled={history.length === 0} className={`p-2 rounded-full transition-all ${history.length === 0 ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Undo">
                        <RotateCcw size={18} />
                    </button>
                    <button onClick={handleRedo} disabled={redoStack.length === 0} className={`p-2 rounded-full transition-all ${redoStack.length === 0 ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Redo">
                        <RotateCw size={18} />
                    </button>
                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1 hidden sm:block"></div>
                    {mode !== 'edit' && (
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200 transition-all hidden sm:block" title="Import Handwriting">
                            <Camera size={18} />
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                        </button>
                    )}
                </>
                )}

                <button onClick={handleGlobalCopy} className={`p-2 rounded-full transition-all ${globalCopySuccess ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Copy Content">
                    {globalCopySuccess ? <Check size={18} /> : <Copy size={18} />}
                </button>

                {mode === 'edit' && (
                    <div className="flex gap-2">
                        <button 
                            onClick={handleAutoCorrect} 
                            disabled={isAutoCorrecting}
                            className={`flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-wait text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap`}
                            title="Auto Correct"
                        >
                            {isAutoCorrecting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 
                            <span className="hidden md:inline">{isAutoCorrecting ? "Fixing..." : "Correct"}</span>
                        </button>
                        <button onClick={handleApproveChanges} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap" title="Approve Changes">
                            <ThumbsUp size={14} /> <span className="hidden md:inline">Approve</span>
                        </button>
                        <button onClick={handleRevertChanges} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap" title="Revert Changes">
                            <ThumbsDown size={14} /> <span className="hidden md:inline">Revert</span>
                        </button>
                    </div>
                )}

                {mode !== 'research' && mode !== 'braindump' && mode !== 'characters' && mode !== 'analysis' && mode !== 'metadata' && mode !== 'edit' && (
                <button onClick={handleClearText} className="p-2 rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all" title="Clear Text">
                    <Trash2 size={18} />
                </button>
                )}

                <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

                <button onClick={() => setSettingsOpen(true)} className="p-3 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all touch-manipulation text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-200" title="Settings">
                    {user ? (
                        user.picture ? <img src={user.picture} alt="Profile" className="w-5 h-5 rounded-full" /> : <User size={20} className="text-indigo-500" />
                    ) : (
                        <Settings size={20} />
                    )}
                </button>
            </div>
        </div>
      </header>

      {/* Main Editor */}
      <main className={`mx-auto relative z-10 transition-all duration-300 flex flex-col ${
          mode === 'edit' 
            ? 'w-full md:max-w-7xl h-[100dvh] pt-28 pb-4 px-4 md:px-8 overflow-hidden' 
            : mode === 'shuffle' 
                ? 'w-full md:max-w-7xl h-[100dvh] pt-28 pb-4 px-4 md:px-8 overflow-hidden'
                : 'max-w-3xl min-h-screen pt-32 pb-24 px-6 md:px-12'
      }`}>
        
        {mode === 'braindump' ? (
           <BraindumpView 
              typography={typography}
              onCopy={(text) => navigator.clipboard.writeText(text)}
              onActiveContentUpdate={setAuxContent}
              user={user}
              bookId={currentBookId}
           />
        ) : mode === 'research' ? (
          <ResearchView 
             typography={typography}
             onCopy={(text) => navigator.clipboard.writeText(text)} 
             onActiveContentUpdate={setAuxContent}
             user={user}
             bookId={currentBookId}
          />
        ) : mode === 'characters' ? (
           <CharactersView 
              typography={typography}
              onCopy={(text) => navigator.clipboard.writeText(text)}
              onActiveContentUpdate={setAuxContent}
              user={user}
              bookId={currentBookId}
              manuscriptText={blocks.map(b => b.content).join('\n')}
           />
        ) : mode === 'metadata' ? (
           <MetadataView 
              typography={typography}
              onCopy={(text) => navigator.clipboard.writeText(text)}
              manuscriptText={blocks.map(b => b.content).join('\n')}
              onActiveContentUpdate={setAuxContent}
              user={user}
              books={books}
              currentBookId={currentBookId}
              onSwitchBook={setCurrentBookId}
              onCreateBook={handleCreateBook}
              onDeleteBook={handleDeleteBook}
              onRenameBook={handleRenameBook}
           />
        ) : mode === 'analysis' ? (
           <StyleAnalysisView 
              text={blocks.map(b => b.content).join('\n\n')}
              typography={typography}
              user={user}
              bookId={currentBookId}
           />
        ) : mode === 'edit' ? (
           <div className="grid grid-cols-2 gap-4 md:gap-8 flex-1 min-h-0">
               <div className="flex flex-col h-full min-h-0">
                   <div className="flex-none mb-2 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                       <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                       Live Editor
                   </div>
                   <div ref={leftPaneRef} onScroll={() => handleScrollSync('left')} className="flex-1 overflow-y-auto pl-4 pr-4 border-r border-zinc-200 dark:border-zinc-800">
                        {blocks.map((block) => {
                             const snapshotBlock = originalSnapshot.find(b => b.id === block.id);
                             const isDirty = mode === 'edit' && (!snapshotBlock || snapshotBlock.content !== block.content);
                             return (
                                <EditorBlock
                                    key={`${block.id}-edit`}
                                    block={block}
                                    isActive={activeBlockId === block.id}
                                    onChange={handleBlockChange}
                                    onPaste={handleBlockPaste}
                                    onFocus={(id) => { setActiveBlockId(id); setContextBlockId(id); }}
                                    onAnalyze={handleBlockAnalysis}
                                    onRewrite={handleBlockRewrite}
                                    typography={typography}
                                    mode="edit" 
                                    readOnly={isAutoCorrecting}
                                    onRemove={handleRemoveBlock}
                                    onEnter={handleBlockEnter}
                                    isDirty={isDirty}
                                />
                             );
                        })}
                   </div>
               </div>
               <div className="flex flex-col h-full min-h-0">
                   <div className="flex-none mb-2 flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                       <ArrowRightLeft size={12} />
                       Original
                   </div>
                   <div ref={rightPaneRef} onScroll={() => handleScrollSync('right')} className="flex-1 overflow-y-auto pl-4 opacity-70 hover:opacity-100 transition-opacity">
                        {originalSnapshot.map((block) => (
                            <EditorBlock
                                key={`${block.id}-snapshot`}
                                block={block}
                                isActive={false}
                                mode="edit"
                                onChange={() => {}}
                                onFocus={() => {}}
                                onAnalyze={() => {}}
                                typography={typography}
                                readOnly={true}
                            />
                        ))}
                   </div>
               </div>
           </div>
        ) : mode === 'shuffle' ? (
           <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-4 md:gap-8">
               <div className="hidden md:block h-full min-h-0">
                   <ShuffleSidebar onInsert={handleShuffleInsert} />
               </div>
               <div className="flex flex-col h-full min-h-0 overflow-y-auto pr-2" onDragOver={(e) => e.preventDefault()} onDrop={handleShuffleDrop}>
                   <Reorder.Group axis="y" values={blocks} onReorder={handleShuffleReorder} className="flex flex-col gap-4 pb-24">
                      {blocks.map((block) => (
                        <EditorBlock
                            key={`${block.id}-shuffle`}
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
                      {blocks.length === 0 && (
                          <div className="text-center py-20 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                              Drag items here from the left sidebar or type in Write mode.
                          </div>
                      )}
                   </Reorder.Group>
               </div>
           </div>
        ) : (
          <>
            {blocks.map((block) => (
                <EditorBlock
                    key={`${block.id}-write`}
                    block={block}
                    isActive={activeBlockId === block.id}
                    mode={mode}
                    onChange={handleBlockChange}
                    onPaste={handleBlockPaste}
                    onFocus={setActiveBlockId}
                    onAnalyze={handleBlockAnalysis}
                    onRewrite={handleBlockRewrite}
                    typography={typography}
                    onDoubleTap={handleBlockDoubleTap}
                    onRemove={handleRemoveBlock}
                    onEnter={handleBlockEnter}
                />
            ))}
            {mode === 'write' && (
              <div onClick={() => { const newId = uuidv4(); setBlocks([...blocks, { id: newId, type: 'p', content: '' }]); setActiveBlockId(newId); }} className="h-32 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group ui-no-select">
                  <span className="text-zinc-400 font-serif italic group-hover:translate-y-1 transition-transform">Click to add new paragraph...</span>
              </div>
            )}
          </>
        )}
      </main>

      {(mode === 'edit' || (mode === 'shuffle' && menuMode === 'block')) && (
          <FloatingMenu position={selectionRect} menuType={menuMode} onSynonym={() => handleGeminiAction('synonym')} onExpand={() => handleGeminiAction('expand')} onGrammar={() => handleGeminiAction('grammar')} onSensory={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sensory')} onShowDontTell={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'show-dont-tell')} onSenseOfPlace={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sense-of-place')} onCustom={handleCustomPrompt} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} suggestions={suggestion} onApply={applySuggestion} loading={loading} />

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={setTheme} typography={typography} onTypographyChange={setTypography} user={user} onLogout={handleLogout} onLogin={handleLogin} />

    </div>
  );
};

export default App;