"use client";

import React, { useState, useRef } from 'react';
import { Loader2, Send, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, onFileUpload }) => {
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !uploading) return;

    const content = newMessage;
    setNewMessage(''); 

    try {
      await onSendMessage(content);
    } catch (error) {
      setNewMessage(content); // Revert on failure
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await onFileUpload(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
      <form onSubmit={handleSend} className="flex items-end gap-2">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
        </button>
        
        <textarea 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none hide-scrollbar text-slate-800 dark:text-slate-200 min-h-[48px] max-h-32"
          rows={1}
        />
        
        <button 
          type="submit" 
          disabled={!newMessage.trim() && !uploading}
          className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 shrink-0 shadow-sm"
        >
          <Send className="w-5 h-5 ml-1" />
        </button>
      </form>
    </div>
  );
};