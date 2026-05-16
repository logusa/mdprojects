export interface Conversation {
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

export interface Message {
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