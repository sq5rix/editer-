import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Feather, Loader2, RefreshCcw, ThumbsUp, ThumbsDown, Zap, BookOpen, Activity, MapPin, Send, ArrowRight } from 'lucide-react';
import { StyleAnalysis, TypographySettings, User } from '../types';
import * as GeminiService from '../services/geminiService';
import * as FirebaseService from '../services/firebase';

interface StyleAnalysisViewProps {
  text: string;
  typography: TypographySettings;
  user: (User & { uid?: string }) | null;
  bookId: string;
}

const StyleAnalysisView: React.FC<StyleAnalysisViewProps> = ({ text, typography, user, bookId }) => {
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Data
  useEffect(() => {
    // Reset
    setAnalysis(null);
    setLastAnalyzedText("");
    setChatHistory([]); // Reset chat on new book load or mount

    const loadData = async () => {
        if (user?.uid) {
            const data = await FirebaseService.loadData(user.uid, 'analysis', bookId);
            if (data && data.analysis) {
                setAnalysis(data.analysis);
                setLastAnalyzedText(data.lastAnalyzedText || "");
                return;
            }
        }
        
        // Fallback
        const localKeyAnalysis = `inkflow_style_analysis_${bookId}`;
        const localKeyText = `inkflow_last_analyzed_text_${bookId}`;
        
        const savedAnalysis = localStorage.getItem(localKeyAnalysis);
        const savedText = localStorage.getItem(localKeyText);

        // Migration
        if (!savedAnalysis && bookId === 'default') {
             const legacyA = localStorage.getItem('inkflow_style_analysis');
             const legacyT = localStorage.getItem('inkflow_last_analyzed_text');
             if (legacyA) setAnalysis(JSON.parse(legacyA));
             if (legacyT) setLastAnalyzedText(legacyT || "");
             return;
        }

        if (savedAnalysis) setAnalysis(JSON.parse(savedAnalysis));
        if (savedText) setLastAnalyzedText(savedText);
    };
    loadData();
  }, [user, bookId]);

  // Save Data
  useEffect(() => {
    if (analysis) {
        localStorage.setItem(`inkflow_style_analysis_${bookId}`, JSON.stringify(analysis));
    }
    if (lastAnalyzedText) {
        localStorage.setItem(`inkflow_last_analyzed_text_${bookId}`, lastAnalyzedText);
    }

    if (user?.uid && analysis) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'analysis', bookId, { analysis, lastAnalyzedText });
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [analysis, lastAnalyzedText, user, bookId]);

  // Scroll to bottom of chat
  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await GeminiService.analyzeStyle(text);
      setAnalysis(result);
      setLastAnalyzedText(text);
      setChatHistory([]); // Clear previous chat on new analysis
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async () => {
      if (!prompt.trim() || !analysis) return;
      
      const currentPrompt = prompt;
      setPrompt("");
      setChatHistory(prev => [...prev, { role: 'user', content: currentPrompt }]);
      setIsChatLoading(true);

      try {
          const response = await GeminiService.refineStyleAnalysis(analysis, chatHistory, currentPrompt);
          setChatHistory(prev => [...prev, { role: 'model', content: response }]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsChatLoading(false);
      }
  };

  const isStale = text !== lastAnalyzedText && lastAnalyzedText !== "";

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto pt-6 px-6 pb-40">
       
       <div className="text-center mb-10">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Feather size={24} />
            </div>
            <h2 className="font-display font-bold text-2xl text-ink dark:text-zinc-100 mb-2">Stylistic Analysis</h2>
            <p className="text-sm text-zinc-500 max-w-lg mx-auto mb-6">
                Deep dive into your writing voice, pacing, and rhetorical patterns.
            </p>

            <button
                onClick={handleAnalyze}
                disabled={loading || !text.trim()}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full font-medium transition-all disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center gap-2 mx-auto"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                {analysis ? (isStale ? "Update Analysis" : "Re-Analyze") : "Analyze Text"}
            </button>
            
            {!text.trim() && (
                <p className="text-xs text-red-400 mt-4">Write some text in the editor first.</p>
            )}
       </div>

       {analysis && !loading && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-8"
           >
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Summary Card */}
                   <div className="md:col-span-2 bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                       <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Style Fingerprint</h3>
                       <p className="font-serif text-lg leading-relaxed text-zinc-800 dark:text-zinc-200 italic">
                           "{analysis.summary}"
                       </p>
                   </div>

                   {/* Metrics */}
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 space-y-6">
                       <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                           <Activity size={14} /> Core Metrics
                       </h3>
                       
                       <div className="space-y-4">
                           <div>
                               <div className="flex justify-between text-sm mb-1">
                                   <span className="text-zinc-500">Voice</span>
                                   <span className="font-medium text-ink dark:text-zinc-200">{analysis.voice}</span>
                               </div>
                               <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-indigo-500 w-full opacity-50"></div>
                               </div>
                           </div>
                           <div>
                               <div className="flex justify-between text-sm mb-1">
                                   <span className="text-zinc-500">Tone</span>
                                   <span className="font-medium text-ink dark:text-zinc-200">{analysis.tone}</span>
                               </div>
                               <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-teal-500 w-full opacity-50"></div>
                               </div>
                           </div>
                           <div>
                               <div className="flex justify-between text-sm mb-1">
                                   <span className="text-zinc-500">Pacing</span>
                                   <span className="font-medium text-ink dark:text-zinc-200">{analysis.pacing}</span>
                               </div>
                               <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-amber-500 w-full opacity-50"></div>
                               </div>
                           </div>
                           <div>
                               <div className="flex justify-between text-sm mb-1">
                                   <span className="text-zinc-500">Readability</span>
                                   <span className="font-medium text-ink dark:text-zinc-200">{analysis.readability}</span>
                               </div>
                               <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-purple-500 w-full opacity-50"></div>
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* Sense of Place - NEW METRIC */}
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <MapPin size={14} /> Sense of Place
                        </h3>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic border-l-2 border-emerald-500 pl-3 bg-emerald-50 dark:bg-emerald-900/10 py-2 rounded-r-lg">
                            {analysis.senseOfPlace || "Analysis not available."}
                        </p>
                   </div>

                   {/* Rhetorical Devices */}
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                       <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <BookOpen size={14} /> Rhetorical Devices
                       </h3>
                       <div className="flex flex-wrap gap-2">
                           {analysis.rhetoricalDevices.map((device, i) => (
                               <span key={i} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium">
                                   {device}
                               </span>
                           ))}
                           {analysis.rhetoricalDevices.length === 0 && (
                               <span className="text-zinc-400 text-sm italic">None detected prominently.</span>
                           )}
                       </div>
                   </div>

                   {/* Strengths */}
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                       <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <ThumbsUp size={14} /> Strengths
                       </h3>
                       <ul className="space-y-3">
                           {analysis.strengths.map((str, i) => (
                               <li key={i} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                                   <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                                   {str}
                               </li>
                           ))}
                       </ul>
                   </div>

                   {/* Weaknesses */}
                   <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                       <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Zap size={14} /> Areas for Refinement
                       </h3>
                       <ul className="space-y-3">
                           {analysis.weaknesses.map((weak, i) => (
                               <li key={i} className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                                   <div className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></div>
                                   {weak}
                               </li>
                           ))}
                       </ul>
                   </div>
               </div>
               
               {/* Follow Up Chat History */}
               {chatHistory.length > 0 && (
                   <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-8">
                       <h3 className="text-center text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Discussion</h3>
                       <div className="space-y-6 max-w-3xl mx-auto">
                           {chatHistory.map((msg, idx) => (
                               <motion.div 
                                   key={idx}
                                   initial={{ opacity: 0, y: 10 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                               >
                                   <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50'}`}>
                                       {msg.role === 'user' ? <Zap size={14} /> : <Feather size={14} />}
                                   </div>
                                   <div className={`flex-1 p-4 rounded-2xl text-sm leading-relaxed ${
                                       msg.role === 'user' 
                                       ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 rounded-tr-sm' 
                                       : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-tl-sm'
                                   }`}>
                                       {msg.content}
                                   </div>
                               </motion.div>
                           ))}
                           {isChatLoading && (
                               <div className="flex gap-4">
                                   <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center text-amber-600">
                                       <Loader2 size={14} className="animate-spin" />
                                   </div>
                                   <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-sm border border-zinc-200 dark:border-zinc-700 text-zinc-400 text-sm italic">
                                       Thinking...
                                   </div>
                               </div>
                           )}
                           <div ref={chatEndRef} />
                       </div>
                   </div>
               )}
           </motion.div>
       )}

       {/* Sticky Follow Up Input */}
       {analysis && !loading && (
            <div className="fixed bottom-0 left-0 w-full z-20 pointer-events-none">
               <div className="max-w-3xl mx-auto px-6 pb-6 pointer-events-auto">
                  <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl p-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                        placeholder="Ask a question about this analysis..."
                        disabled={isChatLoading}
                        className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm md:text-base dark:text-white placeholder-zinc-500"
                      />
                      <button 
                        type="button"
                        onClick={handleFollowUp}
                        disabled={!prompt.trim() || isChatLoading}
                        className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl transition-all shadow-md"
                      >
                         {isChatLoading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                      </button>
                  </div>
               </div>
            </div>
       )}
    </div>
  );
};

export default StyleAnalysisView;