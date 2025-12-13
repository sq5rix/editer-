import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Copy, Brain, Calendar } from 'lucide-react';
import { BraindumpItem, TypographySettings, User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import TextareaAutosize from 'react-textarea-autosize';
import * as FirebaseService from '../services/firebase';

interface BraindumpViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
  onActiveContentUpdate?: (text: string) => void;
  user: (User & { uid?: string }) | null;
  bookId: string;
}

const BraindumpView: React.FC<BraindumpViewProps> = ({ onCopy, typography, onActiveContentUpdate, user, bookId }) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BraindumpItem[]>([]);

  // Load Initial Data (Cloud > Local)
  useEffect(() => {
    // Reset items first
    setItems([]);

    const loadData = async () => {
        if (user?.uid) {
            // Attempt cloud load
            const data = await FirebaseService.loadData(user.uid, 'braindump', bookId);
            if (data && data.items) {
                setItems(data.items);
                return;
            }
        }
        
        // Fallback to local
        const localKey = `inkflow_braindumps_${bookId}`;
        const saved = localStorage.getItem(localKey);
        
        // Migration Check
        if (!saved && bookId === 'default' && localStorage.getItem('inkflow_braindumps')) {
            const legacy = localStorage.getItem('inkflow_braindumps');
            if (legacy) {
                setItems(JSON.parse(legacy));
                return;
            }
        }

        if (saved) setItems(JSON.parse(saved));
    };
    loadData();
  }, [user, bookId]);

  // Save Data (Cloud + Local)
  useEffect(() => {
    const localKey = `inkflow_braindumps_${bookId}`;
    localStorage.setItem(localKey, JSON.stringify(items));
    
    if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'braindump', bookId, { items });
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [items, user, bookId]);

  // Fuzzy Search Logic
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    
    const lowerQuery = query.toLowerCase();
    const terms = lowerQuery.split(/\s+/).filter(Boolean);

    return items.filter(item => {
        const content = item.content.toLowerCase();
        return terms.every(term => content.includes(term));
    });
  }, [items, query]);

  // Broadcast content for global copy
  useEffect(() => {
    if (onActiveContentUpdate) {
        const text = filteredItems.map(item => `[${new Date(item.timestamp).toLocaleDateString()}] ${item.content}`).join('\n\n---\n\n');
        onActiveContentUpdate(text);
    }
  }, [filteredItems, onActiveContentUpdate]);

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    const newItem: BraindumpItem = {
      id: uuidv4(),
      content: query,
      timestamp: Date.now()
    };

    setItems(prev => [newItem, ...prev]); 
    setQuery(""); 
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdate = (id: string, newContent: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, content: newContent } : i));
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(ts));
  };

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto pt-6">
      
      {/* Header / Input Area */}
      <div className="mb-8 px-4 relative z-20">
        <div className="text-center mb-6">
             <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Brain size={24} />
             </div>
             <h2 className="font-display font-bold text-2xl text-ink dark:text-zinc-100">Braindump</h2>
             <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">
                {items.length} Thoughts Captured
             </p>
        </div>

        <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-teal-500 transition-colors">
                <Search size={20} />
            </div>
            <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && query.trim()) {
                        handleAdd();
                    }
                }}
                placeholder="Search or capture a new thought..."
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-14 py-4 shadow-sm focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-lg font-sans"
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
                <button 
                    onClick={handleAdd}
                    disabled={!query.trim()}
                    className="p-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-all disabled:opacity-0 disabled:scale-90"
                    title="Add Note"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 pb-32 px-4">
         <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 && query && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-center py-12 text-zinc-400"
                >
                    <p className="italic font-serif">No matches found.</p>
                    <p className="text-sm mt-2">Press Enter to save "<span className="text-teal-600 dark:text-teal-400">{query}</span>" as a new thought.</p>
                </motion.div>
            )}

            {filteredItems.length === 0 && !query && items.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-center py-12 text-zinc-400"
                >
                    <p className="italic font-serif">Your mind is clear.</p>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                    <motion.div
                        key={item.id}
                        layoutId={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-teal-500/30 transition-all relative flex flex-col"
                    >
                        {/* Timestamp & Controls */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <Calendar size={10} />
                                {formatDate(item.timestamp)}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => onCopy(item.content)}
                                    className="p-1.5 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-md transition-colors"
                                    title="Copy"
                                >
                                    <Copy size={14} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(item.id)}
                                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <TextareaAutosize
                            value={item.content}
                            onChange={(e) => handleUpdate(item.id, e.target.value)}
                            className="w-full bg-transparent resize-none border-none outline-none text-zinc-800 dark:text-zinc-200 leading-relaxed"
                            style={{
                                fontFamily: typography.fontFamily === 'mono' ? 'JetBrains Mono' : typography.fontFamily === 'sans' ? 'Inter' : 'Merriweather',
                                fontSize: `${Math.max(14, typography.fontSize - 2)}px`, // Slightly smaller for dense cards
                                opacity: typography.contrast
                            }}
                        />
                    </motion.div>
                ))}
            </div>
         </AnimatePresence>
      </div>

    </div>
  );
};

export default BraindumpView;