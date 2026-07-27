"use client";

import React, { useState, useEffect } from 'react';
import { format, differenceInDays, addDays, startOfISOWeek, endOfISOWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, ArrowRight, Trash2, Edit3, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';

interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress: number;
  dependency_id: string | null;
}

export const ProjectGantt = ({ projectId }: { projectId: string }) => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    progress: 0,
    dependency_id: ''
  });

  useEffect(() => {
    fetchPhases();
  }, [projectId]);

  const fetchPhases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true });
    
    if (data) setPhases(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const phaseData = {
      ...formData,
      project_id: projectId,
      dependency_id: formData.dependency_id || null
    };

    try {
      if (editingPhase) {
        await supabase.from('project_phases').update(phaseData).eq('id', editingPhase.id);
        showSuccess('Fase actualizada');
      } else {
        await supabase.from('project_phases').insert(phaseData);
        showSuccess('Fase añadida al cronograma');
      }
      setIsModalOpen(false);
      fetchPhases();
    } catch (err) {
      showError('Error al guardar la fase');
    }
  };

  const deletePhase = async (id: string) => {
    if (!window.confirm('¿Eliminar esta fase del cronograma?')) return;
    await supabase.from('project_phases').delete().eq('id', id);
    setPhases(phases.filter(p => p.id !== id));
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white">Planificación de Obra</h3>
          <p className="text-xs text-slate-500">Define las fases críticas y sus dependencias.</p>
        </div>
        <button 
          onClick={() => { setEditingPhase(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Fase
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fase / Actividad</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Periodo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Progreso</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dependencia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {phases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No hay fases definidas para este proyecto.</td>
                </tr>
              ) : (
                phases.map(phase => (
                  <tr key={phase.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-white">{phase.name}</span>
                        <div className="mt-2 w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${phase.progress}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(phase.start_date), 'dd MMM')} - {format(new Date(phase.end_date), 'dd MMM')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                        phase.progress === 100 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-orange-50 text-orange-700 border-orange-200"
                      )}>
                        {phase.progress}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {phase.dependency_id ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-medium">
                          <ArrowRight className="w-3.5 h-3.5" />
                          {phases.find(p => p.id === phase.dependency_id)?.name}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin dep.</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingPhase(phase); setFormData({ name: phase.name, start_date: phase.start_date.split('T')[0], end_date: phase.end_date.split('T')[0], progress: phase.progress, dependency_id: phase.dependency_id || '' }); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deletePhase(phase.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingPhase ? 'Editar Fase' : 'Nueva Fase de Obra'}</h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Nombre de la Fase</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Cimentación" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Inicio</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Fin Estimado</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Avance (%)</label>
                <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} className="w-full" />
                <div className="text-right text-xs font-bold text-indigo-600">{formData.progress}% completado</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Depende de (Opcional)</label>
                <select value={formData.dependency_id} onChange={e => setFormData({...formData, dependency_id: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <option value="">Ninguna</option>
                  {phases.filter(p => p.id !== editingPhase?.id).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-semibold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};