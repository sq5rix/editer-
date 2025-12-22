
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, ArrowRightLeft, GripVertical, Trash2, LayoutTemplate } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

import { Theme, TypographySettings, Mode, User as UserType, Suggestion, BraindumpItem, Character, ResearchThread, BookMetadata, Block } from './types';
import { countWords } from './utils';
import * as GeminiService from './services/geminiService';
import * as FirebaseService from './services/firebase';
import * as ExportService from './services/exportService';

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
import OCRModal from './components/OCRModal';
import ShuffleSidebar from './components/ShuffleSidebar';

const App: React.FC = () => {
  // -- Core State --
  const [user, setUser] = useState<(UserType & { uid?: string }) | null>(null);
  const { books, currentBookId, setCurrentBookId, handleCreateBook, handleDeleteBook, handleRenameBook } = useBookManager(user);
  const { 
      blocks, setBlocks, history, redoStack, undo, redo, updateBlock, updateBlockType, addBlock, removeBlock, clearAll, importText, pasteText, saveHistory,
      isAutoCorrecting, processingBlockId, performGrammarCheck, performBlockQuickFix, originalSnapshot, takeSnapshot, revertToSnapshot, partitionBlocks
  } = useManuscript(user, currentBookId);

  // -- Data state for Shuffle Mode --
  const [shuffleData, setShuffleData] = useState<{braindump: BraindumpItem[], characters: Character[], research: ResearchThread[]}>({
    braindump: [],
    characters: [],
    research: []
  });

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
  const [searchQuery, setSearchQuery] = useState("");

  // -- OCR State --
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");

  const [typography, setTypography] = useState<TypographySettings>({ fontFamily: 'serif', fontSize: 18, contrast: 0.95 });

  // -- Auth --
  useEffect(() => {
    return FirebaseService.subscribeToAuth((u) => {
        setUser(u ? { name: u.displayName || 'Writer', email: u.email || '', picture: u.photoURL || '', uid: u.uid } : null);
    });
  }, []);

  const handleLogin = async () => { try { await FirebaseService.loginWithGoogle(); setSettingsOpen(false); } catch (e) { alert("Login failed."); } };
  const handleLogout = async () => { await FirebaseService.logout(); setUser(null); };

  // Load shuffle data and auto-partition if needed
  useEffect(() => {
    if (mode === 'shuffle') {
      const load = async () => {
        const localBD = localStorage.getItem(`inkflow_braindumps_${currentBookId}`) || '[]';
        const localCH = localStorage.getItem(`inkflow_characters_${currentBookId}`) || '[]';
        const localRS = localStorage.getItem(`inkflow_research_threads_${currentBookId}`) || '[]';
        
        setShuffleData({
          braindump: JSON.parse(localBD),
          characters: JSON.parse(localCH),
          research: JSON.parse(localRS)
        });

        // Auto-partition: If only one block and it has internal newlines, split it!
        if (blocks.length === 1 && blocks[0].content.includes('\n')) {
            partitionBlocks();
        }
      };
      load();
    }
  }, [mode, currentBookId]);

  // -- Theme --
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    const actualTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    root.classList.add(actualTheme);
  }, [theme]);

  // -- Selection Logic --
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleSelection = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
          const selection = window.getSelection();
          if (mode !== 'edit' || !selection || selection.isCollapsed || !selection.toString().trim()) {
            if (selectionRect) { setSelectionRect(null); setSelectedText(""); }
            return;
          }
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0) return;

          const blockElement = selection.anchorNode?.parentElement?.closest('[data-block-id]');
          const blockId = blockElement?.getAttribute('data-block-id');
          
          setContextBlockId(blockId || null);
          setSelectionRect({ top: rect.bottom + window.scrollY, left: rect.left + (rect.width / 2) });
          setSelectedText(selection.toString());
          setMenuMode('selection');
      }, 150);
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => { document.removeEventListener('selectionchange', handleSelection); clearTimeout(timeout); };
  }, [mode, selectionRect]);

  // -- Global Actions --
  const handleModeSwitch = useCallback((newMode: Mode) => {
    if (newMode === 'edit') takeSnapshot();
    setMode(newMode);
    setSelectionRect(null);
    setSelectedText("");
  }, [takeSnapshot]);

  const handleGlobalCopy = useCallback(() => {
    const textToCopy = ['research', 'braindump', 'characters', 'metadata'].includes(mode) ? auxContent : blocks.map(b => b.content).join('\n\n');
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => { setGlobalCopySuccess(true); setTimeout(() => setGlobalCopySuccess(false), 2000); });
  }, [mode, auxContent, blocks]);

  const handleExport = async () => {
      setLoading(true);
      try {
          const saved = localStorage.getItem(`inkflow_metadata_${currentBookId}`);
          const metadata: BookMetadata = saved ? JSON.parse(saved) : { title: "Untitled", subtitle: "", author: "Author", blurb: "", copyright: "", kdpTags: [] };
          await ExportService.exportToWord(blocks, metadata);
      } catch (err) { alert("Export failed."); } finally { setLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      setOcrModalOpen(true);
      setOcrLoading(true);
      setOcrText("");
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setOcrImage(base64);
        try {
          const text = await GeminiService.transcribeImage(base64.split(',')[1]);
          setOcrText(text);
        } catch (err) { setOcrText("Error transcribing image."); } finally { setOcrLoading(false); }
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };

  const handleOCRInsert = (text: string, insertMode: 'append' | 'cursor') => {
      if (!text) { setOcrModalOpen(false); return; }
      if (insertMode === 'cursor' && activeBlockId) pasteText(activeBlockId, text); else importText(text);
      setOcrModalOpen(false);
  };

  // -- AI Handlers --
  const handleGeminiAction = async (action: 'synonym' | 'expand' | 'grammar') => {
    if (!selectedText) return;
    setLoading(true); setSidebarOpen(true); setSuggestion(null); setSelectionRect(null);
    try {
        let results: string[] = [];
        if (action === 'synonym') results = await GeminiService.getSynonyms(selectedText);
        else if (action === 'expand') results = await GeminiService.expandText(selectedText);
        else if (action === 'grammar') results = await GeminiService.checkGrammar(selectedText);
        setSuggestion({ type: action, originalText: selectedText, options: results });
    } catch { alert("AI Service Error"); } finally { setLoading(false); }
  };

  const handleBlockAnalysis = async (blockId: string, type: Suggestion['type']) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type === 'hr') return;
    setLoading(true); setSidebarOpen(true); setSuggestion(null); setSelectionRect(null);
    try {
        const results = await GeminiService.analyzeParagraph(block.content, type as any);
        setSuggestion({ type, originalText: block.content, options: results });
        setContextBlockId(blockId);
    } catch { alert("Analysis Error"); } finally { setLoading(false); }
  };

  const handleCustomPrompt = async (prompt: string) => {
    let textToAnalyze = selectedText || (contextBlockId && blocks.find(b => b.id === contextBlockId)?.content);
    if (!textToAnalyze) return;
    setLoading(true); setSidebarOpen(true); setSuggestion(null); setSelectionRect(null);
    try {
        const results = await GeminiService.customRewrite(textToAnalyze, prompt);
        setSuggestion({ type: 'custom', originalText: textToAnalyze, options: results });
    } catch { alert("Custom AI Error"); } finally { setLoading(false); }
  };

  const applySuggestion = (text: string) => {
    saveHistory();
    if (contextBlockId) {
        const block = blocks.find(b => b.id === contextBlockId);
        if (block) {
            if (['sensory','show-dont-tell','fluency','custom','sense-of-place'].includes(suggestion?.type || '')) {
                updateBlock(block.id, text);
            } else if (suggestion?.originalText) {
                updateBlock(block.id, block.content.replace(suggestion.originalText, text));
            }
        }
    }
    setSidebarOpen(false); setSelectionRect(null); window.getSelection()?.removeAllRanges();
  };

  const wordCount = useMemo(() => countWords(blocks), [blocks]);

  const handleShuffle = () => {
    saveHistory();
    const shuffled = [...blocks];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setBlocks(shuffled);
  };

  return (
    <div className="min-h-screen relative font-sans selection:bg-amber-200 dark:selection:bg-amber-900/50 touch-manipulation flex flex-col overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
      
      {loading && !sidebarOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
             <div className="bg-white dark:bg-zinc-800 p-4 rounded-full shadow-2xl"><Loader2 className="animate-spin text-amber-500" size={32} /></div>
          </div>
      )}

      <TopBar 
          mode={mode} setMode={handleModeSwitch} user={user} wordCount={wordCount} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={redoStack.length > 0}
          onImport={handleFileUpload} onCopy={handleGlobalCopy} copySuccess={globalCopySuccess} onClear={clearAll} onExport={handleExport}
          onGrammar={performGrammarCheck} isGrammarRunning={isAutoCorrecting} onApprove={takeSnapshot} onRevert={revertToSnapshot} onSettings={() => setSettingsOpen(true)} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
      />

      <main className={`flex-1 relative z-10 transition-all duration-300 flex flex-col pt-20 h-[calc(100vh-5rem)]`}>
        <div className={`flex flex-1 w-full mx-auto h-full overflow-hidden ${mode === 'edit' || mode === 'shuffle' ? 'max-w-none px-0' : 'max-w-4xl px-6 md:px-12'}`}>
          {mode === 'shuffle' && (
            <aside className="w-80 border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col bg-zinc-50/50 dark:bg-zinc-900/10 flex-shrink-0">
              <ShuffleSidebar 
                onInsert={(t) => {
                   if (activeBlockId) pasteText(activeBlockId, t);
                   else importText(t);
                }}
                onNavigate={(id) => {
                  setActiveBlockId(id);
                  const el = document.querySelector(`[data-block-id="${id}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                blocks={blocks}
                braindumpData={shuffleData.braindump}
                characterData={shuffleData.characters}
                researchData={shuffleData.research}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </aside>
          )}

          <div className={`flex-1 h-full overflow-y-auto no-scrollbar ${mode === 'edit' || mode === 'shuffle' ? 'px-8 py-8' : 'py-12'}`}>
            {mode === 'braindump' ? ( <BraindumpView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
            ) : mode === 'research' ? ( <ResearchView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
            ) : mode === 'characters' ? ( <CharactersView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} manuscriptText={blocks.map(b => b.content).join('\n')} />
            ) : mode === 'metadata' ? ( <MetadataView onCopy={setSelectedText} typography={typography} manuscriptText={blocks.map(b => b.content).join('\n')} onActiveContentUpdate={setAuxContent} user={user} books={books} currentBookId={currentBookId} onSwitchBook={setCurrentBookId} onCreateBook={handleCreateBook} onDeleteBook={handleDeleteBook} onRenameBook={handleRenameBook} />
            ) : mode === 'analysis' ? ( <StyleAnalysisView text={blocks.map(b => b.content).join('\n\n')} typography={typography} user={user} bookId={currentBookId} />
            ) : mode === 'shuffle' ? (
              <div className="max-w-4xl mx-auto py-10">
                 <div className="flex items-center justify-between mb-12 border-b-2 border-zinc-200 dark:border-zinc-800 pb-4">
                    <div>
                        <h2 className="font-display font-bold text-2xl text-ink dark:text-zinc-100 uppercase tracking-widest">Structural Shuffle</h2>
                        <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-mono">Rearrange the narrative flow</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={partitionBlocks}
                            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
                            title="Split long text into paragraphs"
                        >
                            <LayoutTemplate size={14} /> Auto-Split
                        </button>
                        <button 
                            onClick={handleShuffle}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
                        >
                            Random Shuffle
                        </button>
                    </div>
                 </div>
                 <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-4 pb-40">
                    {blocks.map(block => (
                      <Reorder.Item 
                        key={block.id} 
                        value={block}
                        className="group bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm hover:shadow-xl cursor-grab active:cursor-grabbing transition-all border-l-4 border-l-indigo-500/50"
                      >
                        <div className="flex items-start gap-4">
                            <div className="mt-1 text-zinc-300 group-hover:text-indigo-500 transition-colors"><GripVertical size={20} /></div>
                            <div className="flex-1">
                                {block.type === 'hr' ? (
                                    <div className="h-px w-full bg-zinc-200 dark:bg-zinc-700 my-4"></div>
                                ) : (
                                    <p 
                                        className={`line-clamp-3 font-serif leading-relaxed text-zinc-700 dark:text-zinc-300 select-none ${block.type === 'h1' ? 'font-bold text-xl' : block.type === 'h2' ? 'font-bold text-lg' : ''}`}
                                        style={{ fontSize: `${typography.fontSize}px` }}
                                    >
                                        {block.content || <span className="opacity-30 italic">Empty paragraph</span>}
                                    </p>
                                )}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </Reorder.Item>
                    ))}
                 </Reorder.Group>
              </div>
            ) : mode === 'edit' ? (
              <div className="flex flex-col h-full max-w-6xl mx-auto">
                <div className="grid grid-cols-2 gap-12 flex-none mb-8">
                   <div className="flex items-center gap-3 text-xs font-bold text-amber-600 uppercase tracking-widest border-b-2 border-amber-500/30 pb-3"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>Live Editor</div>
                   <div className="flex items-center gap-3 text-xs font-bold text-zinc-400 uppercase tracking-widest border-b-2 border-zinc-200 dark:border-zinc-800 pb-3"><ArrowRightLeft size={12} />Original Snapshot</div>
                </div>
                <div className="space-y-8 pb-32">
                    {blocks.map((block) => {
                         const snap = originalSnapshot.find(b => b.id === block.id);
                         return (
                            <div key={block.id} className="grid grid-cols-2 gap-12 items-start group/row">
                                <EditorBlock block={block} isActive={activeBlockId === block.id} onChange={updateBlock} onTypeChange={updateBlockType} onFocus={setActiveBlockId} onAnalyze={handleBlockAnalysis} onRewrite={handleCustomPrompt} typography={typography} mode="edit" isDirty={!snap || snap.content !== block.content} isProcessing={processingBlockId === block.id} originalContent={snap?.content} searchQuery={searchQuery} onQuickFix={performBlockQuickFix} onRemove={removeBlock} onEnter={addBlock} />
                                <div className="opacity-40 group-hover/row:opacity-100 transition-opacity">
                                    {snap ? <EditorBlock block={snap} isActive={false} mode="edit" onChange={() => {}} onFocus={() => {}} onAnalyze={() => {}} typography={typography} readOnly={true} /> : <div className="p-4 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 italic text-center">New Block</div>}
                                </div>
                            </div>
                         );
                    })}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-32">
                {blocks.map(block => (
                  <EditorBlock 
                      key={block.id} 
                      block={block} 
                      isActive={activeBlockId === block.id} 
                      mode={mode === 'shuffle' ? 'write' : mode} 
                      onChange={updateBlock} 
                      onTypeChange={updateBlockType} 
                      onFocus={setActiveBlockId} 
                      onAnalyze={handleBlockAnalysis} 
                      onRewrite={handleCustomPrompt} 
                      typography={typography} 
                      onRemove={removeBlock} 
                      onEnter={addBlock} 
                      searchQuery={searchQuery} 
                      onQuickFix={performBlockQuickFix} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <OCRModal isOpen={ocrModalOpen} onClose={() => setOcrModalOpen(false)} onInsert={handleOCRInsert} imageSrc={ocrImage} initialText={ocrText} isLoading={ocrLoading} />
      
      {mode === 'edit' && selectionRect && (
          <FloatingMenu position={selectionRect} menuType={menuMode} onSynonym={() => handleGeminiAction('synonym')} onExpand={() => handleGeminiAction('expand')} onGrammar={() => handleGeminiAction('grammar')} onSensory={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sensory')} onShowDontTell={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'show-dont-tell')} onSenseOfPlace={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sense-of-place')} onCustom={handleCustomPrompt} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} suggestions={suggestion} onApply={applySuggestion} loading={loading} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={setTheme} typography={typography} onTypographyChange={setTypography} user={user} onLogout={handleLogout} onLogin={handleLogin} />
    </div>
  );
};

export default App;
