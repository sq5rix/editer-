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

  const [typography, setTypography] = useState<TypographySettings>({ fontFamily: 'serif', fontSize: 20, contrast: 0.95 });

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
    // Auto focus first block if writing
    if (newMode === 'write' && blocks.length > 0 && !activeBlockId) {
       setActiveBlockId(blocks[0].id);
    }
  }, [takeSnapshot, blocks, activeBlockId]);

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

  const handleCustomRewrite = async (blockId: string, prompt: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setLoading(true); setSidebarOpen(true); setSuggestion(null);
    try {
        const results = await GeminiService.customRewrite(block.content, prompt);
        setSuggestion({ type: 'custom', originalText: block.content, options: results });
        setContextBlockId(blockId);
    } catch { alert("Magic draft failed."); } finally { setLoading(false); }
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
    // Deep clone to ensure Reorder components recognize the change
    setBlocks(JSON.parse(JSON.stringify(shuffled)));
  };

  return (
    <div className="h-full relative font-sans selection:bg-accent/20 dark:selection:bg-accent/40 touch-manipulation flex flex-col overflow-hidden bg-paper dark:bg-zinc-950">
      
      {loading && !sidebarOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-paper/20 dark:bg-black/20 backdrop-blur-sm">
             <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800"><Loader2 className="animate-spin text-accent" size={32} /></div>
          </div>
      )}

      <TopBar 
          mode={mode} setMode={handleModeSwitch} user={user} wordCount={wordCount} onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={redoStack.length > 0}
          onImport={handleFileUpload} onCopy={handleGlobalCopy} copySuccess={globalCopySuccess} onClear={clearAll} onExport={handleExport}
          onGrammar={performGrammarCheck} isGrammarRunning={isAutoCorrecting} onApprove={takeSnapshot} onRevert={revertToSnapshot} onSettings={() => setSettingsOpen(true)} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
      />

      <main className="flex-1 relative z-10 transition-all duration-300 flex flex-col pt-20 h-[calc(100vh-5rem)] overflow-hidden">
        <div className={`flex flex-1 w-full mx-auto h-full overflow-hidden ${mode === 'edit' || mode === 'shuffle' ? 'max-w-none px-0' : 'max-w-5xl px-0'}`}>
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

          <div className={`flex-1 h-full overflow-y-auto no-scrollbar scroll-smooth relative ${mode === 'edit' || mode === 'shuffle' ? 'px-4 md:px-8 py-10' : 'px-6 md:px-12 py-16'}`}>
            {mode === 'braindump' ? ( <BraindumpView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
            ) : mode === 'research' ? ( <ResearchView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} />
            ) : mode === 'characters' ? ( <CharactersView onCopy={setSelectedText} typography={typography} onActiveContentUpdate={setAuxContent} user={user} bookId={currentBookId} manuscriptText={blocks.map(b => b.content).join('\n')} />
            ) : mode === 'metadata' ? ( <MetadataView onCopy={setSelectedText} typography={typography} manuscriptText={blocks.map(b => b.content).join('\n')} onActiveContentUpdate={setAuxContent} user={user} books={books} currentBookId={currentBookId} onSwitchBook={setCurrentBookId} onCreateBook={handleCreateBook} onDeleteBook={handleDeleteBook} onRenameBook={handleRenameBook} />
            ) : mode === 'analysis' ? ( <StyleAnalysisView text={blocks.map(b => b.content).join('\n\n')} typography={typography} user={user} bookId={currentBookId} />
            ) : mode === 'shuffle' ? (
              <div className="max-w-4xl mx-auto py-10">
                 <div className="flex items-center justify-between mb-12 border-b-2 border-zinc-200 dark:border-zinc-800 pb-6">
                    <div>
                        <h2 className="font-display font-bold text-3xl text-ink dark:text-zinc-100 uppercase tracking-widest">Structural Edit</h2>
                        <p className="text-xs text-zinc-400 mt-2 uppercase tracking-[0.2em] font-mono">Reshape the editorial flow</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={partitionBlocks}
                            className="flex items-center gap-2 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-sm active:scale-95"
                            title="Split long text into paragraphs"
                        >
                            <LayoutTemplate size={16} /> Auto-Split
                        </button>
                        <button 
                            onClick={handleShuffle}
                            className="flex items-center gap-2 px-7 py-3 bg-accent text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                        >
                            Transpose
                        </button>
                    </div>
                 </div>
                 <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-6 pb-40 min-h-full">
                    {blocks.map(block => (
                      <Reorder.Item 
                        key={block.id} 
                        value={block}
                        className="group bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-2xl cursor-grab active:cursor-grabbing transition-all border-l-4 border-l-accent/50"
                      >
                        <div className="flex items-start gap-6">
                            <div className="mt-1 text-zinc-300 group-hover:text-accent transition-colors"><GripVertical size={24} /></div>
                            <div className="flex-1 overflow-hidden">
                                {block.type === 'hr' ? (
                                    <div className="h-0.5 w-full bg-zinc-200 dark:bg-zinc-800 my-4"></div>
                                ) : (
                                    <p 
                                        className={`line-clamp-4 font-serif leading-relaxed text-zinc-700 dark:text-zinc-300 select-none ${block.type === 'h1' ? 'font-bold text-2xl' : block.type === 'h2' ? 'font-bold text-xl' : ''}`}
                                        style={{ fontSize: `${typography.fontSize}px` }}
                                    >
                                        {block.content || <span className="opacity-30 italic">Empty passage</span>}
                                    </p>
                                )}
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                className="opacity-0 group-hover:opacity-100 p-3 text-zinc-400 hover:text-red-500 transition-all"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                      </Reorder.Item>
                    ))}
                 </Reorder.Group>
              </div>
            ) : mode === 'edit' ? (
              <div className="flex flex-col h-full max-w-7xl mx-auto">
                <div className="grid grid-cols-2 gap-16 flex-none mb-12">
                   <div className="flex items-center gap-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] border-b-2 border-indigo-500/20 pb-4"><div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse-soft"></div>Working Draft</div>
                   <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase tracking-[0.3em] border-b-2 border-zinc-200 dark:border-zinc-800 pb-4"><ArrowRightLeft size={14} />Archived Reference</div>
                </div>
                <div className="space-y-12 pb-40">
                    {blocks.map((block) => {
                         const snap = originalSnapshot.find(b => b.id === block.id);
                         return (
                            <div key={block.id} className="grid grid-cols-2 gap-16 items-start group/row">
                                <EditorBlock block={block} isActive={activeBlockId === block.id} onChange={updateBlock} onTypeChange={updateBlockType} onFocus={setActiveBlockId} onAnalyze={handleBlockAnalysis} onRewrite={handleCustomRewrite} typography={typography} mode="edit" isDirty={!snap || snap.content !== block.content} isProcessing={processingBlockId === block.id} originalContent={snap?.content} searchQuery={searchQuery} onQuickFix={performBlockQuickFix} onRemove={removeBlock} onEnter={addBlock} />
                                <div className="opacity-30 group-hover/row:opacity-100 transition-all duration-700">
                                    {snap ? <EditorBlock block={snap} isActive={false} mode="edit" onChange={() => {}} onFocus={() => {}} onAnalyze={() => {}} typography={typography} readOnly={true} /> : <div className="p-8 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-sm text-zinc-400 italic text-center">Fragment Added</div>}
                                </div>
                            </div>
                         );
                    })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-40 max-w-4xl mx-auto">
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
                      onRewrite={handleCustomRewrite} 
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
          <FloatingMenu position={selectionRect} menuType={menuMode} onSynonym={() => handleGeminiAction('synonym')} onExpand={() => handleGeminiAction('expand')} onGrammar={() => handleGeminiAction('grammar')} onSensory={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sensory')} onShowDontTell={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'show-dont-tell')} onSenseOfPlace={() => contextBlockId && handleBlockAnalysis(contextBlockId, 'sense-of-place')} onCustom={handleCustomRewrite} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} suggestions={suggestion} onApply={applySuggestion} loading={loading} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onThemeChange={setTheme} typography={typography} onTypographyChange={setTypography} user={user} onLogout={handleLogout} onLogin={handleLogin} />
    </div>
  );
};

export default App;