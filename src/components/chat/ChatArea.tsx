"use client";

import React, { useRef, useEffect } from 'react';
import { MessageSquare, Users, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Conversation, Message } from '../../types/chat';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  activeConv: Conversation | null;
  messages: Message[];
  currentUserId: string | undefined;
  onClose: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onFileUpload: (file: File) => Promise<void>;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ 
  activeConv, 
  messages, 
  currentUserId, 
  onClose, 
  onSendMessage, 
  onFileUpload 
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={cn(
      "flex-1 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 md:rounded-2xl shadow-sm overflow-hidden h-full absolute md:relative inset-0 md:inset-auto z-10 md:z-0",
      activeConv ? "flex" : "hidden md:flex"
    )}>
      {activeConv ? (
        <>
          <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 shrink-0">
            <button onClick={onClose} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-3">
              {activeConv.type === 'GROUP' ? (
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              ) : activeConv.other_user_avatar ? (
                <img src={activeConv.other_user_avatar} alt="Avatar" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center font-bold">
                  {activeConv.other_user_name?.[0] || 'U'}
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white leading-tight">
                  {activeConv.type === 'GROUP' ? activeConv.title : activeConv.other_user_name}
                </h3>
                <p className="text-xs text-slate-500">{activeConv.type === 'GROUP' ? 'Chat de Departamento' : 'Chat Directo'}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Escribe el primer mensaje para comenzar la conversación.</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine = msg.user_id === currentUserId;
                const showHeader = idx === 0 || messages[idx - 1].user_id !== msg.user_id;

                return <MessageBubble key={msg.id} msg={msg} isMine={isMine} showHeader={showHeader} />;
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSendMessage={onSendMessage} onFileUpload={onFileUpload} />
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Mensajería Interna</h2>
          <p className="max-w-sm text-sm">Selecciona una conversación del panel lateral para continuar chateando o inicia un nuevo chat directo.</p>
        </div>
      )}
    </div>
  );
};