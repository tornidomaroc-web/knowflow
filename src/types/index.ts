export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  language: 'ar' | 'en' | 'both';
  created_at: string;
}

export interface Document {
  id: string;
  kb_id: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'mp3' | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  markdown_content: string | null;
  chunk_count: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  kb_id: string;
  user_id: string;
  platform: 'web' | 'telegram' | 'slack';
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
