"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar, CheckCircle2, Clock, Wallet, LayoutGrid, 
  TrendingUp, ListTodo, AlertCircle, ArrowRight, Loader2,
  AlertTriangle, BellRing, Info
} from 'lucide-react';
import { format, differenceInDays, isPast, isWithinInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getBrowserLocale } from '@/utils/locale';

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
      // 1. Refrescar datos del proyecto para tener el progreso más reciente
      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projData) setProject(projData);

      // 2. Cargar estadísticas y recordatorios
      const [tasksRes, transactionsRes, phasesRes, logsRes] = await Promise.all([
        // Tareas para estadísticas y recordatorios (vencimiento próximo)
        supabase.from('tasks')
          .select('id, title, status, due_date')
          .eq('project_id', projectId),
        
        // Transacciones para gasto
        supabase.from('project_transactions')
          .select('amount')
          .eq('project_id', projectId)
          .eq('type', 'EXPENSE'),
        
        // Próximas fases
        supabase.from('project_phases')
          .select('*')
          .eq('project_id', projectId)
          .gte('end_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(3),

        // Incidencias recientes de la bitácora
        supabase.from('construction_logs')
          .select('incidents, log_date')
          .eq('project_id', projectId)
          .not('incidents', 'is', null)
          .order('log_date', { ascending: false })
          .limit(3)
      ]);

      const allTasks = tasksRes.data || [];
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'DONE').length;
      const totalSpent = transactionsRes.data?.reduce((acc, t) => acc + t.amount, 0) || 0;

      // Filtrar recordatorios: Tareas por hacer que vencen en los próximos 3 días
      const threeDaysFromNow = addDays(new Date(), 3);
      const upcomingTasks = allTasks.filter(t => 
        t.status !== 'DONE' && 
        t.due_date && 
        new Date(t.due_date) <= threeDaysFromNow
      ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      setStats({
        totalTasks,
        completedTasks,
        totalSpent,
        upcomingTasks,
        recentIncidents: logsRes.data || [],
        upcomingPhases: phasesRes.data || []
      });
    } catch (error) {
      console.error("Error loading dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const getDeliveryStatus = () => {
    if (!project.due_date) return { label: 'Sin fecha', color: 'text-slate-400', bg: 'bg-slate-50', icon: <Info className="w-4 h-4" /> };
    
    const dueDate = new Date(project.due_date);
    const progress = project.progress || 0;
    const daysLeft = differenceInDays(dueDate, new Date());

    if (progress >= 100) return { label: 'Completado', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" /> };
    if (isPast(dueDate)) return { label: 'Vencido', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertCircle className="w-4 h-4" /> };
    
    // Si falta menos del 15% del tiempo y el progreso es menor al 70%
    if (daysLeft < 7 && progress < 70) return { label: 'Atrasado', color: 'text-orange-600', bg: 'bg-orange-50', icon: <AlertTriangle className="w-4 h-4" /> };
    
    return { label: 'En Tiempo', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock className="w-4 h-4" /> };
  };

  const deliveryStatus = getDeliveryStatus();
  const taskProgress = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Resumen Superior */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5", deliveryStatus.bg, deliveryStatus.color)}>
              {deliveryStatus.icon} {deliveryStatus.label}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <p className="text-4xl font-black text-slate-900 dark:text-white">{project.progress || 0}%</p>
              <p className="text-xs font-bold text-indigo-500">AVANCE DE OBRA</p>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${project.progress || 0}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl text-orange-600">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Presupuesto Ejecutado</span>
          </div>
          <div>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-black text-slate-900 dark:text-white">${stats.totalSpent.toLocaleString()}</p>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Acumulado de gastos registrados</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de Entrega</span>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {project.due_date ? format(new Date(project.due_date), 'dd MMMM, yyyy', { locale: es }) : 'No definida'}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {project.due_date ? (isPast(new Date(project.due_date)) ? 'Plazo vencido' : `Faltan ${differenceInDays(new Date(project.due_date), new Date())} días`) : '--'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recordatorios y Avisos (Módulo central de atención) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-xl">
                <BellRing className="w-6 h-6 text-orange-500" /> Recordatorios y Avisos
              </h3>
              <span className="text-[10px] font-black bg-orange-50 text-orange-600 px-3 py-1 rounded-full">REVISIÓN NECESARIA</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Avisos de Tareas */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ListTodo className="w-4 h-4" /> Tareas próximas a vencer
                </h4>
                <div className="space-y-3">
                  {stats.upcomingTasks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">No hay tareas urgentes para esta semana.</p>
                  ) : (
                    stats.upcomingTasks.map(task => (
                      <div key={task.id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" /> Vence {format(new Date(task.due_date), 'eeee', { locale: es })}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Avisos de Incidencias */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Incidencias en Bitácora
                </h4>
                <div className="space-y-3">
                  {stats.recentIncidents.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">Sin incidencias reportadas recientemente.</p>
                  ) : (
                    stats.recentIncidents.map((log, idx) => (
                      <div key={idx} className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                        <p className="text-xs font-bold text-orange-700 dark:text-orange-400">{log.incidents}</p>
                        <p className="text-[10px] text-orange-500 mt-2 font-medium">Reportado el {format(new Date(log.log_date), 'dd MMM', { locale: es })}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas de Tareas */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-indigo-500" /> Desempeño Operativo
              </h3>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-10">
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                  <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={339.12} strokeDashoffset={339.12 - (339.12 * taskProgress) / 100} strokeLinecap="round" className="text-indigo-600 transition-all duration-1000" />
                </svg>
                <div className="absolute text-center">
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{taskProgress}%</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase mt-1 tracking-tighter">Completado</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 flex-1 w-full">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total Tareas</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalTasks}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-emerald-500 uppercase">Finalizadas</p>
                  <p className="text-2xl font-black text-emerald-600">{stats.completedTasks}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-orange-500 uppercase">En Proceso</p>
                  <p className="text-2xl font-black text-orange-600">{stats.totalTasks - stats.completedTasks}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-500 uppercase">Tasa Eficiencia</p>
                  <p className="text-2xl font-black text-indigo-600">{taskProgress}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Lateral del Dashboard */}
        <div className="lg:col-span-4 space-y-6">
          {/* Próximas Fases */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 text-sm">
              <Calendar className="w-5 h-5 text-indigo-500" /> Próximos Hitos
            </h3>
            <div className="space-y-4">
              {stats.upcomingPhases.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Sin hitos próximos definidos.</p>
              ) : (
                stats.upcomingPhases.map(phase => (
                  <div key={phase.id} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{phase.name}</p>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{phase.progress}%</span>
                      <span className="text-[10px] text-slate-500 font-medium">Fin: {format(new Date(phase.end_date), 'dd MMM', { locale: es })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Estado de Salud del Proyecto */}
          <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-indigo-200" /> Salud del Proyecto
            </h3>
            <div className="space-y-5">
              <HealthItem label="Cumplimiento Plazos" value={isPast(new Date(project.due_date || '')) ? 30 : 85} />
              <HealthItem label="Presupuesto vs Avance" value={92} />
              <HealthItem label="Documentación" value={100} />
            </div>
            <div className="mt-8 pt-6 border-t border-indigo-500/30">
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest text-center">Recomendación</p>
              <p className="text-xs text-indigo-100 mt-2 text-center italic">"Revisar incidencias reportadas ayer para evitar retrasos en fase crítica."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HealthItem = ({ label, value }: { label: string, value: number }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-bold text-indigo-100">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="w-full h-1.5 bg-indigo-500/30 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-200" style={{ width: `${value}%` }} />
    </div>
  </div>
);