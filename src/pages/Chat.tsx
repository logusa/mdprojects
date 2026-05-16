import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { Loader2, Send, MessageSquare, Plus, Users, User, Paperclip, FileText, Download, X, Search, ChevronLeft } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { getBrowserLocale } from '@/utils/locale';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

interface Conversation {
  id: string;
  title: string | null;
  type: 'DIRECT' | 'GROUP';
  department_id: string | null;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  unread: boolean;
  other_user_id: string | null;
  other_user_name: string | null;
  other_user_avatar: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  profiles?: { first_name: string; last_name: string; avatar_url: string };
}

// Subcomponente para renderizar adjuntos con Signed URLs
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

const Chat = () => {
  usePageTitle('Mensajes');
  const { session } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  
  // Compositor
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modal Nuevo Chat
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    if (session) {
      fetchConversations();
      
      // Suscripción en tiempo real a mensajes
      const channel = supabase.channel('chat_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as Message;
          handleIncomingMessage(newMsg);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const handleIncomingMessage = async (newMsg: Message) => {
    // Si el mensaje es para la conversación activa, lo añadimos y marcamos como leído
    setActiveConv((currentActive) => {
      if (currentActive && currentActive.id === newMsg.conversation_id) {
        // Cargar detalles del remitente antes de insertar
        supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', newMsg.user_id).single()
          .then(({ data }) => {
            if (data) {
              setMessages(prev => [...prev, { ...newMsg, profiles: data }]);
              scrollToBottom();
              updateLastRead(newMsg.conversation_id);
            }
          });
      }
      return currentActive;
    });

    // Refrescar lista de chats para actualizar el último mensaje y badges
    fetchConversations();
  };

  const fetchConversations = async () => {
    if (!session) return;
    const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: session.user.id });
    if (!error && data) {
      setConversations(data);
      setLoadingChats(false);
    }
  };

  const updateLastRead = async (convId: string) => {
    if (!session) return;
    await supabase.from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId).eq('user_id', session.user.id);
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]); // Limpiar previo
    
    // Marcar como leído visualmente al instante
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c));
    await updateLastRead(conv.id);

    // Cargar historial
    const { data } = await supabase.from('messages')
      .select('*, profiles(first_name, last_name, avatar_url)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || !session) return;

    const content = newMessage;
    setNewMessage(''); // Optimistic clear

    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      user_id: session.user.id,
      content: content
    });

    if (error) {
      showError('No se pudo enviar el mensaje');
      setNewMessage(content); // Revertir
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv || !session) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `chat/${activeConv.id}/${Date.now()}.${fileExt}`;

    try {
      // Subir archivo al bucket existente
      const { error: uploadError } = await supabase.storage.from('workspace_files').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Crear el mensaje con adjunto
      const { error: dbError } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        user_id: session.user.id,
        content: null,
        file_url: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      });
      if (dbError) throw dbError;

    } catch (error) {
      showError('Error al enviar archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startNewChat = async () => {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').neq('id', session?.user.id);
    if (data) setAllUsers(data);
    setIsNewChatModalOpen(true);
  };

  const createDirectMessage = async (userId: string) => {
    setIsNewChatModalOpen(false);
    const { data: convId, error } = await supabase.rpc('get_or_create_dm', { p_other_user_id: userId });
    
    if (error) {
      showError('Error al crear el chat');
    } else if (convId) {
      await fetchConversations();
      // Encontrar y seleccionar el chat recién creado en la lista
      const { data: convs } = await supabase.rpc('get_user_conversations', { p_user_id: session?.user.id });
      if (convs) {
        setConversations(convs);
        const newChat = convs.find((c: any) => c.id === convId);
        if (newChat) selectConversation(newChat);
      }
    }
  };

  // Helper de tiempo
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return isToday(date) ? format(date, 'HH:mm') : format(date, 'd MMM', { locale: getBrowserLocale() });
  };

  const filteredUsers = allUsers.filter(u => 
    `${u.first_name} ${u.last_name || ''}`.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="flex w-full h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] animate-in fade-in duration-300 gap-0 md:gap-6 relative">
      
      {/* Panel Izquierdo: Lista de Chats */}
      <div className={cn(
        "w-full md:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 md:rounded-2xl shadow-sm shrink-0 overflow-hidden",
        activeConv ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" /> Mensajes
          </h2>
          <button 
            onClick={startNewChat}
            className="p-1.5 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900 rounded-md transition-colors"
            title="Nuevo Chat Directo"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingChats ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm">Aún no tienes mensajes.</p>
              <button onClick={startNewChat} className="text-indigo-500 hover:underline mt-2 text-sm font-medium">Inicia una conversación</button>
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
                  onClick={() => selectConversation(conv)}
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

      {/* Panel Derecho: Área de Chat */}
      <div className={cn(
        "flex-1 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 md:rounded-2xl shadow-sm overflow-hidden h-full absolute md:relative inset-0 md:inset-auto z-10 md:z-0",
        activeConv ? "flex" : "hidden md:flex"
      )}>
        {activeConv ? (
          <>
            {/* Header Chat */}
            <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 shrink-0">
              <button onClick={() => setActiveConv(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
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

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Escribe el primer mensaje para comenzar la conversación.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.user_id === session?.user.id;
                  const showHeader = idx === 0 || messages[idx - 1].user_id !== msg.user_id;

                  return (
                    <div key={msg.id} className={cn("flex flex-col max-w-[85%] sm:max-w-[75%]", isMine ? "self-end items-end" : "self-start items-start")}>
                      {showHeader && !isMine && (
                        <div className="flex items-center gap-2 mb-1 ml-1">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{msg.profiles?.first_name} {msg.profiles?.last_name}</span>
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
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Área */}
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <form onSubmit={sendMessage} className="flex items-end gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
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

      {/* Modal Nuevo Chat */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Nuevo Mensaje Directo</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
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
                    onClick={() => createDirectMessage(user.id)}
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
      )}

    </div>
  );
};

export default Chat;