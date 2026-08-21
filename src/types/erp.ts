export interface QuoteItem {
  id?: string;
  code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Quote {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  total_amount: number;
  client_id: string | null;
  user_id: string;
  version: number;
  created_at: string;
  clients?: { name: string };
}

export interface ConstructionLog {
  id: string;
  project_id: string;
  log_date: string;
  content: string | null;
  weather: string | null;
  incidents: string | null;
  created_at: string;
  projects?: { name: string };
  log_photos?: { id: string; photo_url: string }[];
}