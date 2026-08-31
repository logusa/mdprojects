"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2, 
  Loader2, Calendar, Tag, FileText, PieChart, 
  ArrowUpCircle, ArrowDownCircle, Wallet, PlusCircle, Hash, X, Truck, Pencil, 
  Printer, BarChart3, ChevronDown, ChevronUp, AlertCircle, Layers
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
  provider_id?: string | null;
  unit?: string | null;
  quantity?: number;
  unit_price?: number;
}

interface ItemRow {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface ProjectFinancesProps {
  projectId: string;
  phases: { id: string, name: string }[];
}

export const ProjectFinances = ({ projectId, phases }: ProjectFinancesProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [providers, setProviders] = useState<{id: string, name: string}[]>([]);
  const [projectBudget, setProjectBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [headerData, setHeaderData] = useState({
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    category: 'Materiales',
    date: format(new Date(), 'yyyy-MM-dd'),
    phase_id: '',
    provider_id: ''
  });

  const [items, setItems] = useState<ItemRow[]>([
    { description: '', quantity: 1, unit: 'PZA', unitPrice: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    const [transRes, provRes, projRes] = await Promise.all([
      supabase.from('project_transactions').select('*').eq('project_id', projectId).order('date', { ascending: false }),
      supabase.from('providers').select('id, name').order('name'),
      supabase.from('projects').select('budget').eq('id', projectId).single()
    ]);
    
    if (transRes.data) setTransactions(transRes.data as any);
    if (provRes.data) setProviders(provRes.data);
    if (projRes.data) setProjectBudget(projRes.data.budget || 0);
    setLoading(false);
  };

  const calculateTotal = () => items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

  const handleEdit = (t: Transaction) => {
    setEditingId(t.id);
    setHeaderData({
      type: t.type,
      category: t.category,
      date: t.date,
      phase_id: t.phase_id || '',
      provider_id: t.provider_id || ''
    });
    setItems([{
      id: t.id,
      description: t.description,
      quantity: t.quantity || 1,
      unit: t.unit || 'PZA',
      unitPrice: t.unit_price || (t.amount / (t.quantity || 1))
    }]);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editingId) {
        const item = items[0];
        await supabase.from('project_transactions').update({
          type: headerData.type, category: headerData.category, description: item.description,
          amount: item.quantity * item.unitPrice, date: headerData.date, phase_id: headerData.phase_id || null,
          provider_id: headerData.provider_id || null, unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice
        }).eq('id', editingId);
        showSuccess('Movimiento actualizado');
      } else {
        const rows = items.map(item => ({
          project_id: projectId, type: headerData.type, category: headerData.category, description: item.description,
          amount: item.quantity * item.unitPrice, date: headerData.date, phase_id: headerData.phase_id || null,
          provider_id: headerData.provider_id || null, user_id: user?.id, unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice
        }));
        await supabase.from('project_transactions').insert(rows);
        showSuccess('Registros guardados');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) { showError('Error al guardar'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar registro?')) {
      await supabase.from('project_transactions').delete().eq('id', id);
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  // Cálculos de Análisis
  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
  const budgetExecution = projectBudget > 0 ? (totalExpense / projectBudget) * 100 : 0;
  
  const remainingBudgetAmount = projectBudget - totalExpense;
  const remainingBudgetPercentage = projectBudget > 0 ? (remainingBudgetAmount / projectBudget) * 100 : 0;

  // Agrupación por Fase
  const phaseSummary = transactions.filter(t => t.type === 'EXPENSE').reduce((acc: Record<string, number>, t) => {
    const phaseName = phases.find(p => p.id === t.phase_id)?.name || 'Gastos Generales';
    acc[phaseName] = (acc[phaseName] || 0) + t.amount;
    return acc;
  }, {});

  // Agrupación por Categoría
  const categorySummary = transactions.filter(t => t.type === 'EXPENSE').reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  // Agrupación por Proveedor
  const providerSummary = transactions.filter(t => t.type === 'EXPENSE' && t.provider_id).reduce((acc: any, t) => {
    const name = providers.find(p => p.id === t.provider_id)?.name || 'Sin Asignar';
    acc[name] = (acc[name] || 0) + t.amount;
    return acc;
  }, {});

  const resetForm = () => {
    setHeaderData({
      type: 'EXPENSE',
      category: 'Materiales',
      date: format(new Date(), 'yyyy-MM-dd'),
      phase_id: '',
      provider_id: ''
    });
    setItems([{ description: '', quantity: 1, unit: 'PZA', unitPrice: 0 }]);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 h-full overflow-y-auto pr-2 custom-scrollbar pb-10 print:p-0 print:overflow-visible">
      
      {/* 1. Dashboard de Presupuesto vs Real */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                    <BarChart3 className="w-6 h-6 text-indigo-500" /> Análisis Presupuestario General
                </h3>
                <span className={cn("px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase", totalExpense > projectBudget ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>
                    {totalExpense > projectBudget ? 'Presupuesto Excedido' : 'Dentro del límite'}
                </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <p className="text-sm font-bold text-slate-400 mb-1">Presupuesto Asignado</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">${projectBudget.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-400 mb-1">Gasto Real Acumulado</p>
                    <p className="text-3xl font-black text-indigo-600">${totalExpense.toLocaleString()}</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-tighter">Ejecución Total</span>
                    <span className="text-xs font-black text-indigo-600">{budgetExecution.toFixed(1)}%</span>
                </div>
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className={cn("h-full transition-all duration-1000", totalExpense > projectBudget ? "bg-red-500" : "bg-indigo-600")} style={{ width: `${Math.min(budgetExecution, 100)}%` }} />
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <div className="p-3 bg-white/10 rounded-2xl"><Wallet className="w-6 h-6" /></div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Balance Contable</p>
                    <p className="text-2xl font-black">${(totalIncome - totalExpense).toLocaleString()}</p>
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Fondos Disponibles</p>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xl font-black">
                          {remainingBudgetPercentage.toFixed(1)}% (${remainingBudgetAmount.toLocaleString()})
                        </p>
                    </div>
                    <PieChart className="w-10 h-10 opacity-30" />
                </div>
            </div>
        </div>
      </div>

      {/* 2. Gasto por Fase de Obra */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg mb-6">
          <Layers className="w-6 h-6 text-indigo-500" /> Desglose de Gastos por Fase
        </h3>
        
        {Object.keys(phaseSummary).length === 0 ? (
          <div className="py-10 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed">
            No se han registrado gastos vinculados a fases.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(phaseSummary).sort((a, b) => b[1] - a[1]).map(([phaseName, amount]) => (
              <div key={phaseName} className="p-5 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapa de Obra</span>
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white truncate mb-1" title={phaseName}>{phaseName}</h4>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">${amount.toLocaleString()}</p>
                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Impacto en el Gasto</span>
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">{((amount / totalExpense) * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Resumen Detallado por Categoría y Proveedor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Inversión por Categoría
            </h4>
            <div className="space-y-4">
                {Object.entries(categorySummary).map(([cat, amount]: any) => (
                    <div key={cat} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300 px-1">
                            <span>{cat}</span>
                            <span>${amount.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-400" style={{ width: `${(amount / totalExpense) * 100}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Pago a Proveedores
            </h4>
            <div className="space-y-4">
                {Object.entries(providerSummary).map(([name, amount]: any) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">{name[0]}</div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white shrink-0">${amount.toLocaleString()}</span>
                    </div>
                ))}
                {Object.keys(providerSummary).length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No hay proveedores asociados a gastos.</p>}
            </div>
        </div>
      </div>

      {/* 4. Acciones y Reporte */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div className="flex gap-2">
            <button onClick={() => { setEditingId(null); resetForm(); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
                <Plus className="w-4 h-4" /> Registrar Movimiento
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                <Printer className="w-4 h-4" /> Imprimir Reporte
            </button>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Historial de Transacciones</p>
      </div>

      <div className="space-y-3 print:mt-10">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-2 hidden print:block">Listado Detallado de Movimientos</h4>
        {transactions.map(t => (
          <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all print:border-0 print:border-b print:rounded-none">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 print:hidden",
                t.type === 'INCOME' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
              )}>
                {t.type === 'INCOME' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{t.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-medium uppercase tracking-tight mt-0.5">
                  <span className="flex items-center gap-1 font-bold text-indigo-500"><Tag className="w-3 h-3" /> {t.category}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(t.date), 'dd MMM, yyyy')}</span>
                  {t.quantity && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{t.quantity} {t.unit}</span>}
                  {t.provider_id && (
                    <span className="flex items-center gap-1 text-slate-600 font-bold"><Truck className="w-3 h-3" /> {providers.find(p => p.id === t.provider_id)?.name}</span>
                  )}
                  {t.phase_id && (
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold"><Layers className="w-3 h-3" /> {phases.find(p => p.id === t.phase_id)?.name}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={cn("font-black text-base", t.type === 'INCOME' ? "text-emerald-600" : "text-slate-900 dark:text-white")}>
                  {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString()}
                </p>
                {t.phase_id && <p className="text-[10px] text-indigo-400 font-bold uppercase truncate max-w-[120px]">{phases.find(p => p.id === t.phase_id)?.name}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all print:hidden">
                <button onClick={() => handleEdit(t)} className="p-2 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingId ? 'Editar Movimiento' : 'Registrar Movimientos'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
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
                      {headerData.type === 'EXPENSE' ? ['Materiales', 'Mano de Obra', 'Maquinaria', 'Combustible', 'Permisos', 'Logística', 'Otros'].map(c => <option key={c} value={c}>{c}</option>) : ['Pago Cliente', 'Adelanto', 'Extraordinario', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
                    <input type="date" value={headerData.date} onChange={e => setHeaderData({...headerData, date: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs" required />
                  </div>
                  
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Truck className="w-3 h-3 text-indigo-500" /> Proveedor Asociado</label>
                    <select value={headerData.provider_id} onChange={e => setHeaderData({...headerData, provider_id: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <option value="">-- Seleccionar Proveedor --</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Layers className="w-3 h-3 text-indigo-500" /> Asociar a Fase de Obra</label>
                    <select value={headerData.phase_id} onChange={e => setHeaderData({...headerData, phase_id: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                      <option value="">-- Gasto General / Sin fase --</option>
                      {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Hash className="w-3 h-3" /> Partidas del Movimiento
                    </h4>
                    {!editingId && (
                      <button type="button" onClick={() => setItems([...items, { description: '', quantity: 1, unit: 'PZA', unitPrice: 0 }])} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                        <PlusCircle className="w-3.5 h-3.5" /> Añadir Partida
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-3 items-end p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm relative group/item">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Descripción / Producto</label>
                          <input type="text" value={item.description} onChange={e => { const n = [...items]; n[index].description = e.target.value; setItems(n); }} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500" required placeholder="Ej. Varilla 3/8" />
                        </div>
                        <div className="w-20 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Cant.</label>
                          <input type="number" step="0.01" value={item.quantity} onChange={e => { const n = [...items]; n[index].quantity = parseFloat(e.target.value); setItems(n); }} className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-xs" required />
                        </div>
                        <div className="w-16 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">UND</label>
                          <input type="text" value={item.unit} onChange={e => { const n = [...items]; n[index].unit = e.target.value.toUpperCase(); setItems(n); }} className="w-full bg-slate-50 border border-slate-100 px-2 py-2 rounded-lg text-xs text-center" placeholder="PZA" />
                        </div>
                        <div className="w-28 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">P. Unitario ($)</label>
                          <input type="number" step="0.01" value={item.unitPrice} onChange={e => { const n = [...items]; n[index].unitPrice = parseFloat(e.target.value); setItems(n); }} className="w-full bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-xs" required />
                        </div>
                        <div className="w-28 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Subtotal</label>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300">
                            ${(item.quantity * item.unitPrice).toLocaleString()}
                          </div>
                        </div>
                        {!editingId && items.length > 1 && (
                          <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} className="p-2 text-slate-300 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Monto Total del Registro</p>
                  <p className={cn("text-3xl font-black", headerData.type === 'INCOME' ? "text-emerald-600" : "text-indigo-600")}>
                    ${calculateTotal().toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 md:flex-none px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
                  <button type="submit" disabled={isSubmitting || calculateTotal() < 0} className={cn(
                    "flex-1 md:flex-none px-10 py-3 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2",
                    headerData.type === 'INCOME' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                  )}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    {editingId ? 'Guardar Cambios' : 'Confirmar y Registrar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estilo CSS para impresión */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mt-10 { margin-top: 2.5rem !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:shadow-none { shadow: none !important; }
          .custom-scrollbar { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
};