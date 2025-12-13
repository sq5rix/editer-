import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Monitor, Type, Minus, Plus, Settings, Eye, LogOut, User as UserIcon } from 'lucide-react';
import { Theme, TypographySettings, User } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  typography: TypographySettings;
  onTypographyChange: (settings: TypographySettings) => void;
  user: User | null;
  onLogout: () => void;
  onLogin: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen, onClose, theme, onThemeChange, typography, onTypographyChange, user, onLogout, onLogin
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
            className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-[150]"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-[160] overflow-hidden"
          >
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
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

            {/* Scrollable Content */}
            <div className="flex-1 p-6 space-y-8 overflow-y-auto">

              {/* Account Section */}
              <div className="space-y-3">
                 <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Account</label>
                 <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                    {user ? (
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             {user.picture ? (
                               <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-600" />
                             ) : (
                               <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                  <UserIcon size={20} />
                               </div>
                             )}
                             <div>
                                <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{user.name}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</div>
                             </div>
                         </div>
                         <button 
                           onClick={onLogout}
                           className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                           title="Sign out"
                         >
                            <LogOut size={18} />
                         </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                         <div className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to sync your progress</div>
                         <button 
                           onClick={onLogin}
                           className="w-full py-2.5 px-4 bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                         >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-200">Sign in with Google</span>
                         </button>
                      </div>
                    )}
                 </div>
              </div>
              
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