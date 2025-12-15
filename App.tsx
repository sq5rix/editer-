import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { Theme, TypographySettings, Mode, User as UserType, Suggestion, BraindumpItem, Character, ResearchThread } from './types';
import { countWords } from './utils';
import * as GeminiService from './services/geminiService';
import * as FirebaseService from './services/firebase';

import { useBookManager } from './hooks/useBookManager';
import { useManuscript } from './hooks/useManuscript';

import TopBar from './components/TopBar';
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
  
  // -- Hooks --
  const { books, currentBookId, setCurrentBookId, handleCreateBook, handleDeleteBook, handleRenameBook } = useBookManager(user);
  const { 
      blocks, setBlocks, history, redoStack, undo, redo, updateBlock, addBlock, removeBlock, clearAll, importText, pasteText, saveHistory,
      isAutoCorrecting, processingBlockId, performGrammarCheck, originalSnapshot, takeSnapshot, revertToSnapshot
  } = useManuscript(user, currentBookId);

  // -- UI State --
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [theme, setTheme] = useState<Theme>('system');
  const [mode, setMode] = useState<Mode>('write');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auxContent, setAuxContent] = useState(""); 
  const [globalCopySuccess, setGlobalCopySuccess] = useState(false);
  const [menuMode, setMenuMode] = useState<'selection' | 'block'>('selection');
  const [contextBlockId, setContextBlockId] = useState<string | null>(null);
  
  // -- Global Search State --
  const [searchQuery, setSearchQuery] = useState("");

  // -- Sidebar Data State (Lifted for Shuffle Mode) --
  const [braindumpItems, setBraindumpItems] = useState<BraindumpItem[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [researchThreads, setResearchThreads] = useState<ResearchThread[]>([]);
  
  // Typography Settings
  const [typography, setTypography] = useState<TypographySettings>({
    fontFamily: 'serif',
    fontSize: 18,
    contrast: 0.95
  });

  // -- Load Aux Data for Shuffle Mode --
  useEffect(() => {
      const loadAux = () => {
        try {
            const bd = localStorage.getItem(`inkflow_braindumps_${currentBookId}`);
            if (bd) setBraindumpItems(JSON.parse(bd));
            const ch = localStorage.getItem(`inkflow_characters_${currentBookId}`);
            if (ch) setCharacters(JSON.parse(ch));
            const rs = localStorage.getItem(`inkflow_research_threads_${currentBookId}`);
            if (rs) setResearchThreads(JSON.parse(rs));
        } catch (e) { console.error(e); }
      };
      loadAux();
      const interval = setInterval(loadAux, 2000);
      return () => clearInterval(interval);
  }, [currentBookId]);


  // -- Auth Listener --
  useEffect(() => {
    const unsubscribe = FirebaseService.subscribeToAuth((firebaseUser) => {
        if (firebaseUser) {
            setUser({
                name: firebaseUser.displayName || 'Writer',
                email: firebaseUser.email || '',
                picture: firebaseUser.photoURL || '',
                uid: firebaseUser.uid
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
          alert("Login failed.");
      }
  };

  const handleLogout = async () => {
      await FirebaseService.logout();
      setUser(null);
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

  // -- Event Handlers --

  const handleModeSwitch = (newMode: Mode) => {
    if (newMode === 'edit') {
       takeSnapshot();
       setSelectionRect(null); 
    }
    setMode(newMode);
    setSelectionRect(null);
  };

  const handleAutoCorrect = () => {
      performGrammarCheck();
  };

  const handleClearText = () => {
      if (!window.confirm("Are you sure you want to delete the entire manuscript?")) return;
      const newId = clearAll();
      setActiveBlockId(newId);
      if (mode === 'shuffle') setMode('write');
  };

  const copyToClipboard = (text: string) => {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
          setGlobalCopySuccess(true);
          setTimeout(() => setGlobalCopySuccess(false), 2000);
      }).catch(err => console.error("Copy failed", err));
  };

  const handleGlobalCopy = () => {
    const textToCopy = (mode === 'research' || mode === 'braindump' || mode === 'characters' || mode === 'metadata')
        ? auxContent 
        : blocks.map(b => b.type === 'hr' ? '---' : b.content).join('\n\n');
    
    copyToClipboard(textToCopy);
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
          importText(text);
        } catch (err) {
          console.error(err);
          alert('Failed to read image.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

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

      setSelectionRect({ top: rect.bottom, left: rect.left + (rect.width / 2) });
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

  // -- Block Interaction Wrappers --
  const handleBlockChangeWrapper = (id: string, content: string) => updateBlock(id, content);
  
  const handleBlockEnterWrapper = (id: string, cursorPosition: number) => {
      const block = blocks.find(b => b.id === id);
      if (!block) return;
      const textBefore = block.content.slice(0, cursorPosition);
      const textAfter = block.content.slice(cursorPosition);
      
      updateBlock(id, textBefore); // Update current
      const newId = addBlock(id, textAfter); // Add new after
      setActiveBlockId(newId);
  };

  const handleRemoveBlockWrapper = (id: string) => {
      const index = blocks.findIndex(b => b.id === id);
      if (index > 0) setActiveBlockId(blocks[index - 1].id);
      else if (blocks.length > 1) setActiveBlockId(blocks[index + 1].id);
      else setActiveBlockId(null);
      removeBlock(id);
  };
  
  const handleBlockPasteWrapper = (id: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const text = e.clipboardData.getData('text');
      if (text.includes('\n') || text.length > 150) {
          e.preventDefault();
          pasteText(id, text);
      }
  };

  const handleSearchNavigate = (blockId: string) => {
      // Must take snapshot before switching to edit mode so "Original" pane has content
      takeSnapshot();
      setMode('edit');
      setActiveBlockId(blockId);
      setContextBlockId(blockId);
  };

  // -- AI Helpers --
  const handleGeminiAction = async (action: 'synonym' | 'expand' | 'grammar') => {
    if (!selectedText) return;
    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);
    setSelectionRect(null);
    try {
        let results: string[] = [];
        if (action === 'synonym') results = await GeminiService.getSynonyms(selectedText);
        if (action === 'expand') results = await GeminiService.expandText(selectedText);
        if (action === 'grammar') results = await GeminiService.checkGrammar(selectedText);
        setSuggestion({ type: action, originalText: selectedText, options: results });
    } catch { alert("AI Error"); } 
    finally { setLoading(false); }
  };

  const handleBlockAnalysis = async (blockId: string, type: 'sensory' | 'show-dont-tell' | 'fluency' | 'sense-of-place') => {
    if (!contextBlockId) setContextBlockId(blockId);
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type === 'hr') return;
    setLoading(true);
    setSidebarOpen(true);
    setSuggestion(null);
    setSelectionRect(null);
    try {
        const results = await GeminiService.analyzeParagraph(block.content, type);
        setSuggestion({ type: type, originalText: block.content, options: results });
    } catch { alert("Analysis Error"); }
    finally { setLoading(false); }
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
    try {
        const results = await GeminiService.customRewrite(textToAnalyze, prompt);
        setSuggestion({ type: 'expand', originalText: textToAnalyze, options: results });
    } catch { alert("Prompt Error"); }
    finally { setLoading(false); }
  };

  const applySuggestion = (text: string) => {
    saveHistory();
    if (contextBlockId) {
        const block = blocks.find(b => b.id === contextBlockId);
        if (block) {
            if (['sensory','show-dont-tell','fluency','custom','sense-of-place'].includes(suggestion?.type || '')) {
                updateBlock(block.id, text);
            } else if (suggestion?.originalText && block.content.includes(suggestion.originalText)) {
                updateBlock(block.id, block.content.replace(suggestion.originalText, text));
            }
        }
    }
    setSidebarOpen(false);
    window.getSelection()?.removeAllRanges();
    setSelectionRect(null);
  };

  const handleBlockRewrite = async (id: string, prompt: string) => {
      setContextBlockId(id);
      handleCustomPrompt(prompt);
  };

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
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

      {loading && !sidebarOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm">
             <div className="bg-white dark:bg-zinc-800 p-4 rounded-full shadow-2xl animate-bounce">
                <Loader2 className="animate-spin text-amber-500" size={32} />
             </div>
          </div>
      )}

      <TopBar 
          mode={mode}
          setMode={handleModeSwitch}
          user={user}
          wordCount={countWords(blocks)}
          onUndo={undo}
          onRedo={redo}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0}
          onImport={handleFileUpload}
          onCopy={handleGlobalCopy}
          copySuccess={globalCopySuccess}
          onClear={handleClearText}
          onGrammar={handleAutoCorrect}
          isGrammarRunning={isAutoCorrecting}
          onApprove={takeSnapshot}
          onRevert={revertToSnapshot}
          onSettings={() => setSettingsOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
      />

      <main className={`mx-auto relative z-10 transition-all duration-300 flex flex-col ${
          mode === 'edit' || mode === 'shuffle'
            ? 'w-full md:max-w-7xl h-[100dvh] pt-28 pb-4 px-4 md:px-8 overflow-hidden' 
            : 'max-w-3xl min-h-screen pt-32 pb-24 px-6 md:px-12'
      }`}>
        
        {mode === 'braindump' ? (
           <BraindumpView onCopy={copyToClipboard} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
        ) : mode === 'research' ? (
          <ResearchView onCopy={copyToClipboard} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
        ) : mode === 'characters' ? (
           <CharactersView onCopy={copyToClipboard} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} manuscriptText={blocks.map(b => b.content).join('\n')} />
        ) : mode === 'metadata' ? (
           <MetadataView onCopy={copyToClipboard} typography={typography} manuscriptText={blocks.map(b => b.content).join('\n')} onActiveContentUpdate={setAuxContent} user={user} books={books} currentBookId={currentBookId} onSwitchBook={setCurrentBookId} onCreateBook={handleCreateBook} onDeleteBook={handleDeleteBook} onRenameBook={handleRenameBook} />
        ) : mode === 'analysis' ? (
           <StyleAnalysisView text={blocks.map(b => b.content).join('\n\n')} typography={typography} user={user} bookId={currentBookId} />
        ) : mode === 'edit' ? (
           <div className="flex flex-col h-full min-h-0">
               {/* Headers - Fixed */}
               <div className="grid grid-cols-2 gap-8 flex-none mb-4 px-4 pr-6">
                   <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest pl-4 border-b border-amber-500/20 pb-2">
                       <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                       Live Editor
                   </div>
                   <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest pl-4 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                       <ArrowRightLeft size={12} />
                       Original Snapshot
                   </div>
               </div>
               
               {/* Scrollable Row Content */}
               <div className="flex-1 overflow-y-auto px-4 pb-20 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                    {blocks.map((block) => {
                         const snapshotBlock = originalSnapshot.find(b => b.id === block.id);
                         const isDirty = mode === 'edit' && (!snapshotBlock || snapshotBlock.content !== block.content);
                         
                         return (
                            <div key={block.id} className="grid grid-cols-2 gap-8 items-start mb-6 group/row">
                                <div className="min-w-0">
                                    <EditorBlock
                                        key={`${block.id}-edit`}
                                        block={block}
                                        isActive={activeBlockId === block.id}
                                        onChange={handleBlockChangeWrapper}
                                        onPaste={handleBlockPasteWrapper}
                                        onFocus={(id) => { setActiveBlockId(id); setContextBlockId(id); }}
                                        onAnalyze={handleBlockAnalysis}
                                        onRewrite={handleBlockRewrite}
                                        typography={typography}
                                        mode="edit" 
                                        readOnly={isAutoCorrecting}
                                        onRemove={handleRemoveBlockWrapper}
                                        onEnter={handleBlockEnterWrapper}
                                        isDirty={isDirty}
                                        isProcessing={processingBlockId === block.id}
                                        originalContent={snapshotBlock?.content || ""}
                                        searchQuery={searchQuery}
                                    />
                                </div>
                                <div className="min-w-0 opacity-60 group-hover/row:opacity-100 transition-opacity">
                                    {snapshotBlock ? (
                                        <EditorBlock
                                            key={`${snapshotBlock.id}-snapshot`}
                                            block={snapshotBlock}
                                            isActive={false}
                                            mode="edit"
                                            onChange={() => {}}
                                            onFocus={() => {}}
                                            onAnalyze={() => {}}
                                            typography={typography}
                                            readOnly={true}
                                            searchQuery={searchQuery}
                                        />
                                    ) : (
                                        <div className="p-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400 italic text-center mt-4">
                                            New Paragraph
                                        </div>
                                    )}
                                </div>
                            </div>
                         );
                    })}
               </div>
           </div>
        ) : mode === 'shuffle' ? (
           <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-4 md:gap-8">
               <div className="hidden md:block h-full min-h-0">
                   <ShuffleSidebar 
                      onInsert={(text) => addBlock(activeBlockId || blocks[blocks.length-1]?.id || uuidv4(), text)} 
                      onNavigate={handleSearchNavigate}
                      blocks={blocks}
                      braindumpData={braindumpItems}
                      characterData={characters}
                      researchData={researchThreads}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                   />
               </div>
               <div className="flex flex-col h-full min-h-0 overflow-y-auto pr-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const text = e.dataTransfer.getData('text/plain'); if(text) addBlock(uuidv4(), text); }}>
                   <Reorder.Group axis="y" values={blocks} onReorder={(newBlocks) => { saveHistory(); setBlocks(newBlocks); }} className="flex flex-col gap-4 pb-24">
                      {blocks.map((block) => (
                        <EditorBlock
                            key={`${block.id}-shuffle`}
                            block={block}
                            isActive={false}
                            mode={mode}
                            onChange={handleBlockChangeWrapper}
                            onPaste={handleBlockPasteWrapper}
                            onFocus={() => {}}
                            onAnalyze={() => {}}
                            typography={typography}
                            onShuffleSelect={(id) => { setActiveBlockId(id); setMode('write'); }}
                            onShuffleContextMenu={(id, pos) => { setContextBlockId(id); setSelectionRect(pos); setMenuMode('block'); }}
                            searchQuery={searchQuery}
                        />
                      ))}
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
                    onChange={handleBlockChangeWrapper}
                    onPaste={handleBlockPasteWrapper}
                    onFocus={setActiveBlockId}
                    onAnalyze={handleBlockAnalysis}
                    onRewrite={handleBlockRewrite}
                    typography={typography}
                    onRemove={handleRemoveBlockWrapper}
                    onEnter={handleBlockEnterWrapper}
                    searchQuery={searchQuery}
                />
            ))}
            {mode === 'write' && (
              <div onClick={() => { const newId = addBlock(blocks[blocks.length-1]?.id || uuidv4(), ''); setActiveBlockId(newId); }} className="h-32 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer group ui-no-select">
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