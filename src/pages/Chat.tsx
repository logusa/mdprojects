"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showError } from '../utils/toast';
import { Conversation, Message } from '../types/chat';

import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { NewChatModal } from '../components/chat/NewChatModal';

const Chat = () => {
  usePageTitle('Mensajes');
  const { session } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      fetchConversations();
      
      const channel = supabase.channel('chat_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          handleIncomingMessage(payload.new as Message);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const handleIncomingMessage = async (newMsg: Message) => {
    setActiveConv((currentActive) => {
      if (currentActive && currentActive.id === newMsg.conversation_id) {
        supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', newMsg.user_id).single()
          .then(({ data }) => {
            if (data) {
              setMessages(prev => [...prev, { ...newMsg, profiles: data }]);
              updateLastRead(newMsg.conversation_id);
            }
          });
      }
      return currentActive;
    });
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
    setMessages([]); 
    
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c));
    await updateLastRead(conv.id);

    const { data } = await supabase.from('messages')
      .select('*, profiles(first_name, last_name, avatar_url)')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data);
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeConv || !session) return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      user_id: session.user.id,
      content: content
    });
    if (error) {
      showError('No se pudo enviar el mensaje');
      throw error;
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeConv || !session) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `chat/${activeConv.id}/${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from('workspace_files').upload(filePath, file);
      if (uploadError) throw uploadError;

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
      throw error;
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
      const { data: convs } = await supabase.rpc('get_user_conversations', { p_user_id: session?.user.id });
      if (convs) {
        setConversations(convs);
        const newChat = convs.find((c: any) => c.id === convId);
        if (newChat) selectConversation(newChat);
      }
    }
  };

  return (
    <div className="flex w-full h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] animate-in fade-in duration-300 gap-0 md:gap-6 relative">
      <ChatSidebar 
        conversations={conversations} 
        activeConv={activeConv} 
        loading={loadingChats} 
        onSelectConversation={selectConversation} 
        onNewChat={startNewChat} 
      />
      
      <ChatArea 
        activeConv={activeConv} 
        messages={messages} 
        currentUserId={session?.user?.id} 
        onClose={() => setActiveConv(null)} 
        onSendMessage={sendMessage} 
        onFileUpload={handleFileUpload} 
      />

      <NewChatModal 
        isOpen={isNewChatModalOpen} 
        onClose={() => setIsNewChatModalOpen(false)} 
        allUsers={allUsers} 
        onCreateDirectMessage={createDirectMessage} 
      />
    </div>
  );
};

export default Chat;