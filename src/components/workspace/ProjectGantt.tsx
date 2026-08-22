"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, ArrowRight, Edit3, Clock, Share2, Camera, X, Globe, Copy, CheckCircle2, Trash2, Upload, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { useDropzone } from 'react-dropzone';

interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  progress: number;
  dependency_id: string | null;
  details: string | null;
  weather: string | null;
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
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    progress: 0,
    dependency_id: '',
    details: '',
    weather: 'Despejado'
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingPhotos(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] }
  });

  const removePendingPhoto = (index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (phaseId: string) => {
    if (pendingPhotos.length === 0) return;
    
    setIsUploading(true);
    try {
      const uploadPromises = pendingPhotos.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `phases/${phaseId}/${Math.random()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('workspace_files').upload(fileName, file);
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage.from('workspace_files').getPublicUrl(fileName);
        return supabase.from('project_phase_photos').insert({
          phase_id: phaseId,
          photo_url: publicUrl
        });
      });

      await Promise.all(uploadPromises);
      setPendingPhotos([]);
    } catch (err) {
      showError('Error al subir algunas imágenes');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const phaseData = {
      name: formData.name,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      progress: formData.progress,
      project_id: projectId,
      dependency_id: formData.dependency_id || null,
      details: formData.details,
      weather: formData.weather
    };

    try {
      let phaseId = editingPhase?.id;
      if (editingPhase) {
        await supabase.from('project_phases').update(phaseData).eq('id', editingPhase.id);
        showSuccess('Fase actualizada');
      } else {
        const { data, error } = await supabase.from('project_phases').insert(phaseData).select().single();
        if (error) throw error;
        phaseId = data.id;
        showSuccess('Fase añadida');
      }
      
      if (phaseId) await uploadPhotos(phaseId);
      
      setIsModalOpen(false);
      fetchProjectAndPhases();
    } catch (err) {
      showError('Error al guardar la fase');
    }
  };

  const handleDeletePhase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta fase?')) return;
    await supabase.from('project_phases').delete().eq('id', id);
    fetchProjectAndPhases();
  };

  const togglePublic = async () => {
    const newVal = !projectData.is_public;
    await supabase.from('projects').update({ is_public: newVal }).eq('id', projectId);
    setProjectData({ ...projectData, is_public: newVal });
    showSuccess(newVal ? 'Cronograma público' : 'Cronograma privado');
  };

  const copyLink = () => {
    const url = `${window.location.origin}/public/schedule/${projectData.public_token}`;
    navigator.clipboard.writeText(url);
    showSuccess('Enlace copiado');
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Cronograma de Obra</h3>
          <p className="text-xs text-slate-500">Historial visual del avance del proyecto.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsShareModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
          <button onClick={() => { setEditingPhase(null); setPendingPhotos([]); setFormData({ name: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), progress: 0, dependency_id: '', details: '', weather: 'Despejado' }); setIsModalOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Nueva Fase
          </button>
        </div>
      </div>

      <div className="space-y-4 pb-12">
        {phases.map(phase => (
          <div key={phase.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm group">
            <div className="p-5 flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-800 dark:text-white">{phase.name}</h4>
                  {phase.progress === 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(new Date(phase.start_date), 'dd MMM')} - {format(new Date(phase.end_date), 'dd MMM')}</span>
                  <span className="text-indigo-600 font-bold">{phase.progress}% COMPLETADO</span>
                  {phase.weather && <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-0.5 rounded">{phase.weather}</span>}
                </div>
                {phase.details && <p className="text-xs text-slate-500 mt-2">{phase.details}</p>}
                <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${phase.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingPhase(phase); setPendingPhotos([]); setFormData({ name: phase.name, start_date: phase.start_date.split('T')[0], end_date: phase.end_date.split('T')[0], progress: phase.progress, dependency_id: phase.dependency_id || '', details: phase.details || '', weather: phase.weather || 'Despejado' }); setIsModalOpen(true); }} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                <button onClick={(e) => handleDeletePhase(phase.id, e)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {phase.project_phase_photos && phase.project_phase_photos.length > 0 && (
              <div className="px-5 pb-5 pt-4 border-t border-slate-50 dark:border-slate-800 flex gap-3 overflow-x-auto hide-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                {phase.project_phase_photos.map(photo => (
                  <div key={photo.id} className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm hover:scale-105 transition-transform">
                    <img src={photo.photo_url} className="w-full h-full object-cover" alt="Evidencia" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingPhase ? 'Editar Fase' : 'Nueva Fase'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Fase</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Inicio</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Fin</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Galería de Imágenes</label>
                <div {...getRootProps()} className={cn(
                  "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                  isDragActive ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                  <input {...getInputProps()} />
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-600">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Haz clic o arrastra fotos aquí</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Puedes subir múltiples imágenes de avance</p>
                  </div>
                </div>
                
                {pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {pendingPhotos.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePendingPhoto(idx)} className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 shadow-sm">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Detalles / Notas</label>
                <textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm resize-none" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Compartir Cronograma</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Globe className={cn("w-5 h-5", projectData.is_public ? "text-emerald-500" : "text-slate-400")} />
                <span className="text-sm font-bold">Enlace Público</span>
              </div>
              <button onClick={togglePublic} className={cn("w-12 h-6 rounded-full transition-colors relative", projectData.is_public ? "bg-emerald-500" : "bg-slate-300")}>
                <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", projectData.is_public ? "right-1" : "left-1")} />
              </button>
            </div>
            {projectData.is_public && (
              <div className="flex gap-2">
                <input readOnly value={`${window.location.origin}/public/schedule/${projectData.public_token}`} className="flex-1 bg-slate-100 border-none px-3 py-2 rounded-lg text-[10px] truncate" />
                <button onClick={copyLink} className="p-2 bg-indigo-600 text-white rounded-lg"><Copy className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};