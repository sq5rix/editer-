
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
  const sources: SourceType[] = ['braindump', 'characters', 'research']; 
  
  const activeSource = sources[activeSourceIndex];

  const handleNext = () => setActiveSourceIndex((prev) => (prev + 1) % sources.length);
  const handlePrev = () => setActiveSourceIndex((prev) => (prev - 1 + sources.length) % sources.length);

  // Helper: Find matches and return context snippets
  const getMatches = (text: string, query: string) => {
      if (!text || !query) return [];
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase().trim();
      
      if (!normalizedQuery) return [];

      const matches: { start: number, end: number, preview: string }[] = [];
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

      const exactIndex = normalizedText.indexOf(normalizedQuery);
      if (exactIndex !== -1) {
          const start = Math.max(0, exactIndex - 30);
          const end = Math.min(text.length, exactIndex + query.length + 30);
          matches.push({
              start: exactIndex,
              end: exactIndex + query.length,
              preview: (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '')
          });
          return matches;
      }

      const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
      const mainToken = sortedTokens[0];
      
      if (mainToken) {
          let searchStart = 0;
          for(let i=0; i<2; i++) {
              const idx = normalizedText.indexOf(mainToken, searchStart);
              if (idx === -1) break;
              
              const start = Math.max(0, idx - 30);
              const end = Math.min(text.length, idx + mainToken.length + 40);
              
              matches.push({
                  start: idx,
                  end: idx + mainToken.length,
                  preview: (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '')
              });
              
              searchStart = idx + mainToken.length;
          }
      }
      return matches;
  };

  const isMatch = (text: string, query: string) => {
      if (!text || !query) return false;
      const normalizedText = text.toLowerCase();
      const normalizedQuery = query.toLowerCase().trim();
      if (normalizedText.includes(normalizedQuery)) return true;
      const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
      if (tokens.length > 1 && tokens.every(t => normalizedText.includes(t))) return true;
      return false;
  };

  const allItems = useMemo(() => {
    const items: { id: string; type: SourceType; title?: string; content: string; fullText: string }[] = [];

    blocks.forEach(block => {
        if (block.type === 'hr' || !block.content.trim()) return;
        items.push({ id: block.id, type: 'manuscript', content: block.content, fullText: block.content });
    });

    braindumpData.forEach(item => {
        items.push({ id: item.id, type: 'braindump', content: item.content, fullText: item.content });
    });

    characterData.forEach(char => {
        items.push({ id: char.id, type: 'characters', title: char.name, content: char.coreDesire, fullText: `${char.name} ${char.greimasRole} ${char.coreDesire} ${char.description}` });
    });

    researchData.forEach(thread => {
        thread.interactions.forEach(interaction => {
            items.push({ id: interaction.id, type: 'research', title: interaction.query, content: interaction.content, fullText: `${interaction.query} ${interaction.content}` });
        });
    });

    return items;
  }, [blocks, braindumpData, characterData, researchData]);

  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) {
        return allItems.filter(i => i.type === activeSource);
    }
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

  const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
      if (!highlight.trim()) return <span>{text}</span>;
      const tokens = highlight.trim().split(/\s+/).filter(t => t.length > 0);
      const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
      const parts = text.split(pattern);
      return (
          <span>
              {parts.map((part, i) => 
                  pattern.test(part)
                  ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded-sm px-0.5">{part}</mark> 
                  : <span key={i}>{part}</span>
              )}
          </span>
      );
  };

  return (
    <div className="h-full flex flex-col relative px-4 py-4 overflow-hidden">
      {!searchQuery.trim() ? (
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrev} className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
              <ChevronLeft size={18} />
            </button>
            <div className="font-display font-bold text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400 text-center select-none flex items-center justify-center gap-2">
              {getIcon(activeSource)}
              <span className="capitalize">{activeSource}</span>
            </div>
            <button onClick={handleNext} className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all">
              <ChevronRight size={18} />
            </button>
          </div>
      ) : (
          <div className="mb-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Global Search</div>
              <div className="text-[10px] text-zinc-400 font-mono">{displayItems.length} Result{displayItems.length !== 1 && 's'}</div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-12 no-scrollbar">
        <AnimatePresence mode="popLayout">
          {displayItems.length === 0 && (
             <motion.div 
               initial={{opacity: 0}} 
               animate={{opacity: 1}} 
               className="text-center py-20 px-4 flex flex-col items-center gap-3"
             >
                <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-400">
                    {getIcon(activeSource)}
                </div>
                <div className="text-xs text-zinc-400 italic">
                   {searchQuery ? `No results for "${searchQuery}"` : `Your ${activeSource} is empty.`}
                </div>
             </motion.div>
          )}
          
          {displayItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              draggable={item.type !== 'manuscript'}
              onDragStart={(e) => handleDragStart(e as any, item.fullText)}
              onClick={() => {
                  if (item.type === 'manuscript') onNavigate(item.id);
                  else onInsert(item.fullText);
              }}
              className={`group relative bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-xl hover:border-indigo-500/50 cursor-pointer transition-all select-none ${item.type === 'manuscript' ? 'border-l-4 border-l-zinc-400 dark:border-l-zinc-600' : ''}`}
            >
               <div className="flex items-center justify-between mb-2">
                   <div className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 px-2 py-1 rounded-md ${getColorClass(item.type)}`}>
                       {getIcon(item.type)}
                       <span>{item.type}</span>
                   </div>
                   <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                       {item.type === 'manuscript' ? <ArrowUpRight size={14} className="text-zinc-400"/> : <Plus size={14} className="text-indigo-500"/>}
                   </div>
               </div>

               {item.title && (
                 <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100 mb-2 leading-tight">
                     <HighlightedText text={item.title} highlight={searchQuery} />
                 </div>
               )}
               
               <div className="text-xs text-zinc-600 dark:text-zinc-400 font-serif leading-relaxed line-clamp-4">
                   {searchQuery && (item as any).snippets && (item as any).snippets.length > 0 ? (
                       (item as any).snippets.map((snip: any, idx: number) => (
                           <div key={idx} className="mb-1">
                               <HighlightedText text={snip.preview} highlight={searchQuery} />
                           </div>
                       ))
                   ) : (
                       item.content
                   )}
               </div>
               
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
