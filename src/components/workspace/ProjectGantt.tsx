"use client";

import React, { useState, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { Loader2, Plus, ArrowRight, Edit3, Clock, Share2, Camera, X, Globe, Copy, CheckCircle2 } from 'lucide-react';
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
  project_phase_photos?: { id: string, photo_url: string }[];
}

export const ProjectGantt = ({ projectId }: { projectId: string }) => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    progress: 0,
    dependency_id: ''
  });

  useEffect(() => {
    fetchProjectAndPhases();
  }, [projectId]);

  const fetchProjectAndPhases = async () => {
    setLoading(true);
    const [pRes, phRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('project_phases').select('*, project_phase_photos(id, photo_url)').eq('project_id', projectId).order('start_date', { ascending: true })
    ]);
    
    if (pRes.data) setProjectData(pRes.data);
    if (phRes.data) setPhases(phRes.data);
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
        showSuccess('Fase añadida');
      }
      setIsModalOpen(false);
      fetchProjectAndPhases();
    } catch (err) {
      showError('Error al guardar');
    }
  };

  const togglePublic = async () => {
    const newVal = !projectData.is_public;
    const { error } = await supabase.from('projects').update({ is_public: newVal }).eq('id', projectId);
    if (!error) {
      setProjectData({ ...projectData, is_public: newVal });
      showSuccess(newVal ? 'Cronograma público activado' : 'Cronograma privado');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/public/schedule/${projectData.public_token}`;
    navigator.clipboard.writeText(url);
    showSuccess('Enlace copiado al portapapeles');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, phaseId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `phases/${phaseId}/${Date.now()}.${fileExt}`;

    try {
      const { error: upErr } = await supabase.storage.from('workspace_files').upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('workspace_files').getPublicUrl(fileName);
      
      await supabase.from('project_phase_photos').insert({
        phase_id: phaseId,
        photo_url: publicUrl
      });

      showSuccess('Fotografía de avance guardada');
      fetchProjectAndPhases();
    } catch (err) {
      showError('Error al subir imagen');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">Planificación de Obra</h3>
          <p className="text-xs text-slate-500">Documenta el avance y compártelo con el cliente.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsShareModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
          <button onClick={() => { setEditingPhase(null); setIsModalOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20">
            <Plus className="w-4 h-4" /> Nueva Fase
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {phases.map(phase => (
          <div key={phase.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm group">
            <div className="p-5 flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-800 dark:text-white">{phase.name}</h4>
                  {phase.progress === 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(new Date(phase.start_date), 'dd MMM')} - {format(new Date(phase.end_date), 'dd MMM')}</span>
                  <span className="text-indigo-600 font-bold">{phase.progress}% AVANCE</span>
                  {phase.dependency_id && <span className="flex items-center gap-1 text-slate-400"><ArrowRight className="w-3 h-3" /> {phases.find(p => p.id === phase.dependency_id)?.name}</span>}
                </div>
                <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${phase.progress}%` }} />
                </div>
              </div>
              
              <div className="flex items-center gap-2 self-end sm:self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingPhase(phase); setFormData({ name: phase.name, start_date: phase.start_date.split('T')[0], end_date: phase.end_date.split('T')[0], progress: phase.progress, dependency_id: phase.dependency_id || '' }); setIsModalOpen(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => handlePhotoUpload(e as any, phase.id); input.click(); }} disabled={isUploading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>

            {phase.project_phase_photos && phase.project_phase_photos.length > 0 && (
              <div className="px-5 pb-5 pt-4 border-t border-slate-50 dark:border-slate-800 flex gap-2 overflow-x-auto hide-scrollbar">
                {phase.project_phase_photos.map(photo => (
                  <div key={photo.id} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shrink-0">
                    <img src={photo.photo_url} className="w-full h-full object-cover" alt="Phase" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Compartir Cronograma</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", projectData.is_public ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500")}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Acceso Público</span>
                    <span className="text-[10px] text-slate-500">{projectData.is_public ? 'Cualquiera con el link puede ver' : 'Solo miembros del equipo'}</span>
                  </div>
                </div>
                <button onClick={togglePublic} className={cn("w-12 h-6 rounded-full transition-colors relative", projectData.is_public ? "bg-emerald-500" : "bg-slate-300")}>
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", projectData.is_public ? "right-1" : "left-1")} />
                </button>
              </div>

              {projectData.is_public && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enlace único para el cliente</label>
                  <div className="flex gap-2">
                    <input readOnly value={`${window.location.origin}/public/schedule/${projectData.public_token}`} className="flex-1 bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 rounded-lg text-xs truncate text-slate-600" />
                    <button onClick={copyLink} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingPhase ? 'Editar Fase' : 'Nueva Fase de Obra'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
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
                <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} className="w-full accent-indigo-600" />
                <div className="text-right text-xs font-bold text-indigo-600">{formData.progress}% completado</div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-semibold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};