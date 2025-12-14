import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { Book, Sparkles, Copy, Loader2, Save, Tag, X as XIcon, ChevronDown, Plus, Trash2, Edit2, Check, AlertTriangle } from 'lucide-react';
import { BookMetadata, TypographySettings, User, BookEntry } from '../types';
import * as GeminiService from '../services/geminiService';
import * as FirebaseService from '../services/firebase';

interface MetadataViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
  manuscriptText: string;
  onActiveContentUpdate?: (text: string) => void;
  user: (User & { uid?: string }) | null;
  // Multiple Books Props
  books: BookEntry[];
  currentBookId: string;
  onSwitchBook: (id: string) => void;
  onCreateBook: () => void;
  onDeleteBook: (id: string) => void;
  onRenameBook: (id: string, title: string) => void;
}

const MetadataView: React.FC<MetadataViewProps> = ({ 
    onCopy, typography, manuscriptText, onActiveContentUpdate, user,
    books, currentBookId, onSwitchBook, onCreateBook, onDeleteBook, onRenameBook
}) => {
  const [data, setData] = useState<BookMetadata>({
    title: "",
    subtitle: "",
    author: "",
    blurb: "",
    copyright: "",
    kdpTags: []
  });
  
  const [loading, setLoading] = useState<string | null>(null); 
  const [subtitleSuggestions, setSubtitleSuggestions] = useState<string[]>([]);
  
  // Selector State
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load Data for CURRENT book
  useEffect(() => {
    // Reset state first to avoid flicker of old data
    setData({ title: "", subtitle: "", author: "", blurb: "", copyright: "", kdpTags: [] });

    const loadBookData = async () => {
        if (user?.uid) {
            const doc = await FirebaseService.loadData(user.uid, 'metadata', currentBookId);
            if (doc && doc.data) {
                setData(prev => ({ ...prev, ...doc.data }));
                return;
            }
        }
        
        // Fallback or local
        const saved = localStorage.getItem(`inkflow_metadata_${currentBookId}`);
        // Migration check
        if (!saved && currentBookId === 'default' && localStorage.getItem('inkflow_metadata')) {
            const legacy = localStorage.getItem('inkflow_metadata');
            if (legacy) {
                 setData(prev => ({ ...prev, ...JSON.parse(legacy) }));
                 return;
            }
        }

        if (saved) setData(prev => ({ ...prev, ...JSON.parse(saved) }));
    };
    loadBookData();
  }, [currentBookId, user]);

  // Save Data
  useEffect(() => {
    localStorage.setItem(`inkflow_metadata_${currentBookId}`, JSON.stringify(data));
    if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'metadata', currentBookId, { data });
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [data, user, currentBookId]);
  
  // Sync Title to Book List when changed in Metadata
  useEffect(() => {
      if (data.title && data.title !== books.find(b => b.id === currentBookId)?.title) {
          const timer = setTimeout(() => {
              onRenameBook(currentBookId, data.title);
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [data.title, currentBookId]);

  // Broadcast content
  useEffect(() => {
    if (onActiveContentUpdate) {
        const text = `TITLE: ${data.title}\nSUBTITLE: ${data.subtitle}\nAUTHOR: ${data.author}\n\nBLURB:\n${data.blurb}\n\nTAGS: ${data.kdpTags.join(', ')}\n\nCOPYRIGHT:\n${data.copyright}`;
        onActiveContentUpdate(text);
    }
  }, [data, onActiveContentUpdate]);

  const handleChange = (field: keyof BookMetadata, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenSubtitle = async () => {
      if (!data.title) return alert("Please enter a title first.");
      setLoading('subtitle');
      try {
          const suggestions = await GeminiService.generateSubtitles(data.title, manuscriptText);
          setSubtitleSuggestions(suggestions);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(null);
      }
  };

  const handleGenBlurb = async () => {
    if (!data.title) return alert("Please enter a title first.");
    setLoading('blurb');
    try {
        const result = await GeminiService.generateBlurb(data.title, manuscriptText);
        handleChange('blurb', result);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(null);
    }
  };

  const handleGenCopyright = async () => {
    if (!data.title || !data.author) return alert("Title and Author are required.");
    setLoading('copyright');
    try {
        const result = await GeminiService.generateCopyright(data.title, data.author);
        handleChange('copyright', result);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(null);
    }
  };

  const handleGenTags = async () => {
    if (!data.title) return alert("Please enter a title first.");
    setLoading('tags');
    try {
        const result = await GeminiService.generateKDPTags(data.title, manuscriptText);
        handleChange('kdpTags', result);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(null);
    }
  };

  const currentBook = books.find(b => b.id === currentBookId);

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto pt-6 px-6 pb-32">
        
        {/* Book Selector Header */}
        <div className="relative z-30 mb-12">
            <div className="flex flex-col items-center">
                <button 
                    onClick={() => setSelectorOpen(!selectorOpen)}
                    className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm hover:shadow-md transition-all group"
                >
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                        <Book size={16} />
                    </div>
                    <div className="flex flex-col items-start">
                         <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Current Book</span>
                         <span className="font-display font-bold text-lg text-ink dark:text-zinc-100 leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {currentBook?.title || "Untitled Draft"}
                         </span>
                    </div>
                    <ChevronDown size={16} className={`text-zinc-400 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                    {selectorOpen && (
                        <>
                        <div className="fixed inset-0 z-20" onClick={() => setSelectorOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full mt-4 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-30 overflow-hidden flex flex-col"
                        >
                            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                {books.map(book => (
                                    <div 
                                        key={book.id}
                                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${book.id === currentBookId ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                        onClick={() => {
                                            onSwitchBook(book.id);
                                            setSelectorOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${book.id === currentBookId ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                                            <div className="truncate font-medium text-sm text-zinc-700 dark:text-zinc-300">
                                                {book.title || "Untitled"}
                                            </div>
                                        </div>
                                        
                                        {/* Robust Delete Button - 2 Step */}
                                        {books.length > 1 && (
                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (deleteConfirmId === book.id) {
                                                        onDeleteBook(book.id);
                                                        setDeleteConfirmId(null);
                                                    } else {
                                                        setDeleteConfirmId(book.id);
                                                        setTimeout(() => setDeleteConfirmId(null), 3000);
                                                    }
                                                }}
                                                className={`p-1.5 rounded-md transition-all ${
                                                    deleteConfirmId === book.id 
                                                    ? 'bg-red-500 text-white opacity-100' 
                                                    : 'text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100'
                                                }`}
                                                title={deleteConfirmId === book.id ? "Click to Confirm" : "Delete Book"}
                                            >
                                                {deleteConfirmId === book.id ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
                                <button 
                                    onClick={() => {
                                        onCreateBook();
                                        setSelectorOpen(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors"
                                >
                                    <Plus size={16} /> Create New Book
                                </button>
                            </div>
                        </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>

        <div className="space-y-12">
            
            {/* Identity Section */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                <div className="absolute top-0 left-8 -translate-y-1/2 bg-white dark:bg-zinc-800 px-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Identity
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Book Title</label>
                        <input 
                            type="text" 
                            value={data.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-display font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            placeholder="The Great American Novel"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Subtitle</label>
                             <button 
                                onClick={handleGenSubtitle}
                                disabled={loading === 'subtitle'}
                                className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                            >
                                 {loading === 'subtitle' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                                 Suggest
                             </button>
                        </div>
                        <input 
                            type="text" 
                            value={data.subtitle}
                            onChange={(e) => handleChange('subtitle', e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-sans text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            placeholder="A Story of Redemption and Hope"
                        />
                        {subtitleSuggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {subtitleSuggestions.map((s, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => { handleChange('subtitle', s); setSubtitleSuggestions([]); }}
                                        className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-left"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">Author Name</label>
                        <input 
                            type="text" 
                            value={data.author}
                            onChange={(e) => handleChange('author', e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-sans text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                            placeholder="Jane Doe"
                        />
                    </div>
                </div>
            </div>

            {/* Marketing Section */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                <div className="absolute top-0 left-8 -translate-y-1/2 bg-white dark:bg-zinc-800 px-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Back Cover
                </div>

                <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Blurb</label>
                    <button 
                        onClick={handleGenBlurb}
                        disabled={loading === 'blurb'}
                        className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                        {loading === 'blurb' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                        Generate Blurb
                    </button>
                </div>
                <TextareaAutosize
                    minRows={6}
                    value={data.blurb}
                    onChange={(e) => handleChange('blurb', e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-serif text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed"
                    placeholder="In a world where..."
                />
            </div>

            {/* Distribution Section */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                <div className="absolute top-0 left-8 -translate-y-1/2 bg-white dark:bg-zinc-800 px-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Distribution
                </div>

                <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Amazon KDP Keywords (7)</label>
                    <button 
                        onClick={handleGenTags}
                        disabled={loading === 'tags'}
                        className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                        {loading === 'tags' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                        Generate Keywords
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                    {data.kdpTags.map((tag, i) => (
                        <div key={i} className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm border border-amber-200 dark:border-amber-800">
                           <Tag size={12} />
                           {tag}
                           <button onClick={() => {
                               const newTags = data.kdpTags.filter((_, idx) => idx !== i);
                               handleChange('kdpTags', newTags);
                           }} className="hover:text-red-500 ml-1"><XIcon size={12}/></button>
                        </div>
                    ))}
                    {data.kdpTags.length === 0 && (
                        <div className="text-sm text-zinc-400 italic">No tags generated yet.</div>
                    )}
                </div>
            </div>

            {/* Legal Section */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-sm relative">
                <div className="absolute top-0 left-8 -translate-y-1/2 bg-white dark:bg-zinc-800 px-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Legal
                </div>

                <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">Copyright Page</label>
                    <button 
                        onClick={handleGenCopyright}
                        disabled={loading === 'copyright'}
                        className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                    >
                        {loading === 'copyright' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                        Generate Legalese
                    </button>
                </div>
                <TextareaAutosize
                    minRows={6}
                    value={data.copyright}
                    onChange={(e) => handleChange('copyright', e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    placeholder="© 2024 Jane Doe. All rights reserved..."
                />
            </div>

        </div>
    </div>
  );
};

export default MetadataView;