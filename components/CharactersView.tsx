import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, Trash2, Copy, Sparkles, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Character, TypographySettings, CharacterMessage, User as UserType } from '../types';
import * as GeminiService from '../services/geminiService';
import * as FirebaseService from '../services/firebase';
import { v4 as uuidv4 } from 'uuid';
import TextareaAutosize from 'react-textarea-autosize';

interface CharactersViewProps {
  onCopy: (text: string) => void;
  typography: TypographySettings;
  onActiveContentUpdate?: (text: string) => void;
  user: (UserType & { uid?: string }) | null;
}

const CharactersView: React.FC<CharactersViewProps> = ({ onCopy, typography, onActiveContentUpdate, user }) => {
  const [input, setInput] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    if (user?.uid) {
        FirebaseService.loadData(user.uid, 'characters', 'main').then(data => {
            if (data && data.characters) {
                setCharacters(data.characters);
            } else {
                const saved = localStorage.getItem('inkflow_characters');
                if (saved) setCharacters(JSON.parse(saved));
            }
        });
    } else {
        const saved = localStorage.getItem('inkflow_characters');
        if (saved) setCharacters(JSON.parse(saved));
    }
  }, [user]);

  // Save Data
  useEffect(() => {
    localStorage.setItem('inkflow_characters', JSON.stringify(characters));
    if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'characters', 'main', { characters });
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [characters, user]);

  // Broadcast for global copy
  useEffect(() => {
    if (onActiveContentUpdate) {
        const text = characters.map(c => 
            `NAME: ${c.name} (${c.greimasRole})\nDESIRE: ${c.coreDesire}\n\n${c.description}\n\nNOTES:\n${c.history.filter(h => h.role === 'model').map(h => h.content).join('\n\n')}`
        ).join('\n\n---\n\n');
        onActiveContentUpdate(text);
    }
  }, [characters, onActiveContentUpdate]);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
        const profile = await GeminiService.generateCharacter(input);
        const newCharacter: Character = {
            id: uuidv4(),
            ...profile,
            history: [],
            timestamp: Date.now()
        };
        setCharacters(prev => [newCharacter, ...prev]);
        setInput("");
    } catch (err) {
        alert("Failed to generate character. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const handleFollowUp = async (characterId: string, prompt: string) => {
      if (!prompt.trim()) return;
      
      const charIndex = characters.findIndex(c => c.id === characterId);
      if (charIndex === -1) return;

      const updatedChars = [...characters];
      const char = updatedChars[charIndex];

      // Add user message immediately
      char.history.push({ role: 'user', content: prompt });
      setCharacters(updatedChars);
      setGeneratingId(characterId);

      try {
          const response = await GeminiService.refineCharacter(char, prompt);
          // Add model response
          const newHistory = [...char.history, { role: 'model', content: response } as CharacterMessage];
          
          setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, history: newHistory } : c));

      } catch (err) {
          console.error(err);
      } finally {
          setGeneratingId(null);
      }
  };

  const handleDelete = (id: string) => {
      setCharacters(prev => prev.filter(c => c.id !== id));
  };

  const roleColors = {
      'Subject': 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'Object': 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      'Sender': 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      'Receiver': 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
      'Helper': 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
      'Opponent': 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto pt-6">
       
       {/* Input Section */}
       <div className="mb-10 px-6 relative z-20 text-center">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User size={24} />
            </div>
            <h2 className="font-display font-bold text-2xl text-ink dark:text-zinc-100 mb-2">Character Forge</h2>
            <p className="text-sm text-zinc-500 max-w-lg mx-auto mb-8">
                Create complex characters aligned with the Greimas Actantial Model. 
                Describe a role, a desire, or a story concept.
            </p>

            <form onSubmit={handleCreate} className="relative max-w-xl mx-auto">
                <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading}
                    placeholder="e.g. A retired detective who is framed for a crime..."
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full pl-6 pr-14 py-4 shadow-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
                <button 
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                </button>
            </form>
       </div>

       {/* Characters Grid */}
       <div className="grid grid-cols-1 gap-8 pb-32 px-6">
          <AnimatePresence>
            {characters.map((char) => (
                <CharacterCard 
                    key={char.id} 
                    character={char} 
                    typography={typography}
                    onDelete={handleDelete}
                    onFollowUp={handleFollowUp}
                    isGenerating={generatingId === char.id}
                    colorClass={roleColors[char.greimasRole]}
                    onCopy={onCopy}
                />
            ))}
          </AnimatePresence>
          
          {characters.length === 0 && !loading && (
              <div className="text-center py-12 text-zinc-400 italic">
                  No characters forged yet.
              </div>
          )}
       </div>
    </div>
  );
};

const CharacterCard: React.FC<{
    character: Character;
    typography: TypographySettings;
    onDelete: (id: string) => void;
    onFollowUp: (id: string, prompt: string) => void;
    isGenerating: boolean;
    colorClass: string;
    onCopy: (text: string) => void;
}> = ({ character, typography, onDelete, onFollowUp, isGenerating, colorClass, onCopy }) => {
    const [prompt, setPrompt] = useState("");
    const [expanded, setExpanded] = useState(false);
    
    // Auto-scroll to bottom of history
    const historyRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (expanded && historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [character.history, expanded, isGenerating]);

    const handleSend = () => {
        if (prompt.trim()) {
            onFollowUp(character.id, prompt);
            setPrompt("");
            setExpanded(true); // Auto expand if chatting
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col md:flex-row"
        >
            {/* Left: Card Profile */}
            <div className="p-6 md:p-8 flex-1">
                <div className="flex justify-between items-start mb-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${colorClass}`}>
                        {character.greimasRole}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => onCopy(character.description)} className="p-2 text-zinc-400 hover:text-indigo-600 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors">
                            <Copy size={16} />
                        </button>
                        <button onClick={() => onDelete(character.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <h3 className="font-display font-bold text-2xl text-ink dark:text-zinc-100 mb-2">{character.name}</h3>
                
                <div className="mb-6 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border-l-2 border-indigo-400">
                    <span className="text-xs font-bold text-zinc-400 uppercase mr-2">Core Desire:</span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 italic">{character.coreDesire}</span>
                </div>

                <div 
                    className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300"
                    style={{
                        fontFamily: typography.fontFamily === 'mono' ? 'JetBrains Mono' : typography.fontFamily === 'sans' ? 'Inter' : 'Merriweather',
                        fontSize: `${typography.fontSize}px`,
                        lineHeight: '1.6'
                    }}
                >
                    {character.description}
                </div>
            </div>

            {/* Right/Bottom: Follow-up Area */}
            <div className="md:w-80 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col">
                <div 
                    className={`flex-1 overflow-y-auto p-4 space-y-4 min-h-[150px] md:max-h-[500px] transition-all ${expanded ? 'h-96' : 'h-40 md:h-auto'}`}
                    ref={historyRef}
                >
                    {character.history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-sm italic opacity-60">
                            <Sparkles size={16} className="mb-2" />
                            <p>Refine this character...</p>
                        </div>
                    ) : (
                        character.history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                    {isGenerating && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-zinc-800 rounded-xl px-3 py-2 border border-zinc-200 dark:border-zinc-700">
                                <Loader2 size={16} className="animate-spin text-zinc-400" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                     {/* Mobile Expand Toggle */}
                     <button 
                        onClick={() => setExpanded(!expanded)} 
                        className="w-full flex justify-center pb-2 md:hidden text-zinc-300 hover:text-zinc-500"
                    >
                        {expanded ? <ChevronDown size={16}/> : <ChevronUp size={16} />}
                     </button>

                     <div className="relative">
                        <TextareaAutosize
                            maxRows={4}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask follow-up..."
                            className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl pl-3 pr-10 py-2.5 text-sm outline-none resize-none focus:ring-1 focus:ring-indigo-500/30"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!prompt.trim() || isGenerating}
                            className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Send size={14} />
                        </button>
                     </div>
                </div>
            </div>
        </motion.div>
    );
};

export default CharactersView;