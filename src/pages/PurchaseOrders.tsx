"use client";

import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Search, Loader2, Pencil, Trash2, CheckCircle2, Clock, X, ChevronRight, Truck, PlusCircle, Save, ArrowLeft, Printer, Send, Hash, Building, FolderKanban } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { PurchaseOrder, PurchaseOrderItem } from '../types/erp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ACCENT_COLOR = '#4f46e5';

const PurchaseOrders = () => {
  const { settings } = useWhiteLabel();
  usePageTitle('Notas de Compra');
  const { session } = useAuth();
  
  const [view, setView] = useState<'LIST' | 'FORM' | 'PREVIEW'>('LIST');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [providers, setProviders] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    provider_id: '',
    project_id: '',
    status: 'DRAFT' as PurchaseOrder['status']
  });

  useEffect(() => {
    fetchOrders();
    fetchInitialData();
  }, [session]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, providers(name, email, phone, company), projects(name)')
      .order('created_at', { ascending: false });
    
    if (error) showError('Error al cargar órdenes');
    else if (data) setOrders(data as any);
    setLoading(false);
  };

  const fetchInitialData = async () => {
    const [provRes, projRes] = await Promise.all([
      supabase.from('providers').select('id, name').order('name'),
      supabase.from('projects').select('id, name').order('name')
    ]);
    if (provRes.data) setProviders(provRes.data);
    if (projRes.data) setProjects(projRes.data);
  };

  const handleCreate = () => {
    setSelectedOrder(null);
    setOrderItems([{ description: '', quantity: 1, unit: 'PZA', unit_price: 0, total_price: 0 }]);
    setFormData({ title: '', description: '', provider_id: '', project_id: '', status: 'DRAFT' });
    setView('FORM');
  };

  const handleEdit = async (order: PurchaseOrder) => {
    const toastId = showLoading('Cargando detalles...');
    const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', order.id);
    dismissToast(toastId);
    
    setSelectedOrder(order);
    setOrderItems(items || []);
    setFormData({
      title: order.title,
      description: order.description || '',
      provider_id: order.provider_id || '',
      project_id: order.project_id || '',
      status: order.status
    });
    setView('FORM');
  };

  const handlePreview = async (order: PurchaseOrder) => {
    const toastId = showLoading('Generando vista previa...');
    const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', order.id);
    dismissToast(toastId);
    
    setSelectedOrder(order);
    setOrderItems(items || []);
    setView('PREVIEW');
  };

  const addItem = () => {
    setOrderItems([...orderItems, { description: '', quantity: 1, unit: 'PZA', unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...orderItems];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      item.total_price = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    }
    
    newItems[index] = item;
    setOrderItems(newItems);
  };

  const calculateTotal = () => {
    return orderItems.reduce((acc, item) => acc + (item.total_price || 0), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !formData.title.trim()) return;
    
    const toastId = showLoading('Guardando nota de compra...');
    const totalAmount = calculateTotal();

    try {
      let orderId = selectedOrder?.id;

      if (selectedOrder) {
        const { error } = await supabase.from('purchase_orders').update({
          title: formData.title,
          description: formData.description,
          provider_id: formData.provider_id || null,
          project_id: formData.project_id || null,
          status: formData.status,
          total_amount: totalAmount
        }).eq('id', orderId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('purchase_orders').insert({
          title: formData.title,
          description: formData.description,
          provider_id: formData.provider_id || null,
          project_id: formData.project_id || null,
          status: 'DRAFT',
          total_amount: totalAmount,
          user_id: session.user.id
        }).select().single();
        if (error) throw error;
        orderId = data.id;
      }

      await supabase.from('purchase_order_items').delete().eq('po_id', orderId);
      const itemsToInsert = orderItems.map(item => ({
        po_id: orderId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));
      await supabase.from('purchase_order_items').insert(itemsToInsert);

      showSuccess('Orden guardada');
      setView('LIST');
      fetchOrders();
    } catch (err) {
      showError('Error al guardar');
    } finally {
      dismissToast(toastId);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta orden permanentemente?')) return;
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (error) showError('No se pudo eliminar');
    else {
      showSuccess('Orden eliminada');
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RECEIVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'SENT': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (view === 'LIST') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: ACCENT_COLOR }} /> Notas de Compra
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona solicitudes y órdenes para tus proveedores.</p>
          </div>
          <button onClick={handleCreate} className="flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-xl transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95" style={{ backgroundColor: ACCENT_COLOR }}>
            <Plus className="w-5 h-5" /> Nueva Nota
          </button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por título, proveedor o proyecto..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin" style={{ color: ACCENT_COLOR }} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.filter(o => o.title.toLowerCase().includes(searchTerm.toLowerCase()) || o.providers?.name.toLowerCase().includes(searchTerm.toLowerCase())).map(order => (
              <div key={order.id} onClick={() => handlePreview(order)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 hover:shadow-md transition-all group cursor-pointer border-l-4" style={{ borderLeftColor: ACCENT_COLOR }}>
                <div className="flex justify-between items-start">
                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border uppercase", getStatusStyle(order.status))}>
                    {order.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(order); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-indigo-600 transition-colors">{order.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Truck className="w-3.5 h-3.5" /> {order.providers?.name || 'Proveedor Particular'}
                  </div>
                  {order.projects && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mt-1">
                      <FolderKanban className="w-3 h-3" /> {order.projects.name}
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total estimado</span>
                    <span className="text-lg font-bold" style={{ color: ACCENT_COLOR }}>
                      ${order.total_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                    {format(new Date(order.created_at), 'dd MMM')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'FORM') {
    return (
      <div className="max-w-5xl mx-auto animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">{selectedOrder ? 'Editar Nota de Compra' : 'Nueva Nota de Compra'}</h2>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-bold shadow-md" style={{ backgroundColor: ACCENT_COLOR }}>
            <Save className="w-5 h-5" /> Guardar Orden
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Título / Asunto</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej. Pedido de Cemento - Fase 2" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Proveedor</label>
                <select value={formData.provider_id} onChange={e => setFormData({...formData, provider_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none" required>
                  <option value="">Seleccionar proveedor</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vincular a Proyecto</label>
                <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                  <option value="">Sin proyecto (Gasto general)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedOrder && (
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado del Pedido</label>
                    <div className="flex flex-wrap gap-2">
                    {['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'].map(st => (
                        <button key={st} type="button" onClick={() => setFormData({...formData, status: st as any})} className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all", formData.status === st ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200")}>
                        {st}
                        </button>
                    ))}
                    </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-500" /> Ítems y Cantidades
              </h3>
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border" style={{ color: ACCENT_COLOR, borderColor: ACCENT_COLOR }}>
                <PlusCircle className="w-4 h-4" /> Añadir Producto
              </button>
            </div>

            <div className="space-y-4">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="col-span-6">Descripción del Producto / Servicio</div>
                <div className="col-span-1">Cant.</div>
                <div className="col-span-1">UND</div>
                <div className="col-span-2">P. Unitario</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-1"></div>
              </div>

              {orderItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 items-start group animate-in fade-in zoom-in-95">
                  <div className="col-span-6 space-y-1">
                    <label className="md:hidden text-[10px] font-bold text-slate-400">Descripción</label>
                    <input type="text" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Ej. Mortero Tolteca 50kg" className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="md:hidden text-[10px] font-bold text-slate-400">Cant.</label>
                    <input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="md:hidden text-[10px] font-bold text-slate-400">UND</label>
                    <input type="text" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)} placeholder="PZA" className="w-full bg-white border border-slate-200 px-2 py-2 rounded-lg text-xs text-center uppercase" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="md:hidden text-[10px] font-bold text-slate-400">P. Unitario</label>
                    <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', e.target.value)} className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="md:hidden text-[10px] font-bold text-slate-400">Total</label>
                    <div className="w-full bg-slate-100 px-3 py-2 rounded-lg text-sm font-bold text-slate-700">
                      ${item.total_price.toLocaleString()}
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center pt-1 md:pt-0">
                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-end">
              <div className="w-full md:w-64 space-y-3">
                <div className="flex justify-between items-center text-slate-900 text-2xl font-black pt-2">
                  <span>Total Neto</span>
                  <span style={{ color: ACCENT_COLOR }}>${calculateTotal().toLocaleString()}</span>
                </div>
                <p className="text-[9px] text-slate-400 italic text-right">* Precios base sugeridos o pactados.</p>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'PREVIEW' && selectedOrder) {
    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('LIST')} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Vista de Documento</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">
              <Printer className="w-4 h-4" /> Imprimir PDF
            </button>
            <button className="flex items-center gap-2 px-5 py-2 text-white rounded-xl font-bold text-sm bg-blue-600" onClick={() => showSuccess('Simulando envío por correo...')}>
              <Send className="w-4 h-4" /> Enviar a Proveedor
            </button>
          </div>
        </div>

        <div className="bg-white p-8 sm:p-16 rounded-[2rem] border border-slate-200 shadow-2xl min-h-[1000px] flex flex-col print:shadow-none print:border-none print:p-0">
          <header className="flex justify-between items-start mb-12">
            <div className="space-y-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-14 object-contain" />
              ) : (
                <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                  {settings.app_name.charAt(0)}
                </div>
              )}
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                {settings.app_name} • NOTA DE COMPRA
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">ORDEN DE COMPRA</h1>
              <p className="text-slate-400 font-bold text-xs">REF: #{selectedOrder.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-12 mb-16">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Proveedor Destinatario</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{selectedOrder.providers?.name}</p>
              <div className="text-xs text-slate-500 font-medium">
                <p>{selectedOrder.providers?.company}</p>
                <p>{selectedOrder.providers?.email}</p>
                <p>{selectedOrder.providers?.phone}</p>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Proyecto / Destino</p>
              <p className="text-xl font-bold text-slate-900">{selectedOrder.projects?.name || 'Gasto General'}</p>
              <p className="text-sm font-bold text-slate-400 mt-2">{format(new Date(selectedOrder.created_at), 'dd MMMM, yyyy', { locale: es })}</p>
            </div>
          </div>

          <div className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h2 className="text-sm font-black text-slate-900 mb-1 uppercase">ASUNTO: {selectedOrder.title}</h2>
            {selectedOrder.description && <p className="text-xs text-slate-500 leading-relaxed">{selectedOrder.description}</p>}
          </div>

          <div className="flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest w-16">Item</th>
                  <th className="py-3 text-[10px] font-black text-slate-900 uppercase tracking-widest">Producto / Descripción</th>
                  <th className="py-3 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest">Cantidad</th>
                  <th className="py-3 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest">Unitario</th>
                  <th className="py-3 text-right text-[10px] font-black text-slate-900 uppercase tracking-widest">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-4 text-xs font-black text-slate-300">{(i+1).toString().padStart(2, '0')}</td>
                    <td className="py-4 pr-4">
                      <p className="font-bold text-slate-800 text-sm leading-tight">{item.description}</p>
                    </td>
                    <td className="py-4 text-center text-xs font-bold text-slate-600">{item.quantity} <span className="text-[10px] text-slate-400 ml-0.5">{item.unit}</span></td>
                    <td className="py-4 text-right text-xs font-medium text-slate-500">${item.unit_price.toLocaleString()}</td>
                    <td className="py-4 text-right text-xs font-bold text-slate-900">${item.total_price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-end">
            <div className="max-w-xs space-y-6">
              <div className="space-y-4">
                <div className="w-32 border-b border-slate-400 h-10"></div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma de Autorización</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de la Orden</p>
              <p className="text-5xl font-black tracking-tighter" style={{ color: ACCENT_COLOR }}>
                ${selectedOrder.total_amount.toLocaleString()}
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return null;
};

export default PurchaseOrders;