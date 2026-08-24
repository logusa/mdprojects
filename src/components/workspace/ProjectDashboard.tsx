"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, CheckCircle2, Clock, Wallet, LayoutGrid, 
  TrendingUp, ListTodo, AlertCircle, ArrowRight, Loader2,
  AlertTriangle, BellRing, Info, Target
} from 'lucide-react';
import { format, differenceInDays, isPast, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectDashboardProps {
  projectId: string;
  project: any;
}

export const ProjectDashboard = ({ projectId, project: initialProject }: ProjectDashboardProps) => {
  const [project, setProject] = useState(initialProject);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalSpent: 0,
    upcomingTasks: [] as any[],
    recentIncidents: [] as any[],
    upcomingPhases: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [projectId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (projData) setProject(projData);

      const [tasksRes, transactionsRes, phasesRes, logsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, status, due_date').eq('project_id', projectId),
        supabase.from('project_transactions').select('amount').eq('project_id', projectId).eq('type', 'EXPENSE'),
        supabase.from('project_phases').select('*').eq('project_id', projectId).gte('end_date', new Date().toISOString()).order('start_date', { ascending: true }).limit(3),
        supabase.from('construction_logs').select('incidents, log_date').eq('project_id', projectId).not('incidents', 'is', null).order('log_date', { ascending: false }).limit(3)
      ]);

      const allTasks = tasksRes.data || [];
      const totalSpent = transactionsRes.data?.reduce((acc, t) => acc + t.amount, 0) || 0;
      const threeDaysFromNow = addDays(new Date(), 3);
      
      setStats({
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter(t => t.status === 'DONE').length,
        totalSpent,
        upcomingTasks: allTasks.filter(t => t.status !== 'DONE' && t.due_date && new Date(t.due_date) <= threeDaysFromNow),
        recentIncidents: logsRes.data || [],
        upcomingPhases: phasesRes.data || []
      });
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const budgetExecution = project?.budget > 0 ? (stats.totalSpent / project.budget) * 100 : 0;

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avance de Obra */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><LayoutGrid className="w-6 h-6" /></div>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Avance Obra</span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.progress || 0}%</p>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600" style={{ width: `${project.progress || 0}%` }} />
          </div>
        </div>

        {/* Análisis Presupuestario */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="p-3 bg-orange-50 rounded-2xl text-orange-600"><Target className="w-6 h-6" /></div>
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Uso Presupuesto</span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">{budgetExecution.toFixed(0)}%</p>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn("h-full transition-all", budgetExecution > 100 ? "bg-red-500" : "bg-orange-500")} style={{ width: `${Math.min(budgetExecution, 100)}%` }} />
          </div>
        </div>

        {/* Gasto Real */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Wallet className="w-6 h-6" /></div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Invertido</span>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white mb-1">${stats.totalSpent.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase">De un total de ${project.budget?.toLocaleString() || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-xl mb-8">
                <BellRing className="w-6 h-6 text-orange-500" /> Alertas Financieras y Operativas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tareas Críticas</h4>
                    {stats.upcomingTasks.length === 0 ? <p className="text-xs text-slate-500 italic">Sin tareas urgentes.</p> : stats.upcomingTasks.map((t:any) => (
                        <div key={t.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center group">
                            <span className="text-sm font-bold text-slate-800 truncate pr-4">{t.title}</span>
                            <Clock className="w-4 h-4 text-red-500" />
                        </div>
                    ))}
                </div>
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Incidencias Bitácora</h4>
                    {stats.recentIncidents.length === 0 ? <p className="text-xs text-slate-500 italic">Sin incidencias recientes.</p> : stats.recentIncidents.map((l:any, i:number) => (
                        <div key={i} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                            <p className="text-xs font-bold text-orange-700">{l.incidents}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
            <div>
                <h3 className="font-black text-sm uppercase tracking-[0.2em] mb-8">Resumen de Entrega</h3>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Calendar className="w-10 h-10 opacity-40 shrink-0" />
                        <div>
                            <p className="text-xs font-bold opacity-60 uppercase">Fecha Objetivo</p>
                            <p className="text-lg font-black">{project.due_date ? format(new Date(project.due_date), 'dd MMM, yyyy', { locale: es }) : 'No definida'}</p>
                        </div>
                    </div>
                    {project.due_date && (
                        <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                            <p className="text-xs font-bold uppercase opacity-60">Tiempo Restante</p>
                            <p className="text-2xl font-black">{Math.max(0, differenceInDays(new Date(project.due_date), new Date()))} Días</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="pt-6 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Salud del Proyecto</p>
                <div className="flex justify-between items-end">
                    <span className="text-2xl font-black">{budgetExecution < 100 ? 'Estable' : 'En Riesgo'}</span>
                    <TrendingUp className="w-6 h-6 opacity-40" />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};