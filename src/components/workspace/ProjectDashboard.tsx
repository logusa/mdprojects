"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, CheckCircle2, Clock, Wallet, LayoutGrid, 
  TrendingUp, ListTodo, AlertCircle, ArrowRight, Loader2 
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectDashboardProps {
  projectId: string;
  project: any;
}

export const ProjectDashboard = ({ projectId, project }: ProjectDashboardProps) => {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalSpent: 0,
    upcomingPhases: [] as any[],
    recentTransactions: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [projectId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tasksRes, transactionsRes, phasesRes] = await Promise.all([
        supabase.from('tasks').select('status', { count: 'exact' }).eq('project_id', projectId),
        supabase.from('project_transactions').select('*').eq('project_id', projectId).order('date', { ascending: false }).limit(5),
        supabase.from('project_phases').select('*').eq('project_id', projectId).gte('end_date', new Date().toISOString()).order('start_date', { ascending: true }).limit(3)
      ]);

      const totalTasks = tasksRes.data?.length || 0;
      const completedTasks = tasksRes.data?.filter(t => t.status === 'DONE').length || 0;
      const totalSpent = (await supabase.from('project_transactions').select('amount').eq('project_id', projectId).eq('type', 'EXPENSE')).data?.reduce((acc, t) => acc + t.amount, 0) || 0;

      setStats({
        totalTasks,
        completedTasks,
        totalSpent,
        upcomingPhases: phasesRes.data || [],
        recentTransactions: transactionsRes.data || []
      });
    } catch (error) {
      console.error("Error loading dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const daysLeft = project.due_date ? differenceInDays(new Date(project.due_date), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const taskProgress = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Resumen Superior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progreso General</span>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <p className="text-4xl font-black text-slate-900 dark:text-white">{project.progress || 0}%</p>
              <p className="text-xs font-bold text-indigo-500">OBRA FÍSICA</p>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${project.progress || 0}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className={cn("p-3 rounded-2xl", isOverdue ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiempo Restante</span>
          </div>
          <div>
            <div className="flex justify-between items-end">
              <p className={cn("text-4xl font-black", isOverdue ? "text-red-600" : "text-slate-900 dark:text-white")}>
                {daysLeft !== null ? (isOverdue ? Math.abs(daysLeft) : daysLeft) : '--'}
              </p>
              <p className="text-xs font-bold text-slate-500 uppercase">{isOverdue ? 'Días Vencido' : 'Días para el fin'}</p>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              Meta: {project.due_date ? format(new Date(project.due_date), 'dd MMMM, yyyy', { locale: es }) : 'No definida'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl text-orange-600">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inversión Actual</span>
          </div>
          <div>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black text-slate-900 dark:text-white">${stats.totalSpent.toLocaleString()}</p>
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Basado en gastos registrados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tareas */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-indigo-500" /> Estado de Tareas
            </h3>
            <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">{stats.totalTasks} Total</span>
          </div>
          
          <div className="flex items-center gap-8 mb-8">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * taskProgress) / 100} strokeLinecap="round" className="text-indigo-600 transition-all duration-1000" />
              </svg>
              <span className="absolute text-xl font-black text-slate-900 dark:text-white">{taskProgress}%</span>
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Completadas</span>
                <span className="text-sm font-bold text-emerald-600">{stats.completedTasks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Pendientes</span>
                <span className="text-sm font-bold text-orange-500">{stats.totalTasks - stats.completedTasks}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${taskProgress}%` }} />
              </div>
            </div>
          </div>
          <button className="w-full py-3 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
            GESTIONAR TABLERO KANBAN <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Próximas Fases */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-indigo-500" /> Próximas Fases en Cronograma
          </h3>
          <div className="space-y-4">
            {stats.upcomingPhases.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">No hay fases próximas registradas.</p>
            ) : (
              stats.upcomingPhases.map(phase => (
                <div key={phase.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex flex-col items-center justify-center text-indigo-600">
                    <span className="text-[10px] font-black uppercase">{format(new Date(phase.start_date), 'MMM', { locale: es })}</span>
                    <span className="text-lg font-black leading-tight">{format(new Date(phase.start_date), 'dd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{phase.name}</p>
                    <p className="text-xs text-slate-500">Termina el {format(new Date(phase.end_date), 'dd MMM', { locale: es })}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">{phase.progress}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actividad Financiera Reciente */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-orange-500" /> Movimientos Financieros Recientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.recentTransactions.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-400 italic text-center py-6">Sin movimientos registrados.</p>
            ) : (
              stats.recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", t.type === 'INCOME' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600")}>
                      {t.type === 'INCOME' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[150px]">{t.description}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t.category}</p>
                    </div>
                  </div>
                  <p className={cn("text-sm font-black", t.type === 'INCOME' ? "text-emerald-600" : "text-slate-900 dark:text-white")}>
                    {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};