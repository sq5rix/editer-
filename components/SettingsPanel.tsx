import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Monitor, Type, Minus, Plus, Settings, Eye } from 'lucide-react';
import { Theme, TypographySettings } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  typography: TypographySettings;
  onTypographyChange: (settings: TypographySettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, onClose, theme, onThemeChange, typography, onTypographyChange
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <Settings size={20} />
                <h2 className="font-display font-bold text-lg">Editor Settings</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              
              {/* Theme Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Appearance</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => onThemeChange('light')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'light' ? 'bg-amber-50 border-amber-500/50 text-amber-700' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500'}`}
                  >
                    <Sun size={20} />
                    <span className="text-xs font-medium">Light</span>
                  </button>
                  <button 
                    onClick={() => onThemeChange('dark')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-400' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500'}`}
                  >
                    <Moon size={20} />
                    <span className="text-xs font-medium">Dark</span>
                  </button>
                  <button 
                    onClick={() => onThemeChange('system')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${theme === 'system' ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-500/50 text-zinc-900 dark:text-zinc-100' : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500'}`}
                  >
                    <Monitor size={20} />
                    <span className="text-xs font-medium">System</span>
                  </button>
                </div>
              </div>

              {/* Typography Section */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Typography</label>
                
                {/* Font Family */}
                <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                   {(['serif', 'sans', 'mono'] as const).map((font) => (
                     <button
                       key={font}
                       onClick={() => onTypographyChange({ ...typography, fontFamily: font })}
                       className={`flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize ${typography.fontFamily === font ? 'bg-white dark:bg-zinc-700 shadow-sm text-ink dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                     >
                       {font}
                     </button>
                   ))}
                </div>

                {/* Size & Contrast Controls */}
                <div className="grid grid-cols-1 gap-6">
                    {/* Font Size */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                            <Type size={16} />
                            <span className="text-sm">Size</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => onTypographyChange({ ...typography, fontSize: Math.max(12, typography.fontSize - 1) })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"><Minus size={16}/></button>
                            <span className="w-8 text-center font-mono text-sm">{typography.fontSize}</span>
                            <button onClick={() => onTypographyChange({ ...typography, fontSize: Math.min(48, typography.fontSize + 1) })} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"><Plus size={16}/></button>
                        </div>
                    </div>

                    {/* Contrast Slider */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                            <div className="flex items-center gap-2">
                                <Eye size={16} />
                                <span className="text-sm">Contrast</span>
                            </div>
                            <span className="text-xs font-mono">{Math.round(typography.contrast * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.3" 
                            max="1" 
                            step="0.05"
                            value={typography.contrast}
                            onChange={(e) => onTypographyChange({ ...typography, contrast: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;