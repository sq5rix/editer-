import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Maximize2, CheckCircle, Eye, BookOpen } from 'lucide-react';

interface FloatingMenuProps {
  position: { top: number; left: number } | null;
  menuType?: 'selection' | 'block';
  onSynonym?: () => void;
  onExpand?: () => void;
  onGrammar?: () => void;
  onSensory?: () => void;
  onShowDontTell?: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ 
  position, 
  menuType = 'selection',
  onSynonym, 
  onExpand, 
  onGrammar,
  onSensory,
  onShowDontTell
}) => {
  if (!position) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ top: position.top, left: position.left }}
        className="fixed z-50 flex items-center bg-zinc-900/95 dark:bg-zinc-100/95 backdrop-blur-md rounded-full px-2 py-1 shadow-xl border border-white/10 dark:border-black/10 text-white dark:text-zinc-900 -translate-x-1/2 mt-2"
      >
        {menuType === 'selection' && (
          <>
            <button onClick={onSynonym} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors tooltip-trigger group relative">
              <Sparkles size={16} />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Synonyms</span>
            </button>
            <div className="w-px h-4 bg-white/20 dark:bg-black/20 mx-1"></div>
            <button onClick={onExpand} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
              <Maximize2 size={16} />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Expand</span>
            </button>
            <div className="w-px h-4 bg-white/20 dark:bg-black/20 mx-1"></div>
            <button onClick={onGrammar} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
              <CheckCircle size={16} />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Grammar</span>
            </button>
          </>
        )}

        {menuType === 'block' && (
          <>
            <button onClick={onSensory} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
              <Eye size={16} />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Sensorize</span>
            </button>
            <div className="w-px h-4 bg-white/20 dark:bg-black/20 mx-1"></div>
            <button onClick={onShowDontTell} className="p-2 hover:bg-white/20 dark:hover:bg-black/10 rounded-full transition-colors group relative">
              <BookOpen size={16} />
              <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Show, Don't Tell</span>
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingMenu;