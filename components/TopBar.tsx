import React, { useRef } from 'react';
import { Camera, Copy, PenTool, Edit3, Shuffle, RotateCcw, RotateCw, Settings, Loader2, Globe, Trash2, Check, Brain, User, Feather, Book, ThumbsUp, ThumbsDown, Wand2 } from 'lucide-react';
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
    
    // Edit/Grammar Actions
    onGrammar: () => void;
    isGrammarRunning: boolean;
    onApprove: () => void;
    onRevert: () => void;
    
    onSettings: () => void;
}

const ModeBtn = ({ id, activeId, icon: Icon, label, onClick }: { id: Mode, activeId: Mode, icon: any, label: string, onClick: (id: Mode) => void }) => {
    const isActive = activeId === id;
    return (
      <button 
          onClick={() => onClick(id)}
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

const TopBar: React.FC<TopBarProps> = ({
    mode, setMode, user, wordCount,
    onUndo, onRedo, canUndo, canRedo,
    onImport, onCopy, copySuccess, onClear,
    onGrammar, isGrammarRunning, onApprove, onRevert,
    onSettings
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper to check if we are in an auxiliary mode
    const isAuxMode = ['research', 'braindump', 'characters', 'analysis', 'metadata'].includes(mode);

    return (
        <header className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-paper via-paper/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 h-24 flex items-center shadow-sm border-b border-transparent transition-all">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
                
                {/* Left: Brand & Modes */}
                <div className="flex items-center gap-2 md:gap-4 flex-shrink min-w-0">
                    <div className="hidden md:block">
                        <h1 className="font-display font-bold text-xl tracking-wider text-ink dark:text-zinc-100 leading-none">InkFlow</h1>
                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1">
                            {wordCount} Words
                        </div>
                    </div>
                    <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-800 mx-2 hidden md:block"></div>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-x-auto no-scrollbar max-w-[60vw] md:max-w-none">
                        <ModeBtn id="metadata" activeId={mode} icon={Book} label="Meta" onClick={setMode} />
                        <ModeBtn id="braindump" activeId={mode} icon={Brain} label="Brain" onClick={setMode} />
                        <ModeBtn id="characters" activeId={mode} icon={User} label="Chars" onClick={setMode} />
                        <ModeBtn id="research" activeId={mode} icon={Globe} label="Research" onClick={setMode} />
                        <ModeBtn id="write" activeId={mode} icon={PenTool} label="Write" onClick={setMode} />
                        <ModeBtn id="edit" activeId={mode} icon={Edit3} label="Edit" onClick={setMode} />
                        <ModeBtn id="shuffle" activeId={mode} icon={Shuffle} label="Shuffle" onClick={setMode} />
                        <ModeBtn id="analysis" activeId={mode} icon={Feather} label="Style" onClick={setMode} />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-1 md:gap-2 items-center flex-shrink-0 ml-2">
                    
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

                    {/* Edit Mode Specifics */}
                    {mode === 'edit' && (
                        <div className="flex gap-2">
                            <button 
                                onClick={onGrammar} 
                                disabled={isGrammarRunning}
                                className={`flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-wait text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap min-w-[100px] justify-center`}
                                title="Fix Grammar"
                            >
                                {isGrammarRunning ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 
                                <span className="hidden md:inline">{isGrammarRunning ? "Fixing..." : "Grammar"}</span>
                            </button>
                            <button onClick={onApprove} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap" title="Approve Changes">
                                <ThumbsUp size={14} /> <span className="hidden md:inline">Approve</span>
                            </button>
                            <button onClick={onRevert} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all whitespace-nowrap" title="Revert Changes">
                                <ThumbsDown size={14} /> <span className="hidden md:inline">Revert</span>
                            </button>
                        </div>
                    )}

                    {/* Trash Button - Fixed Click Handler */}
                    {!isAuxMode && mode !== 'edit' && (
                        <button 
                            onClick={onClear} 
                            className="p-2 rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all cursor-pointer" 
                            title="Clear Text"
                        >
                            <Trash2 size={18} />
                        </button>
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