import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, ExternalLink, ChevronLeft, ChevronRight, Plus, Loader2, Copy, MessageSquarePlus, Trash2, Check } from 'lucide-react';
import { ResearchThread, ResearchInteraction, TypographySettings, User } from '../types';
import * as GeminiService from '../services/geminiService';
import * as FirebaseService from '../services/firebase';
import { v4 as uuidv4 } from 'uuid';

interface ResearchViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
  onActiveContentUpdate?: (text: string) => void;
  user: (User & { uid?: string }) | null;
}

const ResearchView: React.FC<ResearchViewProps> = ({ onCopy, typography, onActiveContentUpdate, user }) => {
  const [query, setQuery] = useState("");
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ResearchThread[]>([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Load Data
  useEffect(() => {
    if (user?.uid) {
        FirebaseService.loadData(user.uid, 'research', 'main').then(data => {
            if (data && data.threads) {
                setThreads(data.threads);
            } else {
                const saved = localStorage.getItem('inkflow_research_threads');
                if (saved) setThreads(JSON.parse(saved));
            }
        });
    } else {
        const saved = localStorage.getItem('inkflow_research_threads');
        if (saved) setThreads(JSON.parse(saved));
    }
  }, [user]);

  // Save Data
  useEffect(() => {
    localStorage.setItem('inkflow_research_threads', JSON.stringify(threads));
    if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'research', 'main', { threads });
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [threads, user]);

  // Scroll to bottom when new interaction is added
  useEffect(() => {
    if (!loading && activeThreadIndex !== -1) {
       setTimeout(() => {
         scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
       }, 200);
    }
  }, [threads, activeThreadIndex, loading]);

  const activeThread = threads[activeThreadIndex];
  const isViewingThread = activeThread !== undefined;

  // Broadcast active content to parent for global copy
  useEffect(() => {
      if (onActiveContentUpdate) {
          if (activeThread) {
               const text = activeThread.interactions.map(i => `## ${i.query}\n\n${i.content}`).join('\n\n---\n\n');
               onActiveContentUpdate(text);
          } else {
               onActiveContentUpdate("");
          }
      }
  }, [activeThread, onActiveContentUpdate]);

  const handleNewSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await GeminiService.researchTopic(query);
      
      const newInteraction: ResearchInteraction = {
        id: uuidv4(),
        query: query,
        content: result.content,
        sources: result.sources,
        timestamp: Date.now()
      };

      const newThread: ResearchThread = {
        id: uuidv4(),
        title: query,
        interactions: [newInteraction],
        createdAt: Date.now(),
        lastModified: Date.now()
      };

      setThreads(prev => [...prev, newThread]);
      setActiveThreadIndex(threads.length); 
      setQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const activeThread = threads[activeThreadIndex];
    if (!followUpQuery.trim() || !activeThread) return;

    setLoading(true);
    try {
      // Construct context from previous interactions
      const context = activeThread.interactions.map(i => `Q: ${i.query}\nA: ${i.content}`).join("\n\n");
      
      const result = await GeminiService.researchTopic(followUpQuery, context);

      const newInteraction: ResearchInteraction = {
        id: uuidv4(),
        query: followUpQuery,
        content: result.content,
        sources: result.sources,
        timestamp: Date.now()
      };

      const updatedThreads = [...threads];
      updatedThreads[activeThreadIndex] = {
        ...activeThread,
        interactions: [...activeThread.interactions, newInteraction],
        lastModified: Date.now()
      };

      setThreads(updatedThreads);
      setFollowUpQuery("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = () => {
    if (threads.length === 0) return;
    const newThreads = threads.filter((_, i) => i !== activeThreadIndex);
    setThreads(newThreads);
    setActiveThreadIndex(prev => Math.max(0, Math.min(prev, newThreads.length - 1)));
  };

  const handleLocalCopy = (id: string, text: string) => {
      onCopy(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

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
            
            {isViewingThread && (
              <button 
                onClick={deleteThread}
                className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-2"
                title="Delete Thread"
              >
                <Trash2 size={16} />
              </button>
            )}
         </div>

         <button 
            onClick={() => { setQuery(""); setActiveThreadIndex(threads.length); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!isViewingThread && !loading ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500' : 'text-zinc-500 hover:text-ink dark:hover:text-zinc-300'}`}
         >
            <Plus size={16} /> New Inquiry
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative min-h-[60vh] pb-32">
        <AnimatePresence mode="wait">
           {loading && !isViewingThread ? (
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
           ) : !isViewingThread ? (
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
                
                <form onSubmit={handleNewSearch} className="w-full max-w-lg relative">
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
                className="space-y-8"
             >
                {/* Header for the Thread */}
                <div className="text-center mb-10">
                   <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-2">Research Brief</div>
                   <h2 className="font-display font-bold text-2xl md:text-3xl text-ink dark:text-zinc-100 leading-tight px-4">
                       {activeThread.title}
                   </h2>
                   <div className="text-xs text-zinc-400 mt-2">
                      {new Date(activeThread.createdAt).toLocaleDateString()}
                   </div>
                </div>

                {/* Interactions Loop */}
                {activeThread.interactions.map((interaction, idx) => (
                   <div key={interaction.id} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 md:p-10 relative group">
                      
                      {/* Interaction Query Header (if it's a follow up) */}
                      {idx > 0 && (
                        <div className="mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-3">
                           <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-full">
                              <MessageSquarePlus size={16} />
                           </div>
                           <h3 className="font-sans font-medium text-lg text-zinc-800 dark:text-zinc-200">{interaction.query}</h3>
                        </div>
                      )}

                      <div className="absolute top-4 right-4 md:top-8 md:right-8 opacity-50 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => handleLocalCopy(interaction.id, interaction.content)}
                           className={`p-2 transition-colors rounded-lg ${copiedId === interaction.id ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'}`}
                           title="Copy section"
                         >
                             {copiedId === interaction.id ? <Check size={18} /> : <Copy size={18} />}
                         </button>
                      </div>

                      <div 
                        className="prose dark:prose-invert max-w-none mb-8"
                        style={{
                            fontFamily: typography.fontFamily === 'mono' ? 'JetBrains Mono' : typography.fontFamily === 'sans' ? 'Inter' : 'Merriweather',
                            fontSize: `${typography.fontSize}px`,
                            lineHeight: '1.8'
                        }}
                      >
                          {interaction.content.split('\n').map((line, i) => (
                              <p key={i} className="mb-4">{line}</p>
                          ))}
                      </div>

                      {/* Sources for this interaction */}
                      {interaction.sources.length > 0 && (
                          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-5 border border-zinc-100 dark:border-zinc-700/50">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                  Sources
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                  {interaction.sources.map((source, sIdx) => (
                                      <a 
                                        key={sIdx} 
                                        href={source.url} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group/source"
                                      >
                                          <ExternalLink size={12} className="text-zinc-400 group-hover/source:text-indigo-500" />
                                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-[150px] truncate">
                                              {source.title}
                                          </span>
                                      </a>
                                  ))}
                              </div>
                          </div>
                      )}
                   </div>
                ))}
                
                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                    </div>
                )}
                
                <div ref={scrollEndRef} />
             </motion.div>
           )}
        </AnimatePresence>
      </div>

      {/* Sticky Follow Up Box */}
      {isViewingThread && (
        <div className="fixed bottom-0 left-0 w-full z-20 pointer-events-none">
           <div className="max-w-3xl mx-auto px-6 pb-6 pointer-events-auto">
              <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl p-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={followUpQuery}
                    onChange={(e) => setFollowUpQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFollowUp(e)}
                    placeholder="Ask a follow-up question..."
                    disabled={loading}
                    className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm md:text-base dark:text-white placeholder-zinc-500"
                  />
                  <button 
                    onClick={handleFollowUp}
                    disabled={!followUpQuery.trim() || loading}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl transition-all shadow-md"
                  >
                     {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                  </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ResearchView;