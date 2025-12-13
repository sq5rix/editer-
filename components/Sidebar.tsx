import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import { Suggestion } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion | null;
  onApply: (text: string) => void;
  loading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, suggestions, onApply, loading }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.5 }}
          transition={{ type: "spring", stiffness: 150, damping: 25 }}
          className="fixed right-0 top-0 h-full w-full md:w-96 bg-paper dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-40 flex flex-col pt-16"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-display font-bold text-xl dark:text-zinc-100">
              {loading ? "Analyzing..." : "Editorial Suggestions"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <X size={20} className="dark:text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
             {loading && (
               <div className="space-y-4 animate-pulse">
                 <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
                 <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                 <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
               </div>
             )}

             {!loading && suggestions && (
               <div className="space-y-4">
                 <div className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-2">
                   Original
                 </div>
                 <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg italic text-zinc-600 dark:text-zinc-400 text-sm border-l-2 border-zinc-300">
                   "{suggestions.originalText}"
                 </div>

                 <div className="text-sm font-medium text-zinc-500 uppercase tracking-wide mt-6 mb-2">
                   {suggestions.type === 'synonym' && 'Variations'}
                   {suggestions.type === 'expand' && 'Expanded Versions'}
                   {suggestions.type === 'grammar' && 'Grammar Fixes'}
                   {suggestions.type === 'sensory' && 'Sensory Details'}
                   {suggestions.type === 'show-dont-tell' && 'Show, Don\'t Tell'}
                   {suggestions.type === 'sense-of-place' && 'Setting & Atmosphere'}
                   {suggestions.type === 'custom' && 'Magic Drafts'}
                 </div>

                 <div className="space-y-3">
                   {suggestions.options.map((option, idx) => (
                     <motion.div
                       key={idx}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: idx * 0.1 }}
                       className="group p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition-all cursor-pointer relative"
                       onClick={() => onApply(option)}
                     >
                       <p className="text-base text-zinc-800 dark:text-zinc-200 font-serif leading-relaxed">
                         {option}
                       </p>
                       <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                           <Check size={14} /> Apply
                         </span>
                       </div>
                     </motion.div>
                   ))}
                 </div>
               </div>
             )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;