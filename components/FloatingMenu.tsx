import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Maximize2, CheckCircle } from 'lucide-react';

interface FloatingMenuProps {
  position: { top: number; left: number } | null;
  onSynonym: () => void;
  onExpand: () => void;
  onGrammar: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ position, onSynonym, onExpand, onGrammar }) => {
  if (!position) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ top: position.top - 50, left: position.left }}
        className="fixed z-50 flex items-center bg-zinc-900/90 dark:bg-zinc-100/90 backdrop-blur-md rounded-full px-2 py-1 shadow-xl border border-white/10 dark:border-black/10 text-white dark:text-zinc-900"
      >
        <button onClick={onSynonym} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors tooltip-trigger group relative">
          <Sparkles size={16} />
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">Synonyms</span>
        </button>
        <div className="w-px h-4 bg-white/20 dark:bg-black/20 mx-1"></div>
        <button onClick={onExpand} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
          <Maximize2 size={16} />
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">Expand</span>
        </button>
        <div className="w-px h-4 bg-white/20 dark:bg-black/20 mx-1"></div>
        <button onClick={onGrammar} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
          <CheckCircle size={16} />
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">Grammar</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingMenu;
