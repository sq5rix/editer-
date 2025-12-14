import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Block, User } from '../types';
import * as FirebaseService from '../services/firebase';
import * as GeminiService from '../services/geminiService';
import { parseTextToBlocks } from '../utils';

export const useManuscript = (user: (User & { uid?: string }) | null, bookId: string) => {
  const [blocks, setBlocks] = useState<Block[]>([{ id: uuidv4(), type: 'p', content: '' }]);
  const [originalSnapshot, setOriginalSnapshot] = useState<Block[]>([]);
  const [isAutoCorrecting, setIsAutoCorrecting] = useState(false);
  const [processingBlockId, setProcessingBlockId] = useState<string | null>(null);
  
  // History
  const [history, setHistory] = useState<Block[][]>([]);
  const [redoStack, setRedoStack] = useState<Block[][]>([]);

  // Load
  useEffect(() => {
    const loadManuscript = async () => {
        if (user?.uid) {
             const data = await FirebaseService.loadData(user.uid, 'manuscript', bookId);
             if (data && data.blocks) {
                 setBlocks(data.blocks);
                 return;
             }
        }
        
        const localKey = `inkflow_manuscript_${bookId}`;
        const saved = localStorage.getItem(localKey);
        
        // Migration logic
        if (!saved && bookId === 'default' && localStorage.getItem('inkflow_manuscript')) {
             const legacy = localStorage.getItem('inkflow_manuscript');
             if (legacy) {
                 setBlocks(JSON.parse(legacy));
                 return;
             }
        }

        if (saved) {
            setBlocks(JSON.parse(saved));
        } else {
            setBlocks([{ id: uuidv4(), type: 'p', content: '' }]);
        }
    };
    loadManuscript();
  }, [bookId, user]);

  // Save
  useEffect(() => {
      if (!bookId) return;
      const localKey = `inkflow_manuscript_${bookId}`;
      localStorage.setItem(localKey, JSON.stringify(blocks));

      if (user?.uid) {
        const timer = setTimeout(() => {
            FirebaseService.saveData(user.uid!, 'manuscript', bookId, { blocks });
        }, 2000);
        return () => clearTimeout(timer);
      }
  }, [blocks, user, bookId]);

  const saveHistory = useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev, blocks];
      if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
      return newHistory;
    });
    setRedoStack([]); 
  }, [blocks]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousBlocks = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setRedoStack(prev => [...prev, blocks]); 
    setBlocks(previousBlocks);
    setHistory(newHistory);
  }, [history, blocks]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextBlocks = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    setHistory(prev => [...prev, blocks]); 
    setBlocks(nextBlocks);
    setRedoStack(newRedo);
  }, [redoStack, blocks]);

  const updateBlock = (id: string, content: string) => {
      if (content.trim() === '---') {
          setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'hr', content: '' } : b));
          return;
      }
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const addBlock = (afterId: string, content: string = '') => {
      saveHistory();
      const newId = uuidv4();
      setBlocks(prev => {
          const index = prev.findIndex(b => b.id === afterId);
          if (index === -1) return [...prev, { id: newId, type: 'p', content }];
          const newBlocks = [...prev];
          newBlocks.splice(index + 1, 0, { id: newId, type: 'p', content });
          return newBlocks;
      });
      return newId;
  };

  const removeBlock = (id: string) => {
      saveHistory();
      setBlocks(prev => {
          if (prev.length <= 1) return [{ id: uuidv4(), type: 'p', content: '' }];
          return prev.filter(b => b.id !== id);
      });
  };

  const clearAll = () => {
      saveHistory();
      const newId = uuidv4();
      setBlocks([{ id: newId, type: 'p', content: '' }]);
      return newId;
  };

  const importText = (text: string) => {
      saveHistory();
      const newBlocks = parseTextToBlocks(text);
      if (blocks.length === 1 && blocks[0].content === '') {
          setBlocks(newBlocks);
      } else {
          setBlocks(prev => [...prev, ...newBlocks]);
      }
  };

  const pasteText = (targetId: string, text: string) => {
      saveHistory();
      const newBlocksData = parseTextToBlocks(text);
      if (newBlocksData.length === 0) return;

      setBlocks(prev => {
        const index = prev.findIndex(b => b.id === targetId);
        if (index === -1) return prev;

        const currentBlock = prev[index];
        const newBlockList = [...prev];

        if (currentBlock.content.trim() === '') {
           // Replace empty block
           newBlockList.splice(index, 1, ...newBlocksData);
        } else {
           // Insert after current block
           newBlockList.splice(index + 1, 0, ...newBlocksData);
        }
        return newBlockList;
      });
  };

  const takeSnapshot = () => {
      setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
  };

  const revertToSnapshot = () => {
      if (originalSnapshot.length > 0) {
          setBlocks(JSON.parse(JSON.stringify(originalSnapshot)));
      }
  };

  // --- Grammar / Auto-Correct Logic ---
  const performGrammarCheck = async () => {
      if (isAutoCorrecting) return;
      setIsAutoCorrecting(true);
      
      const safetyTimer = setTimeout(() => setIsAutoCorrecting(false), 20000);
      
      try {
          // Snapshot for diffing
          setOriginalSnapshot(JSON.parse(JSON.stringify(blocks)));
          
          // Initial delay to show spinner
          await new Promise(resolve => setTimeout(resolve, 500));

          const blocksToProcess = [...blocks]; 

          for (let i = 0; i < blocksToProcess.length; i++) {
              const block = blocksToProcess[i];

              if (block.type === 'hr' || block.type === 'h1' || block.content.trim().length < 2) continue;

              setProcessingBlockId(block.id); // Highlight yellow

              try {
                  const corrected = await GeminiService.autoCorrect(block.content);
                  
                  if (corrected && corrected !== block.content) {
                      setBlocks(prev => {
                          const newBlocks = [...prev];
                          const idx = newBlocks.findIndex(b => b.id === block.id);
                          if (idx !== -1) {
                              newBlocks[idx] = { ...newBlocks[idx], content: corrected };
                          }
                          return newBlocks;
                      });
                  }
                  // Small delay to let user see the yellow processing state
                  await new Promise(resolve => setTimeout(resolve, 300));
              } catch (e) {
                  console.error(`Error fixing block ${block.id}`, e);
              }
          }
      } catch (err) {
          console.error("Global grammar error", err);
      } finally {
          setProcessingBlockId(null);
          clearTimeout(safetyTimer);
          setIsAutoCorrecting(false);
      }
  };

  return {
      blocks,
      setBlocks,
      history,
      redoStack,
      undo,
      redo,
      updateBlock,
      addBlock,
      removeBlock,
      clearAll,
      importText,
      pasteText,
      saveHistory,
      
      isAutoCorrecting,
      processingBlockId,
      performGrammarCheck,
      originalSnapshot,
      takeSnapshot,
      revertToSnapshot
  };
};