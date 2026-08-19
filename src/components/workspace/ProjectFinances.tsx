"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, 
  Loader2, Calendar, Tag, FileText, PieChart, 
  ArrowUpCircle, ArrowDownCircle, Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

interface ProjectFinancesProps {
  projectId: string;
  phases: { id: string, name: string }[];
}

export const ProjectFinances = ({ projectId, phases }: ProjectFinancesProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    category: 'Materiales',
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    phase_id: ''
  });

  useEffect(() => {
    fetchTransactions();
  }, [projectId]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false });
    
    if (data) setTransactions(data as any);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('project_transactions').insert({
        project_id: projectId,
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: formData.date,
        phase_id: formData.phase_id || null
      });

      if (error) throw error;
      
      showSuccess('Transacción registrada');
      setIsModalOpen(false);
      setFormData({ ...formData, description: '', amount: '', phase_id: '' });
      fetchTransactions();
    } catch (err) {
      showError('No se pudo registrar la transacción');
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

  const categories = formData.type === 'EXPENSE' 
    ? ['Materiales', 'Mano de Obra', 'Maquinaria', 'Combustible', 'Permisos', 'Logística', 'Otros']
    : ['Pago Cliente', 'Adelanto', 'Extraordinario', 'Otros'];

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
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
          <p className="text-xs text-slate-500">Registra cada gasto e ingreso para mantener la rentabilidad bajo control.</p>
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
                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{t.description || t.category}</p>
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

      {/* Modal Nueva Transacción */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">Registrar Movimiento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <FileText className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-4">
                <button type="button" onClick={() => setFormData({...formData, type: 'EXPENSE', category: 'Materiales'})} className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'EXPENSE' ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "text-slate-500")}>EGRESO (GASTO)</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'INCOME', category: 'Pago Cliente'})} className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", formData.type === 'INCOME' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-500")}>INGRESO (COBRO)</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm font-semibold">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto ($)</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm font-black" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción del Movimiento</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ej. Compra de 50 sacos de cemento..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vincular a Fase (Opcional)</label>
                  <select value={formData.phase_id} onChange={e => setFormData({...formData, phase_id: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm">
                    <option value="">Ninguna</option>
                    {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isSubmitting || !formData.amount || !formData.description} className={cn(
                  "w-full py-3 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2",
                  formData.type === 'INCOME' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                )}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSubmitting ? 'Registrando...' : 'Confirmar Registro'}
                </button>
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

const Save = ({ className }: { className?: string }) => <Plus className={className} />;