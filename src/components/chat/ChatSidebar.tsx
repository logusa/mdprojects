"use client";

import React from 'react';
import { MessageSquare, Plus, Users, Loader2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { getBrowserLocale } from '../../utils/locale';
import { cn } from '../../lib/utils';
import { Conversation } from '../../types/chat';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConv: Conversation | null;
  loading: boolean;
  onSelectConversation: (conv: Conversation) => void;
  onNewChat: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  conversations, 
  activeConv, 
  loading, 
  onSelectConversation, 
  onNewChat 
}) => {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return isToday(date) ? format(date, 'HH:mm') : format(date, 'd MMM', { locale: getBrowserLocale() });
  };

  return (
    <div className={cn(
      "w-full md:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 md:rounded-2xl shadow-sm shrink-0 overflow-hidden",
      activeConv ? "hidden md:flex" : "flex"
    )}>
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" /> Mensajes
        </h2>
        <button 
          onClick={onNewChat}
          className="p-1.5 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900 rounded-md transition-colors"
          title="Nuevo Chat Directo"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm">Aún no tienes mensajes.</p>
            <button onClick={onNewChat} className="text-indigo-500 hover:underline mt-2 text-sm font-medium">Inicia una conversación</button>
          </div>
        ) : (
          conversations.map(conv => {
            const isGroup = conv.type === 'GROUP';
            const name = isGroup ? conv.title : conv.other_user_name;
            const avatar = !isGroup ? conv.other_user_avatar : null;
            const isActive = activeConv?.id === conv.id;

            return (
              <div 
                key={conv.id} 
                onClick={() => onSelectConversation(conv)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border",
                  isActive ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50" : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                      <Users className="w-6 h-6" />
                    </div>
                  ) : avatar ? (
                    <img src={avatar} alt="Avatar" className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 font-bold">
                      {name?.[0] || 'U'}
                    </div>
                  )}
                  {conv.unread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={cn("text-sm font-bold truncate pr-2", isActive ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-slate-200")}>{name}</h3>
                    {conv.last_message_time && (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">{formatTime(conv.last_message_time)}</span>
                    )}
                  </div>
                  <p className={cn("text-xs truncate", conv.unread ? "font-bold text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                    {conv.last_message || (conv.last_message_time ? 'Archivo adjunto' : 'Sin mensajes')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};