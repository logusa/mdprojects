"use client";

import React, { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, Search, Loader2, Pencil, Trash2, CheckCircle, Clock, X, ChevronRight, Briefcase } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Quote } from '../types/erp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const Quotes = () => {
  usePageTitle('Cotizaciones');
  const { session } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchQuotes();
  }, [session]);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .order('created_at', { ascending: false });
    
    if (error) showError('Error al cargar cotizaciones');
    else if (data) setQuotes(data as any);
    setLoading(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'SENT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
      case 'CONVERTED': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredQuotes = quotes.filter(q => 
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.clients?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" /> Cotizaciones
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Genera y gestiona presupuestos para tus clientes.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95">
          <Plus className="w-5 h-5" /> Nueva Cotización
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar por título o cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron cotizaciones</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotes.map(quote => (
            <div key={quote.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start">
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border uppercase", getStatusStyle(quote.status))}>
                  {quote.status}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  v{quote.version}
                </span>
              </div>
              
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1">{quote.title}</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Briefcase className="w-3.5 h-3.5" /> {quote.clients?.name || 'Sin cliente'}
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    ${quote.total_amount.toLocaleString()}
                  </span>
                </div>
                <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Quotes;