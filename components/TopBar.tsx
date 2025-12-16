import React, { useRef, useState } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Trash2, Check, Brain, User, Feather, Book, ThumbsUp, ThumbsDown, Wand2, Search, X, MoreVertical, Download } from 'lucide-react';
import { Mode, User as UserType } from '../types';
import { countWords } from '../utils';

interface TopBarProps {
    mode: Mode;
    setMode: (m: Mode) => void;
    user: UserType | null;
    wordCount: number;
    
    // Actions
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCopy: () => void;
    copySuccess: boolean;
    onClear: () => void;
    onExport: () => void;
    
    // Edit/Grammar Actions
    onGrammar: () => void;
    isGrammarRunning: boolean;
    onApprove: () => void;
    onRevert: () => void;
    
    onSettings: () => void;
    
    // Search
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

const ModeBtn = ({ id, activeId, icon: Icon, label, onClick }: { id: Mode, activeId: Mode, icon: any, label: string, onClick: (id: Mode) => void }) => {
    const isActive = activeId === id;
    return (
      <button 
          onClick={() => onClick(id)}
          className={`p-2 rounded-full transition-all touch-manipulation flex items-center justify-center ${
              isActive 
              ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
          }`}
          title={label}
      >
          <Icon size={18} /> 
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editMenuOpen, setEditMenuOpen] = useState(false);

    // Helper to check if we are in an auxiliary mode
    const isAuxMode = ['research', 'braindump', 'characters', 'analysis', 'metadata'].includes(mode);

    return (
        <header className="fixed top-0 left-0 w-full z-[60] bg-paper/90 dark:bg-zinc-950/90 backdrop-blur-xl h-24 flex items-center shadow-sm border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all supports-[backdrop-filter]:bg-paper/75 supports-[backdrop-filter]:dark:bg-zinc-950/75">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center gap-4">
                
                {/* Left: Brand & Modes */}
                <div className="flex items-center gap-2 md:gap-4 flex-shrink min-w-0">
                    <div className="hidden md:block">
                        <h1 className="font-display font-bold text-xl tracking-wider text-ink dark:text-zinc-100 leading-none">InkFlow</h1>
                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1">
                            {wordCount} Words
                        </div>
                    </div>
                    <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2 hidden md:block"></div>
                    <div className="flex bg-zinc-100/50 dark:bg-zinc-800/50 rounded-full p-1 border border-zinc-200/50 dark:border-zinc-700/50 overflow-x-auto no-scrollbar max-w-[50vw] md:max-w-none">
                        <ModeBtn id="metadata" activeId={mode} icon={Book} label="Metadata" onClick={setMode} />
                        <ModeBtn id="braindump" activeId={mode} icon={Brain} label="Braindump" onClick={setMode} />
                        <ModeBtn id="characters" activeId={mode} icon={User} label="Characters" onClick={setMode} />
                        <ModeBtn id="research" activeId={mode} icon={Globe} label="Research" onClick={setMode} />
                        <ModeBtn id="write" activeId={mode} icon={PenTool} label="Write" onClick={setMode} />
                        <ModeBtn id="edit" activeId={mode} icon={Edit3} label="Edit" onClick={setMode} />
                        <ModeBtn id="shuffle" activeId={mode} icon={Shuffle} label="Shuffle" onClick={setMode} />
                        <ModeBtn id="analysis" activeId={mode} icon={Feather} label="Style Analysis" onClick={setMode} />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-1 md:gap-2 items-center flex-shrink-0 ml-auto">
                    
                    {/* Search Input (Global) */}
                    <div className="relative group hidden sm:block mr-2">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-400">
                           <Search size={14} />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find..."
                            className={`h-9 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${searchQuery ? 'w-48 ring-2 ring-indigo-500/10 border-indigo-300' : 'w-32 focus:w-48'}`}
                        />
                         {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery("")}
                                className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600 p-1"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Undo/Redo/Camera - Only in Main Modes */}
                    {!isAuxMode && (
                        <>
                            <button onClick={onUndo} disabled={!canUndo} className={`p-2 rounded-full transition-all ${!canUndo ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Undo">
                                <RotateCcw size={18} />
                            </button>
                            <button onClick={onRedo} disabled={!canRedo} className={`p-2 rounded-full transition-all ${!canRedo ? 'text-zinc-300 dark:text-zinc-700 opacity-50' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Redo">
                                <RotateCw size={18} />
                            </button>
                            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1 hidden sm:block"></div>
                            {mode !== 'edit' && (
                                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200 transition-all hidden sm:block" title="Import Handwriting">
                                    <Camera size={18} />
                                    <input type="file" ref={fileInputRef} onChange={onImport} className="hidden" accept="image/*" />
                                </button>
                            )}
                        </>
                    )}

                    {/* Global Copy */}
                    <button onClick={onCopy} className={`p-2 rounded-full transition-all ${copySuccess ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title="Copy Content">
                        {copySuccess ? <Check size={18} /> : <Copy size={18} />}
                    </button>

                    {/* Export Word Doc */}
                    <button onClick={onExport} className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all" title="Export to Word">
                        <Download size={18} />
                    </button>

                    {/* Edit Mode Dropdown */}
                    {mode === 'edit' && (
                        <div className="relative">
                            <button 
                                onClick={() => setEditMenuOpen(!editMenuOpen)}
                                className={`p-2 rounded-full transition-all ${isGrammarRunning ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}
                                title="Edit Tools"
                            >
                                {isGrammarRunning ? <Loader2 size={18} className="animate-spin" /> : <MoreVertical size={18} />}
                            </button>
                            
                            {editMenuOpen && (
                                <>
                                <div className="fixed inset-0 z-10" onClick={() => setEditMenuOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-20 py-1 flex flex-col overflow-hidden">
                                     <button 
                                        onClick={() => { onGrammar(); setEditMenuOpen(false); }} 
                                        disabled={isGrammarRunning}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200"
                                     >
                                         <Wand2 size={16} className="text-blue-500" />
                                         {isGrammarRunning ? "Fixing..." : "Fix Grammar"}
                                     </button>
                                     <button 
                                        onClick={() => { onApprove(); setEditMenuOpen(false); }}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200"
                                     >
                                         <ThumbsUp size={16} className="text-green-500" />
                                         Approve All
                                     </button>
                                     <button 
                                        onClick={() => { onRevert(); setEditMenuOpen(false); }}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left text-sm font-medium text-zinc-700 dark:text-zinc-200"
                                     >
                                         <ThumbsDown size={16} className="text-red-500" />
                                         Revert All
                                     </button>
                                </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

                    <button onClick={onSettings} className="p-3 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all touch-manipulation text-zinc-600 dark:text-zinc-400 hover:text-ink dark:hover:text-zinc-200" title="Settings">
                        {user ? (
                            user.picture ? <img src={user.picture} alt="Profile" className="w-5 h-5 rounded-full" /> : <User size={20} className="text-indigo-500" />
                        ) : (
                            <Settings size={20} />
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;