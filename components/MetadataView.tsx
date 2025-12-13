import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import { Book, Sparkles, Copy, Loader2, Save, Tag } from 'lucide-react';
import { BookMetadata, TypographySettings } from '../types';
import * as GeminiService from '../services/geminiService';

interface MetadataViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
  manuscriptText: string;
  onActiveContentUpdate?: (text: string) => void;
}

const MetadataView: React.FC<MetadataViewProps> = ({ onCopy, typography, manuscriptText, onActiveContentUpdate }) => {
  const [data, setData] = useState<BookMetadata>({
    title: "",
    subtitle: "",
    author: "",
    blurb: "",
    copyright: "",
    kdpTags: []
  });
  
  const [loading, setLoading] = useState<string | null>(null); // tracks which field is loading
  const [subtitleSuggestions, setSubtitleSuggestions] = useState<string[]>([]);

  // Load/Save Logic
  useEffect(() => {
    const saved = localStorage.getItem('inkflow_metadata');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('inkflow_metadata', JSON.stringify(data));
  }, [data]);

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

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto pt-6 px-6 pb-32">
        
        <div className="text-center mb-10">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Book size={24} />
            </div>
            <h2 className="font-display font-bold text-2xl text-ink dark:text-zinc-100">Book Metadata</h2>
            <p className="text-sm text-zinc-500 max-w-lg mx-auto mt-2">
                Prepare your manuscript for the world with AI-assisted titles, blurbs, and distribution data.
            </p>
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

// Simple icon component for local use
const XIcon = ({ size }: { size: number }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

export default MetadataView;