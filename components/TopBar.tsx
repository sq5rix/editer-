import React, { useRef, useState } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Check, Brain, User, Feather, Book, ThumbsUp, ThumbsDown, Wand2, Search, X, MoreVertical, Download } from 'lucide-react';
// Import motion and AnimatePresence for the editorial menu animation
import { motion, AnimatePresence } from 'framer-motion';
import { Mode, User as UserType } from '../types';

interface TopBarProps {
    mode: Mode;
    setMode: (m: Mode) => void;
    user: UserType | null;
    wordCount: number;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCopy: () => void;
    copySuccess: boolean;
    onClear: () => void;
    onExport: () => void;
    onGrammar: () => void;
    isGrammarRunning: boolean;
    onApprove: () => void;
    onRevert: () => void;
    onSettings: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

const ModeBtn = ({ id, activeId, icon: Icon, label, onClick }: { id: Mode, activeId: Mode, icon: any, label: string, onClick: (id: Mode) => void }) => {
    const isActive = activeId === id;
    return (
      <button 
          onClick={() => onClick(id)}
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center relative group/tab ${
              isActive 
              ? 'bg-accent text-white shadow-lg shadow-indigo-500/20 scale-105' 
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          title={label}
      >
          <Icon size={18} />
          {/* Custom Tooltip */}
          <span className="absolute top-full mt-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover/tab:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity shadow-xl border border-white/10">
            {label}
          </span>
      </button>
    );
};

const TopBar: React.FC<TopBarProps> = ({
    mode, setMode, user, wordCount,
    onUndo, onRedo, canUndo, canRedo,
    onImport, onCopy, copySuccess, onClear, onExport,
    onGrammar, isGrammarRunning, onApprove, onRevert,
    onSettings, searchQuery, setSearchQuery
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const isAuxMode = ['research', 'braindump', 'characters', 'analysis', 'metadata'].includes(mode);

    return (
        <header className="fixed top-0 left-0 w-full z-[60] bg-paper/80 dark:bg-zinc-950/80 backdrop-blur-2xl h-20 flex items-center shadow-sm border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all">
            <div className="w-full max-w-[95%] mx-auto px-4 flex justify-between items-center gap-6">
                <div className="flex items-center gap-6 flex-shrink min-w-0">
                    <div className="flex flex-col">
                        <h1 className="font-display font-bold text-2xl tracking-[0.1em] text-ink dark:text-zinc-100 leading-none">INKFLOW</h1>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1.5">{wordCount} Words</span>
                    </div>
                    
                    <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden md:block"></div>
                    
                    <nav className="flex bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl p-1 border border-zinc-200/50 dark:border-zinc-800/50 overflow-x-auto no-scrollbar gap-1">
                        <ModeBtn id="metadata" activeId={mode} icon={Book} label="Manuscript" onClick={setMode} />
                        <ModeBtn id="braindump" activeId={mode} icon={Brain} label="Notes" onClick={setMode} />
                        <ModeBtn id="characters" activeId={mode} icon={User} label="Cast" onClick={setMode} />
                        <ModeBtn id="research" activeId={mode} icon={Globe} label="Archive" onClick={setMode} />
                        <ModeBtn id="write" activeId={mode} icon={PenTool} label="Draft" onClick={setMode} />
                        <ModeBtn id="edit" activeId={mode} icon={Edit3} label="Polish" onClick={setMode} />
                        <ModeBtn id="shuffle" activeId={mode} icon={Shuffle} label="Transpose" onClick={setMode} />
                        <ModeBtn id="analysis" activeId={mode} icon={Feather} label="Style" onClick={setMode} />
                    </nav>
                </div>

                <div className="flex gap-2 items-center flex-shrink-0">
                    <div className="relative group hidden xl:block mr-2">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400"><Search size={16} /></div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find in story..."
                            className={`h-11 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-11 pr-4 text-sm outline-none focus:ring-4 focus:ring-accent/10 transition-all ${searchQuery ? 'w-64 border-accent/30' : 'w-40 focus:w-64'}`}
                        />
                         {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600"><X size={14} /></button>}
                    </div>

                    {!isAuxMode && (
                        <div className="flex items-center gap-1">
                            <button onClick={onUndo} disabled={!canUndo} className={`p-2.5 rounded-xl transition-all ${!canUndo ? 'text-zinc-300 dark:text-zinc-800 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title="Undo"><RotateCcw size={20} /></button>
                            <button onClick={onRedo} disabled={!canRedo} className={`p-2.5 rounded-xl transition-all ${!canRedo ? 'text-zinc-300 dark:text-zinc-800 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title="Redo"><RotateCw size={20} /></button>
                            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block"></div>
                            {mode !== 'edit' && (
                                <button onClick={() => fileRef.current?.click()} className="p-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 group/camera relative" title="Import Handwriting">
                                    <Camera size={20} />
                                    <span className="absolute top-full mt-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover/camera:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity shadow-xl border border-white/10">
                                        Import Handwriting
                                    </span>
                                    <input type="file" ref={fileRef} onChange={onImport} className="hidden" accept="image/*" />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-1 bg-white/50 dark:bg-zinc-900/50 p-1 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50">
                        <button onClick={onCopy} className={`p-2.5 rounded-xl transition-all ${copySuccess ? 'text-green-500 bg-green-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'} group/copy relative`} title="Copy Content">
                            {copySuccess ? <Check size={20} /> : <Copy size={20} />}
                            <span className="absolute top-full mt-2 right-0 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover/copy:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity shadow-xl border border-white/10">
                                Copy Content
                            </span>
                        </button>
                        <button onClick={onExport} className="p-2.5 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group/export relative" title="Download Manuscript">
                            <Download size={20} />
                            <span className="absolute top-full mt-2 right-0 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded opacity-0 group-hover/export:opacity-100 pointer-events-none whitespace-nowrap z-[100] transition-opacity shadow-xl border border-white/10">
                                Download Manuscript
                            </span>
                        </button>
                    </div>

                    {mode === 'edit' && (
                        <div className="relative">
                            <button onClick={() => setEditMenuOpen(!editMenuOpen)} className={`p-2.5 rounded-xl transition-all ${isGrammarRunning ? 'bg-accent text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'}`} title="Editorial Tools">
                                {isGrammarRunning ? <Loader2 size={20} className="animate-spin" /> : <MoreVertical size={20} />}
                            </button>
                            <AnimatePresence>
                                {editMenuOpen && (
                                    <>
                                    <div className="fixed inset-0 z-10" onClick={() => setEditMenuOpen(false)} />
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-20 py-2 overflow-hidden flex flex-col"
                                    >
                                         <button onClick={() => { onGrammar(); setEditMenuOpen(false); }} disabled={isGrammarRunning} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-xs font-bold uppercase tracking-widest"><Wand2 size={18} className="text-accent" />Proofread Story</button>
                                         <button onClick={() => { onApprove(); setEditMenuOpen(false); }} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-xs font-bold uppercase tracking-widest"><ThumbsUp size={18} className="text-emerald-500" />Approve Changes</button>
                                         <button onClick={() => { onRevert(); setEditMenuOpen(false); }} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-xs font-bold uppercase tracking-widest"><ThumbsDown size={18} className="text-rose-500" />Reject All</button>
                                    </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    
                    <button onClick={onSettings} className="p-1.5 hover:scale-110 transition-transform flex items-center justify-center">
                        {user ? (
                            user.picture ? <img src={user.picture} alt="Profile" className="w-9 h-9 rounded-full ring-2 ring-accent/20" /> : <div className="w-9 h-9 bg-accent/10 text-accent rounded-full flex items-center justify-center"><User size={20} /></div>
                        ) : (
                            <div className="w-9 h-9 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                                <Settings size={20} />
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;