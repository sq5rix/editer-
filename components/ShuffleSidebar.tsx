import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, GripVertical, Plus, Brain, User, Globe, X } from 'lucide-react';
import { BraindumpItem, Character, ResearchThread } from '../types';

type SourceType = 'braindump' | 'characters' | 'research';

interface ShuffleSidebarProps {
  onInsert: (text: string) => void;
  braindumpData: BraindumpItem[];
  characterData: Character[];
  researchData: ResearchThread[];
}

const ShuffleSidebar: React.FC<ShuffleSidebarProps> = ({ onInsert, braindumpData, characterData, researchData }) => {
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const sources: SourceType[] = ['braindump', 'characters', 'research'];
  const [searchQuery, setSearchQuery] = useState("");
  
  const activeSource = sources[activeSourceIndex];

  const handleNext = () => setActiveSourceIndex((prev) => (prev + 1) % sources.length);
  const handlePrev = () => setActiveSourceIndex((prev) => (prev - 1 + sources.length) % sources.length);

  // Fuzzy match helper
  const isMatch = (text: string, query: string) => {
      if (!query) return true;
      const cleanQuery = query.trim().replace(/\s+/g, ''); // Remove spaces for stricter fuzzy
      if (!cleanQuery) return true;
      
      try {
          // Escape regex characters
          const escaped = cleanQuery.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          // Join with .* for fuzzy matching (e.g. "abc" matches "a...b...c")
          const pattern = escaped.join('.*');
          const re = new RegExp(pattern, 'i');
          return re.test(text);
      } catch (e) {
          // Fallback to simple includes if regex fails (rare)
          return text.toLowerCase().includes(query.toLowerCase());
      }
  };

  // Flatten all data first
  const allItems = useMemo(() => {
    const items: { id: string; type: SourceType; title?: string; content: string; fullText: string }[] = [];

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
            fullText: `**${char.name}** (${char.greimasRole})\n\n${char.description}`
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
                fullText: `### ${interaction.query}\n\n${interaction.content}`
            });
        });
    });

    return items;
  }, [braindumpData, characterData, researchData]);

  // Filter based on search query or active tab
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) {
        // If no search, show only active tab
        return allItems.filter(i => i.type === activeSource);
    }
    
    // If searching, search EVERYTHING
    return allItems.filter(i => 
      (i.title && isMatch(i.title, searchQuery)) || 
      isMatch(i.content, searchQuery)
    );
  }, [allItems, searchQuery, activeSource]);

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getIcon = (type: SourceType) => {
      switch(type) {
          case 'braindump': return <Brain size={10} />;
          case 'characters': return <User size={10} />;
          case 'research': return <Globe size={10} />;
      }
  };

  return (
    <div className="h-full flex flex-col relative border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 pr-4">
      
      {/* Navigation Header - Only show if NOT searching */}
      {!searchQuery.trim() ? (
          <div className="flex items-center justify-between mb-4 pt-2 px-2">
            <button onClick={handlePrev} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ChevronLeft size={18} />
            </button>
            
            <div className="font-display font-bold text-sm uppercase tracking-widest text-zinc-600 dark:text-zinc-300 w-24 text-center select-none flex items-center justify-center gap-2">
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
                  {displayItems.length} results
              </div>
          </div>
      )}

      {/* Floating Search */}
      <div className="mb-4 relative px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
          <Search size={14} />
        </div>
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type to search all cards..."
          className={`w-full bg-white dark:bg-zinc-800 border ${searchQuery ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/10' : 'border-zinc-200 dark:border-zinc-700'} rounded-xl pl-9 pr-8 py-2 text-sm shadow-sm outline-none transition-all`}
        />
        {searchQuery && (
            <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600"
            >
                <X size={14} />
            </button>
        )}
      </div>

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
              draggable="true"
              onDragStart={(e) => handleDragStart(e as any, item.fullText)}
              className="group relative bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-indigo-400/50 dark:hover:border-indigo-500/50 cursor-grab active:cursor-grabbing transition-all select-none"
            >
               <div className="flex items-center justify-between mb-1.5">
                   {/* Source Badge (Only visible during search or mixed view contexts) */}
                   <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-1.5 py-0.5 rounded-md ${
                       item.type === 'braindump' ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' :
                       item.type === 'characters' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                       'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                   }`}>
                       {getIcon(item.type)}
                       <span>{item.type}</span>
                   </div>
               </div>

               {item.title && (
                 <div className="font-bold text-xs text-zinc-800 dark:text-zinc-200 mb-1 leading-snug">{item.title}</div>
               )}
               <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 font-serif leading-relaxed">
                 {item.content}
               </div>
               
               {/* Hover Actions */}
               <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => onInsert(item.fullText)}
                     className="p-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded shadow-sm"
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