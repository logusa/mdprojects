"use client";

import React, { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet, Search, Loader2, Pencil, Trash2, CheckCircle, Clock, X, ChevronRight, Briefcase, PlusCircle, Save, ArrowLeft, Printer, Send, Hash, MoreVertical } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Quote, QuoteItem } from '../types/erp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACCENT_COLOR = '#1b7cc0';

const Quotes = () => {
  const { settings } = useWhiteLabel();
  usePageTitle('Cotizaciones');
  const { session } = useAuth();
  
  // States
  const [view, setView] = useState<'LIST' | 'FORM' | 'PREVIEW'>('LIST');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    status: 'DRAFT' as Quote['status']
  });

  useEffect(() => {
    fetchQuotes();
    fetchClients();
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

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    if (data) setClients(data);
  };

  const handleCreate = () => {
    setSelectedQuote(null);
    setQuoteItems([{ description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
    setFormData({ title: '', description: '', client_id: '', status: 'DRAFT' });
    setView('FORM');
  };

  const handleEdit = async (quote: Quote) => {
    const toastId = showLoading('Cargando detalles...');
    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id);
    dismissToast(toastId);
    
    setSelectedQuote(quote);
    setQuoteItems(items || []);
    setFormData({
      title: quote.title,
      description: quote.description || '',
      client_id: quote.client_id || '',
      status: quote.status
    });
    setView('FORM');
  };

  const handlePreview = async (quote: Quote) => {
    const toastId = showLoading('Generando vista previa...');
    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id);
    dismissToast(toastId);
    
    setSelectedQuote(quote);
    setQuoteItems(items || []);
    setView('PREVIEW');
  };

  const addItem = () => {
    setQuoteItems([...quoteItems, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (quoteItems.length === 1) return;
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...quoteItems];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      item.total_price = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    }
    
    newItems[index] = item;
    setQuoteItems(newItems);
  };

  const calculateTotal = () => {
    return quoteItems.reduce((acc, item) => acc + (item.total_price || 0), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !formData.title.trim()) return;
    
    const toastId = showLoading('Guardando cotización...');
    const totalAmount = calculateTotal();

    try {
      let quoteId = selectedQuote?.id;

      if (selectedQuote) {
        // Update
        const { error } = await supabase.from('quotes').update({
          title: formData.title,
          description: formData.description,
          client_id: formData.client_id || null,
          status: formData.status,
          total_amount: totalAmount,
          version: selectedQuote.version + 1
        }).eq('id', quoteId);
        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await supabase.from('quotes').insert({
          title: formData.title,
          description: formData.description,
          client_id: formData.client_id || null,
          status: 'DRAFT',
          total_amount: totalAmount,
          user_id: session.user.id
        }).select().single();
        if (error) throw error;
        quoteId = data.id;
      }

      // Sync items
      await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      const itemsToInsert = quoteItems.map(item => ({
        quote_id: quoteId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));
      await supabase.from('quote_items').insert(itemsToInsert);

      showSuccess('Cotización guardada');
      setView('LIST');
      fetchQuotes();
    } catch (err) {
      showError('Error al guardar');
    } finally {
      dismissToast(toastId);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta cotización permanentemente?')) return;
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) showError('No se pudo eliminar');
    else {
      showSuccess('Cotización eliminada');
      setQuotes(quotes.filter(q => q.id !== id));
    }
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

  // --- RENDERING LIST ---
  if (view === 'LIST') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: ACCENT_COLOR }} /> Cotizaciones
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1">Genera y gestiona presupuestos para tus clientes.</p>
          </div>
          <button onClick={handleCreate} className="flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-xl transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95" style={{ backgroundColor: ACCENT_COLOR }}>
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
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin" style={{ color: ACCENT_COLOR }} /></div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No se encontraron cotizaciones</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuotes.map(quote => (
              <div key={quote.id} onClick={() => handlePreview(quote)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 hover:shadow-md transition-all group cursor-pointer border-l-4" style={{ borderLeftColor: ACCENT_COLOR }}>
                <div className="flex justify-between items-start">
                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border uppercase", getStatusStyle(quote.status))}>
                    {quote.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(quote); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(quote.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-indigo-600 transition-colors">{quote.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Briefcase className="w-3.5 h-3.5" /> {quote.clients?.name || 'Sin cliente'}
                  </div>
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <span className="text-lg font-bold" style={{ color: ACCENT_COLOR }}>
                      ${quote.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                    Versión {quote.version}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- RENDERING FORM ---
  if (view === 'FORM') {
    return (
      <div className="max-w-4xl mx-auto animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">{selectedQuote ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-bold shadow-md" style={{ backgroundColor: ACCENT_COLOR }}>
            <Save className="w-5 h-5" /> Guardar
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Título de la Cotización</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej. Presupuesto Obra Civil - Casa Sol" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cliente</label>
                <select value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Descripción General</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm" placeholder="Detalles adicionales o notas..." />
            </div>

            {selectedQuote && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {['DRAFT', 'SENT', 'APPROVED', 'REJECTED'].map(st => (
                    <button key={st} type="button" onClick={() => setFormData({...formData, status: st as any})} className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-all", formData.status === st ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200")}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" /> Conceptos y Precios
              </h3>
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border" style={{ color: ACCENT_COLOR, borderColor: ACCENT_COLOR }}>
                <PlusCircle className="w-4 h-4" /> Añadir Concepto
              </button>
            </div>

            <div className="space-y-4">
              {quoteItems.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 items-end group animate-in fade-in zoom-in-95">
                  <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción</label>
                    <input type="text" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Ej. Mano de obra m2..." className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cant.</label>
                    <input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">P. Unitario</label>
                    <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Total</label>
                    <div className="w-full bg-slate-100 px-3 py-2 rounded-lg text-sm font-bold text-slate-700">
                      ${item.total_price.toLocaleString()}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors mb-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between items-center text-slate-500 text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">${calculateTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 text-xl font-bold pt-2">
                  <span>Total</span>
                  <span style={{ color: ACCENT_COLOR }}>${calculateTotal().toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // --- RENDERING PREVIEW (MINIMALIST DOCUMENT) ---
  if (view === 'PREVIEW' && selectedQuote) {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Vista Previa</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={() => handleEdit(selectedQuote)} className="flex items-center gap-2 px-5 py-2 text-white rounded-xl font-bold text-sm" style={{ backgroundColor: ACCENT_COLOR }}>
              <Pencil className="w-4 h-4" /> Editar
            </button>
          </div>
        </div>

        {/* DOCUMENT DESIGN */}
        <div className="bg-white p-12 sm:p-20 rounded-[2rem] border border-slate-200 shadow-2xl min-h-[1000px] flex flex-col print:shadow-none print:border-none print:p-0">
          <header className="flex justify-between items-start mb-16">
            <div className="space-y-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-16 object-contain" />
              ) : (
                <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                  {settings.app_name.charAt(0)}
                </div>
              )}
              <div className="text-xs text-slate-400 font-medium uppercase tracking-widest">
                {settings.app_name} • {format(new Date(), 'yyyy')}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">COTIZACIÓN</h1>
              <p className="text-slate-400 font-bold text-sm">#{selectedQuote.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-12 mb-20">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Para</p>
              <div>
                <p className="text-xl font-bold text-slate-900">{selectedQuote.clients?.name || 'Cliente Particular'}</p>
                <p className="text-sm text-slate-500 mt-1">ID: {selectedQuote.client_id?.substring(0, 8)}</p>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Fecha de Emisión</p>
              <div>
                <p className="text-xl font-bold text-slate-900">{format(new Date(selectedQuote.created_at), 'dd MMMM, yyyy', { locale: es })}</p>
                <p className="text-sm text-slate-500 mt-1">Versión {selectedQuote.version}.0</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedQuote.title}</h2>
            <p className="text-slate-500 leading-relaxed text-sm max-w-2xl">{selectedQuote.description}</p>
          </div>

          <div className="flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Concepto</th>
                  <th className="py-4 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest">Cant.</th>
                  <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest">P. Unitario</th>
                  <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quoteItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-6 pr-4">
                      <p className="font-bold text-slate-800 text-sm">{item.description}</p>
                    </td>
                    <td className="py-6 text-center text-sm font-medium text-slate-500">{item.quantity}</td>
                    <td className="py-6 text-right text-sm font-medium text-slate-500">${item.unit_price.toLocaleString()}</td>
                    <td className="py-6 text-right text-sm font-bold text-slate-900">${item.total_price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="mt-20 pt-12 border-t border-slate-100 flex justify-between items-end">
            <div className="max-w-xs space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas de Pago</p>
                <p className="text-[10px] text-slate-500 leading-tight">Este presupuesto tiene una validez de 15 días naturales. Precios sujetos a cambios sin previo aviso.</p>
              </div>
              <p className="text-[10px] text-slate-400 italic">Documento generado electrónicamente por {settings.app_name}.</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Presupuestado</p>
              <p className="text-6xl font-black tracking-tighter" style={{ color: ACCENT_COLOR }}>
                ${selectedQuote.total_amount.toLocaleString()}
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return null;
};

export default Quotes;