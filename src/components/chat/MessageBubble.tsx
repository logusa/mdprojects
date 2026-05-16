"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { Message } from '../../types/chat';

const MessageAttachment = ({ msg }: { msg: Message }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (msg.file_url) {
      supabase.storage.from('workspace_files').createSignedUrl(msg.file_url, 3600)
        .then(({ data }) => { if (data) setUrl(data.signedUrl); });
    }
  }, [msg.file_url]);

  if (!url) return <div className="h-16 w-24 bg-slate-200/50 dark:bg-slate-700/50 animate-pulse rounded-lg mt-2"></div>;

  if (msg.file_type?.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
        <img src={url} alt={msg.file_name || 'Imagen'} className="max-w-[200px] sm:max-w-xs rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:opacity-95 transition-opacity object-cover" />
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 mt-2 p-3 bg-white/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors group">
      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
        <FileText className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{msg.file_name}</p>
        <p className="text-xs text-slate-500 uppercase">{msg.file_type?.split('/')[1] || 'ARCHIVO'}</p>
      </div>
      <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
    </a>
  );
};

interface MessageBubbleProps {
  msg: Message;
  isMine: boolean;
  showHeader: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isMine, showHeader }) => {
  return (
    <div className={cn("flex flex-col max-w-[85%] sm:max-w-[75%]", isMine ? "self-end items-end" : "self-start items-start")}>
      {showHeader && !isMine && (
        <div className="flex items-center gap-2 mb-1 ml-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {msg.profiles?.first_name} {msg.profiles?.last_name}
          </span>
        </div>
      )}
      
      <div className={cn(
        "px-4 py-2.5 rounded-2xl shadow-sm relative group",
        isMine 
          ? "bg-indigo-600 text-white rounded-tr-sm" 
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm"
      )}>
        {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
        {msg.file_url && <MessageAttachment msg={msg} />}
        
        <span className={cn(
          "text-[10px] opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1",
          isMine ? "-left-10 text-slate-400" : "-right-10 text-slate-400"
        )}>
          {format(new Date(msg.created_at), 'HH:mm')}
        </span>
      </div>
    </div>
  );
};