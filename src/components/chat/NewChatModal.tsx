"use client";

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: any[];
  onCreateDirectMessage: (userId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ 
  isOpen, 
  onClose, 
  allUsers, 
  onCreateDirectMessage 
}) => {
  const [searchUser, setSearchUser] = useState('');

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter(u => 
    `${u.first_name} ${u.last_name || ''}`.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white">Nuevo Mensaje Directo</h3>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar compañero..." 
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto p-2 flex-1">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">No se encontraron usuarios.</p>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user.id} 
                onClick={() => {
                  setSearchUser('');
                  onCreateDirectMessage(user.id);
                }}
                className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {user.first_name?.[0] || 'U'}
                  </div>
                )}
                <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{user.first_name} {user.last_name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};