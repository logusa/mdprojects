"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, 
  Loader2, Calendar, Tag, FileText, PieChart, 
  ArrowUpCircle, ArrowDownCircle, Wallet, PlusCircle, Hash, X
} from 'lucide-react';
import { format } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  amount: number;
  date: string;
  phase_id?: string | null;
}

interface ItemRow {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ProjectFinancesProps {
  projectId: string;
  phases: { id: string, name: string }[];
}

export const ProjectFinances = ({ projectId, phases }: ProjectFinancesProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado del encabezado del movimiento
  const [headerData, setHeaderData] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    category: 'Materiales',
    date: format(new Date(), 'yyyy-MM-dd'),
    phase_id: ''
  });

  // Estado de las partidas
  const [items, setItems] = useState<ItemRow[]>([
    { description: '', quantity: 1, unitPrice: 0 }
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [projectId]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (data) setTransactions(data as any);
    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.description.trim() || i.unitPrice <= 0)) {
      return showError('Por favor, completa todas las partidas con descripción y precio.');
    }
    
    setIsSubmitting(true);

    try {
      // Obtenemos el usuario actual antes del mapeo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No se encontró sesión de usuario');

      // Preparamos el array de inserción masiva
      const transactionRows = items.map(item => ({
        project_id: projectId,
        type: headerData.type,
        category: headerData.category,
        description: item.quantity > 1 ? `${item.description} (x${item.quantity})` : item.description,
        amount: item.quantity * item.unitPrice,
        date: headerData.date,
        phase_id: headerData.phase_id || null,
        user_id: user.id
      }));

      const { error } = await supabase.from('project_transactions').insert(transactionRows);

      if (error) throw error;
      
      showSuccess(`${items.length} partidas registradas correctamente`);
      setIsModalOpen(false);
      setItems([{ description: '', quantity: 1, unitPrice: 0 }]);
      fetchTransactions();
    } catch (err) {
      showError('No se pudo registrar el movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro financiero?')) return;
    const { error } = await supabase.from('project_transactions').delete().eq('id', id);
    if (!error) {
      setTransactions(transactions.filter(t => t.id !== id));
      showSuccess('Registro eliminado');
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

  const categories = headerData.type === 'EXPENSE' 
    ? ['Materiales', 'Mano de Obra', 'Maquinaria', 'Combustible', 'Permisos', 'Logística', 'Otros']
    : ['Pago Cliente', 'Adelanto', 'Extraordinario', 'Otros'];

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
      {/* Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Cobrado" value={totalIncome} icon={<TrendingUp className="text-emerald-500" />} color="emerald" />
        <SummaryCard title="Invertido" value={totalExpense} icon={<TrendingDown className="text-orange-500" />} color="orange" />
        <SummaryCard title="Utilidad Bruta" value={profit} icon={<Wallet className="text-indigo-500" />} color="indigo" />
        <SummaryCard title="Margen Bruto" value={`${margin.toFixed(1)}%`} icon={<PieChart className="text-blue-500" />} color="blue" isCurrency={false} />
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Historial de Movimientos</h3>
          <p className="text-xs text-slate-500">Listado detallado de todas las partidas registradas.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Registrar Movimiento
        </button>
      </div>

      {/* Lista de Transacciones */}
      <div className="space-y-3">
        {transactions.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                t.type === 'INCOME' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-orange-50 text-orange-600 dark:bg-orange-900/20"
              )}>
                {t.type === 'INCOME' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{t.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium uppercase tracking-tight mt-0.5">
                  <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {t.category}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(t.date), 'dd MMM, yyyy')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={cn("font-black text-base", t.type === 'INCOME' ? "text-emerald-600" : "text-slate-800 dark:text-white")}>
                  {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString()}
                </p>
                {t.phase_id && (
                  <p className="text-[10px] text-indigo-500 font-bold uppercase truncate max-w-[100px]">
                    {phases.find(p => p.id === t.phase_id)?.name}
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="py-20 text-center bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
            <DollarSign className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No hay registros financieros aún</p>
          </div>
        )}
      </div>

      {/* Modal Nueva Transacción Multi-Partida */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">Registrar Movimientos (Multi-Partida)</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Cabecera del Movimiento */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Flujo</label>
                    <div className="flex p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <button type="button" onClick={() => setHeaderData({...headerData, type: 'EXPENSE'})} className={cn("flex-1 py-1.5 rounded text-[10px] font-bold transition-all", headerData.type === 'EXPENSE' ? "bg-orange-600 text-white" : "text-slate-500")}>EGRESO</button>
                      <button type="button" onClick={() => setHeaderData({...headerData, type: 'INCOME'})} className={cn("flex-1 py-1.5 rounded text-[10px] font-bold transition-all", headerData.type === 'INCOME' ? "bg-emerald-600 text-white" : "text-slate-500")}>INGRESO</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoría</label>
                    <select value={headerData.category} onChange={e => setHeaderData({...headerData, category: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
                    <input type="date" value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" required />
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asociar a Fase (Bitácora)</label>
                    <select value={headerData.phase_id} onChange={e => setHeaderData({...headerData, phase_id: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <option value="">-- Sin asociación específica --</option>
                      {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Listado de Partidas */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Hash className="w-3 h-3" /> Conceptos del Movimiento
                    </h4>
                    <button type="button" onClick={addItem} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                      <PlusCircle className="w-3.5 h-3.5" /> Añadir Partida
                    </button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-3 items-end p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm animate-in fade-in zoom-in-95">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Concepto / Descripción</label>
                          <input type="text" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Ej. Bulto cemento gris..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" required />
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Cant.</label>
                          <input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-lg text-xs outline-none" required />
                        </div>
                        <div className="w-32 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">P. Unitario ($)</label>
                          <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-lg text-xs outline-none" required />
                        </div>
                        <div className="w-32 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Total</label>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                            ${(item.quantity * item.unitPrice).toLocaleString()}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-slate-300 hover:text-red-500 transition-colors mb-0.5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Monto Total del Movimiento</p>
                  <p className={cn("text-3xl font-black", headerData.type === 'INCOME' ? "text-emerald-600" : "text-indigo-600")}>
                    ${calculateTotal().toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 md:flex-none px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={isSubmitting || calculateTotal() <= 0} className={cn(
                    "flex-1 md:flex-none px-10 py-3 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2",
                    headerData.type === 'INCOME' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                  )}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Confirmar y Registrar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, icon, color, isCurrency = true }: { title: string, value: number | string, icon: React.ReactNode, color: string, isCurrency?: boolean }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm flex flex-col gap-1">
    <div className="flex items-center justify-between mb-2">
      <div className={cn("p-2 rounded-xl", `bg-${color}-50 dark:bg-${color}-900/20`)}>{icon}</div>
      <span className={cn("text-[10px] font-black uppercase tracking-widest", `text-${color}-500`)}>{title}</span>
    </div>
    <p className="text-2xl font-black text-slate-800 dark:text-white truncate">
      {isCurrency && typeof value === 'number' ? `$${value.toLocaleString()}` : value}
    </p>
  </div>
);