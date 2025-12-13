import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Feather, Loader2, RefreshCcw, ThumbsUp, ThumbsDown, Zap, BookOpen, Activity } from 'lucide-react';
import { StyleAnalysis, TypographySettings } from '../types';
import * as GeminiService from '../services/geminiService';

interface StyleAnalysisViewProps {
  text: string;
  typography: TypographySettings;
}

const StyleAnalysisView: React.FC<StyleAnalysisViewProps> = ({ text, typography }) => {
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");

  // Load from LocalStorage
  useEffect(() => {
    const savedAnalysis = localStorage.getItem('inkflow_style_analysis');
    const savedText = localStorage.getItem('inkflow_last_analyzed_text');
    if (savedAnalysis) {
      try {
        setAnalysis(JSON.parse(savedAnalysis));
      } catch (e) {
        console.error("Failed to parse saved style analysis", e);
      }
    }
    if (savedText) {
      setLastAnalyzedText(savedText);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (analysis) {
        localStorage.setItem('inkflow_style_analysis', JSON.stringify(analysis));
    }
    if (lastAnalyzedText) {
        localStorage.setItem('inkflow_last_analyzed_text', lastAnalyzedText);
    }
  }, [analysis, lastAnalyzedText]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await GeminiService.analyzeStyle(text);
      setAnalysis(result);
      setLastAnalyzedText(text);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isStale = text !== lastAnalyzedText && lastAnalyzedText !== "";

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto pt-6 px-6 pb-32">
       
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
             className="grid grid-cols-1 md:grid-cols-2 gap-6"
           >
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

           </motion.div>
       )}
    </div>
  );
};

export default StyleAnalysisView;