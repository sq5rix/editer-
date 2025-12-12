import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, ExternalLink, ChevronLeft, ChevronRight, Plus, Loader2, Copy } from 'lucide-react';
import { ResearchThread, TypographySettings } from '../types';
import * as GeminiService from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface ResearchViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
}

const ResearchView: React.FC<ResearchViewProps> = ({ onCopy, typography }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ResearchThread[]>([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState<number>(0);

  // Load sample thread if empty
  useEffect(() => {
    if (threads.length === 0) {
       // Optional: could load from local storage here
    }
  }, [threads.length]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await GeminiService.researchTopic(query);
      
      const newThread: ResearchThread = {
        id: uuidv4(),
        query: query,
        content: result.content,
        sources: result.sources,
        timestamp: Date.now()
      };

      setThreads(prev => [...prev, newThread]);
      setActiveThreadIndex(threads.length); // Point to new thread (length because we just added one conceptually)
      setQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeThread = threads[activeThreadIndex];

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto pt-6">
      
      {/* Navigation / Controls */}
      <div className="flex items-center justify-between mb-8 px-4">
         <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveThreadIndex(Math.max(0, activeThreadIndex - 1))}
              disabled={activeThreadIndex === 0 || threads.length === 0}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                {threads.length > 0 ? `${activeThreadIndex + 1} / ${threads.length}` : '0 / 0'}
            </span>
            <button 
              onClick={() => setActiveThreadIndex(Math.min(threads.length - 1, activeThreadIndex + 1))}
              disabled={activeThreadIndex >= threads.length - 1 || threads.length === 0}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
         </div>

         <button 
            onClick={() => { setQuery(""); setActiveThreadIndex(threads.length); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!activeThread && !loading ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500' : 'text-zinc-500 hover:text-ink dark:hover:text-zinc-300'}`}
         >
            <Plus size={16} /> New Inquiry
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative min-h-[50vh]">
        <AnimatePresence mode="wait">
           {loading ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400"
             >
                <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                <p className="font-serif italic animate-pulse">Consulting the archives...</p>
             </motion.div>
           ) : !activeThread ? (
             <motion.div
               key="empty"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="flex flex-col items-center justify-center h-full text-center px-8"
             >
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl flex items-center justify-center mb-6">
                    <Search size={32} />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Research Mode</h3>
                <p className="text-zinc-500 max-w-md mb-8">
                  Enter a topic below to generate a comprehensive research brief with citations.
                </p>
                
                <form onSubmit={handleSearch} className="w-full max-w-lg relative">
                   <input
                     type="text"
                     value={query}
                     onChange={(e) => setQuery(e.target.value)}
                     placeholder="e.g. Dolphins in Atlantic close to Florida"
                     className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-6 py-4 pr-14 shadow-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                     autoFocus
                   />
                   <button 
                     type="submit"
                     disabled={!query.trim()}
                     className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <ArrowRight size={20} />
                   </button>
                </form>
             </motion.div>
           ) : (
             <motion.div
                key={activeThread.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 md:p-12 mb-24"
             >
                <div className="flex items-start justify-between mb-8 border-b border-zinc-100 dark:border-zinc-700 pb-6">
                    <div>
                        <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-2">Research Brief</div>
                        <h2 className="font-display font-bold text-2xl md:text-3xl text-ink dark:text-zinc-100 leading-tight">
                            {activeThread.query}
                        </h2>
                    </div>
                    <button 
                      onClick={() => onCopy(activeThread.content)}
                      className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
                      title="Copy content"
                    >
                        <Copy size={20} />
                    </button>
                </div>

                <div 
                   className="prose dark:prose-invert max-w-none mb-12"
                   style={{
                       fontFamily: typography.fontFamily === 'mono' ? 'JetBrains Mono' : typography.fontFamily === 'sans' ? 'Inter' : 'Merriweather',
                       fontSize: `${typography.fontSize}px`,
                       lineHeight: '1.8'
                   }}
                >
                    {activeThread.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-4">{line}</p>
                    ))}
                </div>

                {/* Sources / Grounding */}
                {activeThread.sources.length > 0 && (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 border border-zinc-100 dark:border-zinc-700/50">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            Verified Sources
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {activeThread.sources.map((source, idx) => (
                                <a 
                                  key={idx} 
                                  href={source.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group"
                                >
                                    <div className="mt-1 text-zinc-400 group-hover:text-indigo-500 transition-colors">
                                        <ExternalLink size={14} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-tight mb-0.5 line-clamp-2">
                                            {source.title}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
                                            {new URL(source.url).hostname}
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
             </motion.div>
           )}
        </AnimatePresence>
      </div>

    </div>
  );
};

export default ResearchView;