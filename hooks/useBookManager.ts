import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BookEntry, User } from '../types';
import * as FirebaseService from '../services/firebase';

export const useBookManager = (user: (User & { uid?: string }) | null) => {
  const [books, setBooks] = useState<BookEntry[]>(() => {
    try {
        const saved = localStorage.getItem('inkflow_books_index');
        if (saved) return JSON.parse(saved);
        return [{ id: 'default', title: 'Untitled Draft', createdAt: Date.now(), lastModified: Date.now() }];
    } catch {
        return [{ id: 'default', title: 'Untitled Draft', createdAt: Date.now(), lastModified: Date.now() }];
    }
  });
  
  const [currentBookId, setCurrentBookId] = useState<string>(() => {
     return localStorage.getItem('inkflow_active_book_id') || 'default';
  });

  // Load from Cloud
  useEffect(() => {
      if (user?.uid) {
          FirebaseService.loadData(user.uid, 'settings', 'books_index').then(data => {
              if (data && data.books) {
                  setBooks(data.books);
              }
          });
      }
  }, [user]);

  // Save to Cloud & Local
  useEffect(() => {
      localStorage.setItem('inkflow_books_index', JSON.stringify(books));
      if (user?.uid) {
          FirebaseService.saveData(user.uid, 'settings', 'books_index', { books });
      }
  }, [books, user]);

  useEffect(() => {
     if (!books.find(b => b.id === currentBookId)) {
         setCurrentBookId(books[0]?.id || 'default');
     }
     localStorage.setItem('inkflow_active_book_id', currentBookId);
  }, [books, currentBookId]);

  const handleCreateBook = () => {
      const newBook: BookEntry = {
          id: uuidv4(),
          title: "Untitled Draft",
          createdAt: Date.now(),
          lastModified: Date.now()
      };
      setBooks(prev => [...prev, newBook]);
      setCurrentBookId(newBook.id);
  };

  const handleDeleteBook = (id: string) => {
      if (books.length <= 1) return; 
      const newBooks = books.filter(b => b.id !== id);
      setBooks(newBooks);
      if (currentBookId === id) setCurrentBookId(newBooks[0].id);
  };

  const handleRenameBook = (id: string, newTitle: string) => {
      setBooks(prev => prev.map(b => b.id === id ? { ...b, title: newTitle } : b));
  };

  return {
      books,
      currentBookId,
      setCurrentBookId,
      handleCreateBook,
      handleDeleteBook,
      handleRenameBook
  };
};