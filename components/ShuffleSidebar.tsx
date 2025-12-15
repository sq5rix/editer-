import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, GripVertical, Plus, Brain, User, Globe, X, FileText, ArrowUpRight } from 'lucide-react';
import { BraindumpItem, Character, ResearchThread, Block } from '../types';

type SourceType = 'braindump' | 'characters' | 'research' | 'manuscript';

interface ShuffleSidebarProps {
  onInsert: (text: string) => void;
  onNavigate: (blockId: string) => void;
  blocks: Block[];
  braindumpData: BraindumpItem[];
  characterData: Character[];
  researchData: ResearchThread[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const ShuffleSidebar: React.FC<ShuffleSidebarProps> = ({ onInsert, onNavigate, blocks, braindumpData, characterData, researchData, searchQuery, setSearchQuery }) => {
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const sources: SourceType[] = ['braindump', 'characters', 'research']; // Manuscript is hidden from tabs, only visible in search
  
  const activeSource = sources[activeSourceIndex];

  const handleNext = () => setActiveSourceIndex((prev) => (prev + 1) % sources.length);
  const handlePrev = () => setActiveSourceIndex((prev) => (prev - 1 + sources.length) % sources.length);

  // --- Search Logic ---

  // Helper: Find matches and return context snippets
  const getMatches = (text: string, query: string) => {
      if (!text || !query) return [];
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase().trim();
      
      if (!normalizedQuery) return [];

      const matches: { start: number, end: number, preview: string }[] = [];
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

      // Priority 1: Exact Phrase Match
      const exactIndex = normalizedText.indexOf(normalizedQuery);
      if (exactIndex !== -1) {
          const start = Math.max(0, exactIndex - 30);
          const end = Math.min(text.length, exactIndex + query.length + 30);
          const prefix = start > 0 ? '...' : '';
          const suffix = end < text.length ? '...' : '';
          matches.push({
              start: exactIndex,
              end: exactIndex + query.length,
              preview: prefix + text.substring(start, end) + suffix
          });
          return matches;
      }

      // Priority 2: Best Token Cluster (find context around the longest token)
      const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
      const mainToken = sortedTokens[0];
      
      if (mainToken) {
          let searchStart = 0;
          // Find up to 2 occurrences
          for(let i=0; i<2; i++) {
              const idx = normalizedText.indexOf(mainToken, searchStart);
              if (idx === -1) break;
              
              const start = Math.max(0, idx - 30);
              const end = Math.min(text.length, idx + mainToken.length + 40);
              const prefix = start > 0 ? '...' : '';
              const suffix = end < text.length ? '...' : '';
              
              matches.push({
                  start: idx,
                  end: idx + mainToken.length,
                  preview: prefix + text.substring(start, end) + suffix
              });
              
              searchStart = idx + mainToken.length;
          }
      }
      
      return matches.length > 0 ? matches : [];
  };

  const isMatch = (text: string, query: string) => {
      if (!text || !query) return false;
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase().trim();
      
      // 1. Exact substring (Highest confidence)
      if (normalizedText.includes(normalizedQuery)) return true;
      
      // 2. Token match (AND) - All words must exist as substrings
      // This allows "dark storm" to find "The dark and terrible storm"
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
      if (tokens.length > 1 && tokens.every(t => normalizedText.includes(t))) return true;

      return false;
  };

  // Flatten all data
  const allItems = useMemo(() => {
    const items: { id: string; type: SourceType; title?: string; content: string; fullText: string }[] = [];

    // Manuscript Blocks
    blocks.forEach(block => {
        if (block.type === 'hr' || !block.content.trim()) return;
        items.push({
            id: block.id,
            type: 'manuscript',
            content: block.content,
            fullText: block.content
        });
    });

    // Braindump
    braindumpData.forEach(item => {
        items.push({
            id: item.id,
            type: 'braindump',
            content: item.content,
            fullText: item.content
        });
    });

    // Characters
    characterData.forEach(char => {
        items.push({
            id: char.id,
            type: 'characters',
            title: char.name,
            content: char.coreDesire,
            fullText: `${char.name} ${char.greimasRole} ${char.coreDesire} ${char.description} ${char.history.map(h => h.content).join(' ')}`
        });
    });

    // Research
    researchData.forEach(thread => {
        thread.interactions.forEach(interaction => {
            items.push({
                id: interaction.id,
                type: 'research',
                title: interaction.query,
                content: interaction.content.substring(0, 150) + "...",
                fullText: `${interaction.query} ${interaction.content}`
            });
        });
    });

    return items;
  }, [blocks, braindumpData, characterData, researchData]);

  // Filter
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) {
        return allItems.filter(i => i.type === activeSource);
    }
    
    // Search
    return allItems
        .filter(i => isMatch(i.fullText, searchQuery))
        .map(item => ({
            ...item,
            snippets: getMatches(item.fullText, searchQuery)
        }));
  }, [allItems, searchQuery, activeSource]);

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getIcon = (type: SourceType) => {
      switch(type) {
          case 'braindump': return <Brain size={12} />;
          case 'characters': return <User size={12} />;
          case 'research': return <Globe size={12} />;
          case 'manuscript': return <FileText size={12} />;
      }
  };

  const getColorClass = (type: SourceType) => {
      switch(type) {
          case 'braindump': return 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
          case 'characters': return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
          case 'research': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
          case 'manuscript': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
      }
  };

  // Text highlighter component
  const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
      if (!highlight.trim()) return <span>{text}</span>;
      
      const tokens = highlight.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length === 0) return <span>{text}</span>;

      // Escape regex special chars and create a pattern for all tokens
      const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
      
      const parts = text.split(pattern);

      return (
          <span>
              {parts.map((part, i) => 
                  // If the part matches our pattern (is one of the tokens), highlight it
                  pattern.test(part)
                  ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded-sm px-0.5">{part}</mark> 
                  : <span key={i}>{part}</span>
              )}
          </span>
      );
  };

  return (
    <div className="h-full flex flex-col relative border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 pr-4">
      
      {/* Navigation Header - Only show if NOT searching */}
      {!searchQuery.trim() ? (
          <div className="flex items-center justify-between mb-4 pt-2 px-2">
            <button onClick={handlePrev} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ChevronLeft size={18} />
            </button>
            
            <div className="font-display font-bold text-sm uppercase tracking-widest text-zinc-600 dark:text-zinc-300 w-32 text-center select-none flex items-center justify-center gap-2">
              {getIcon(activeSource)}
              <span className="capitalize">{activeSource}</span>
            </div>

            <button onClick={handleNext} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
      ) : (
          <div className="mb-4 pt-4 px-2 flex items-center justify-between">
              <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                  Global Search
              </div>
              <div className="text-xs text-zinc-400">
                  {displayItems.length} found
              </div>
          </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-24 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
        <AnimatePresence mode="popLayout">
          {displayItems.length === 0 && (
             <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="text-center text-xs text-zinc-400 italic py-10">
                {searchQuery ? "No matches found." : "No items in this section."}
             </motion.div>
          )}
          
          {displayItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              draggable={item.type !== 'manuscript'}
              onDragStart={(e) => handleDragStart(e as any, item.fullText)}
              onClick={() => {
                  if (item.type === 'manuscript') {
                      onNavigate(item.id);
                  } else {
                      onInsert(item.fullText);
                  }
              }}
              className={`group relative bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-indigo-400/50 dark:hover:border-indigo-500/50 cursor-pointer transition-all select-none ${item.type === 'manuscript' ? 'border-l-4 border-l-zinc-300 dark:border-l-zinc-600' : ''}`}
            >
               <div className="flex items-center justify-between mb-1.5">
                   <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-1.5 py-0.5 rounded-md ${getColorClass(item.type)}`}>
                       {getIcon(item.type)}
                       <span>{item.type}</span>
                   </div>
               </div>

               {item.title && (
                 <div className="font-bold text-xs text-zinc-800 dark:text-zinc-200 mb-1 leading-snug">
                     <HighlightedText text={item.title} highlight={searchQuery} />
                 </div>
               )}
               
               {/* Show Snippets if searching, else full content preview */}
               <div className="text-xs text-zinc-500 dark:text-zinc-400 font-serif leading-relaxed">
                   {searchQuery && (item as any).snippets && (item as any).snippets.length > 0 ? (
                       (item as any).snippets.map((snip: any, idx: number) => (
                           <div key={idx} className="mb-1 p-1.5 bg-zinc-50 dark:bg-zinc-900/50 rounded border border-zinc-100 dark:border-zinc-800">
                               <HighlightedText text={snip.preview} highlight={searchQuery} />
                           </div>
                       ))
                   ) : (
                       <div className="line-clamp-3">{item.content}</div>
                   )}
               </div>
               
               {/* Actions */}
               <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   {item.type === 'manuscript' ? (
                       <div className="p-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 rounded shadow-sm">
                           <ArrowUpRight size={12} />
                       </div>
                   ) : (
                       <div className="p-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded shadow-sm">
                           <Plus size={12} />
                       </div>
                   )}
               </div>

               {/* Grip (Not for manuscript) */}
               {item.type !== 'manuscript' && (
                    <div className="absolute bottom-2 right-2 text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors pointer-events-none">
                        <GripVertical size={12} />
                    </div>
               )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ShuffleSidebar;