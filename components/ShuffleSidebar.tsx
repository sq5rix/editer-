import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, GripVertical, Plus } from 'lucide-react';
import { BraindumpItem, Character, ResearchThread } from '../types';

type SourceType = 'braindump' | 'characters' | 'research';

interface ShuffleSidebarProps {
  onInsert: (text: string) => void;
}

const ShuffleSidebar: React.FC<ShuffleSidebarProps> = ({ onInsert }) => {
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const sources: SourceType[] = ['braindump', 'characters', 'research'];
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data State
  const [braindumpItems, setBraindumpItems] = useState<BraindumpItem[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [researchThreads, setResearchThreads] = useState<ResearchThread[]>([]);

  // Load Data on Mount
  useEffect(() => {
    try {
      const bd = localStorage.getItem('inkflow_braindumps');
      if (bd) setBraindumpItems(JSON.parse(bd));

      const ch = localStorage.getItem('inkflow_characters');
      if (ch) setCharacters(JSON.parse(ch));

      const rs = localStorage.getItem('inkflow_research_threads');
      if (rs) setResearchThreads(JSON.parse(rs));
    } catch (e) {
      console.error("Error loading sidebar data", e);
    }
  }, []);

  const activeSource = sources[activeSourceIndex];

  const handleNext = () => setActiveSourceIndex((prev) => (prev + 1) % sources.length);
  const handlePrev = () => setActiveSourceIndex((prev) => (prev - 1 + sources.length) % sources.length);

  // Normalize data for display
  const displayItems = useMemo(() => {
    let items: { id: string; title?: string; content: string; fullText: string }[] = [];

    if (activeSource === 'braindump') {
      items = braindumpItems.map(item => ({
        id: item.id,
        content: item.content,
        fullText: item.content
      }));
    } else if (activeSource === 'characters') {
      items = characters.map(char => ({
        id: char.id,
        title: char.name,
        content: char.coreDesire,
        fullText: `**${char.name}** (${char.greimasRole})\n\n${char.description}`
      }));
    } else if (activeSource === 'research') {
      items = researchThreads.flatMap(thread => 
        thread.interactions.map(interaction => ({
          id: interaction.id,
          title: interaction.query,
          content: interaction.content.substring(0, 100) + "...",
          fullText: `### ${interaction.query}\n\n${interaction.content}`
        }))
      );
    }

    if (!searchQuery.trim()) return items;
    return items.filter(i => 
      (i.title && i.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
      i.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeSource, braindumpItems, characters, researchThreads, searchQuery]);

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="h-full flex flex-col relative border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 pr-4">
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6 pt-2 px-2">
        <button onClick={handlePrev} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronLeft size={18} />
        </button>
        
        <div className="font-display font-bold text-sm uppercase tracking-widest text-zinc-600 dark:text-zinc-300 w-24 text-center select-none">
          {activeSource}
        </div>

        <button onClick={handleNext} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Floating Search */}
      <div className="mb-4 relative px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
          <Search size={14} />
        </div>
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Fuzzy search..."
          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-24">
        <AnimatePresence mode="popLayout">
          {displayItems.length === 0 && (
             <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="text-center text-xs text-zinc-400 italic py-10">
                Nothing found.
             </motion.div>
          )}
          {displayItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              draggable="true"
              onDragStart={(e) => handleDragStart(e as any, item.fullText)}
              className="group relative bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-teal-500/30 cursor-grab active:cursor-grabbing transition-all select-none"
            >
               {item.title && (
                 <div className="font-bold text-xs text-zinc-700 dark:text-zinc-300 mb-1">{item.title}</div>
               )}
               <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 font-serif leading-relaxed">
                 {item.content}
               </div>
               
               {/* Hover Actions */}
               <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => onInsert(item.fullText)}
                     className="p-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:text-teal-600 rounded"
                     title="Insert into board"
                   >
                     <Plus size={12} />
                   </button>
               </div>
               
               {/* Drag Handle Visual */}
               <div className="absolute bottom-2 right-2 text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-400 transition-colors pointer-events-none">
                 <GripVertical size={12} />
               </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ShuffleSidebar;