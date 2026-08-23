"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, differenceInDays, startOfDay, endOfDay, eachMonthOfInterval, isSameMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, Edit3, Clock, Share2, Camera, X, Globe, Copy, CheckCircle2, Trash2, Upload, ImageIcon, ChevronRight, Calendar, Info } from 'lucide-react';
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

  // --- Lógica del Diagrama de Gantt ---
  const timelineData = useMemo(() => {
    if (phases.length === 0) return null;

    const starts = phases.map(p => new Date(p.start_date).getTime());
    const ends = phases.map(p => new Date(p.end_date).getTime());
    
    // Margen de 7 días antes y después para mejor visualización
    const minDate = startOfDay(addDays(new Date(Math.min(...starts)), -7));
    const maxDate = endOfDay(addDays(new Date(Math.max(...ends)), 14));
    
    const totalDays = differenceInDays(maxDate, minDate) + 1;
    
    // Generar meses para el encabezado
    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    return { minDate, maxDate, totalDays, months };
  }, [phases]);

  const getPhaseStyles = (phase: Phase) => {
    if (!timelineData) return {};
    
    const start = new Date(phase.start_date);
    const end = new Date(phase.end_date);
    
    const startOffset = differenceInDays(start, timelineData.minDate);
    const duration = Math.max(1, differenceInDays(end, start));
    
    const left = (startOffset / timelineData.totalDays) * 100;
    const width = (duration / timelineData.totalDays) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  // --- Handlers de UI ---
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
        return supabase.from('project_phase_photos').insert({ phase_id: phaseId, photo_url: publicUrl });
      });
      await Promise.all(uploadPromises);
      setPendingPhotos([]);
    } catch (err) {
      showError('Error al subir imágenes');
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
      showError('Error al guardar');
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
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col overflow-hidden pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Cronograma de Obra</h3>
          <p className="text-xs text-slate-500">Visualización del flujo de trabajo y hitos del proyecto.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsShareModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
          <button onClick={() => { setEditingPhase(null); setPendingPhotos([]); setFormData({ name: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), progress: 0, dependency_id: '', details: '', weather: 'Despejado' }); setIsModalOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all">
            <Plus className="w-4 h-4" /> Nueva Fase
          </button>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-12 text-center border-2 border-dashed">
          <Clock className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Aún no hay fases registradas.</p>
          <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Registrar la primera fase</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Cabecera del Gantt (Meses) */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0 overflow-x-auto hide-scrollbar scroll-smooth">
            <div className="w-48 sm:w-64 border-r border-slate-100 dark:border-slate-800 p-4 shrink-0 font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3 h-3" /> Fases del Proyecto
            </div>
            <div className="flex-1 relative min-w-[600px]">
              <div className="flex h-full">
                {timelineData?.months.map((month, idx) => (
                  <div 
                    key={idx} 
                    className="flex-1 border-r border-slate-100 dark:border-slate-800 last:border-0 p-3 text-center"
                  >
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">
                      {format(month, 'MMMM yyyy', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cuerpo del Gantt */}
          <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
            <div className="min-w-full inline-flex flex-col">
              {phases.map((phase) => (
                <div key={phase.id} className="flex group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors h-16 sm:h-20">
                  {/* Etiqueta de la fase */}
                  <div className="w-48 sm:w-64 border-r border-slate-50 dark:border-slate-800 p-4 shrink-0 flex flex-col justify-center">
                    <p className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">{phase.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(phase.start_date), 'dd MMM')}</span>
                      <ChevronRight className="w-2 h-2 text-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(phase.end_date), 'dd MMM')}</span>
                    </div>
                  </div>

                  {/* Área del diagrama */}
                  <div className="flex-1 relative min-w-[600px] h-full flex items-center px-4">
                    {/* Líneas de cuadrícula de fondo */}
                    <div className="absolute inset-0 flex">
                      {timelineData?.months.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-slate-50 dark:border-slate-800/50 last:border-0" />
                      ))}
                    </div>

                    {/* Barra de la fase */}
                    <div 
                      className="absolute h-9 sm:h-11 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-full shadow-sm flex items-center px-4 group/bar transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer z-10"
                      style={getPhaseStyles(phase)}
                      onClick={() => { setEditingPhase(phase); setPendingPhotos([]); setFormData({ name: phase.name, start_date: phase.start_date.split('T')[0], end_date: phase.end_date.split('T')[0], progress: phase.progress, dependency_id: phase.dependency_id || '', details: phase.details || '', weather: phase.weather || 'Despejado' }); setIsModalOpen(true); }}
                    >
                      {/* Indicador de Progreso Interno */}
                      <div className="absolute inset-y-0 left-0 bg-indigo-600 rounded-full opacity-10 transition-all duration-1000" style={{ width: `${phase.progress}%` }} />
                      
                      <div className="flex items-center justify-between w-full relative z-10">
                        <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 truncate pr-2">{phase.progress}%</span>
                        {phase.progress === 100 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                             <Edit3 className="w-3 h-3 text-indigo-400" />
                             {phase.project_phase_photos && phase.project_phase_photos.length > 0 && <ImageIcon className="w-3 h-3 text-indigo-400" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end">
            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest">
              <Calendar className="w-3 h-3" /> Eje Temporal del Proyecto ({timelineData?.totalDays} días)
            </p>
          </div>
        </div>
      )}

      {/* Modal Nueva/Editar Fase */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingPhase ? 'Editar Fase' : 'Nueva Fase'}</h3>
              <div className="flex items-center gap-2">
                {editingPhase && (
                  <button onClick={(e) => handleDeletePhase(editingPhase.id, e)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Eliminar fase">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Fase</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="Ej. Cimentación" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Inicio</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Fin</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Avance de la Fase</label>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{formData.progress}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="5" 
                  value={formData.progress} 
                  onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
              
              <div className="space-y-1.5 pt-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Evidencias Fotográficas</label>
                <div {...getRootProps()} className={cn(
                  "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
                  isDragActive ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                  <input {...getInputProps()} />
                  <Upload className="w-6 h-6 text-indigo-500" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sube fotos del avance</p>
                    <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider">Múltiples archivos permitidos</p>
                  </div>
                </div>
                
                {(pendingPhotos.length > 0 || (editingPhase?.project_phase_photos && editingPhase.project_phase_photos.length > 0)) && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {editingPhase?.project_phase_photos?.map(photo => (
                      <div key={photo.id} className="aspect-square rounded-xl overflow-hidden border border-slate-200 relative group">
                        <img src={photo.photo_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <CheckCircle2 className="text-white w-4 h-4" />
                        </div>
                      </div>
                    ))}
                    {pendingPhotos.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-indigo-200 group">
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
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notas Adicionales</label>
                <textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs resize-none" placeholder="Observaciones sobre esta fase..." />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingPhase ? 'Guardar Cambios' : 'Crear Fase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Compartir */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Compartir Cronograma</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Activa el enlace público para permitir que el cliente visualice este diagrama de Gantt sin necesidad de registrarse.</p>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Globe className={cn("w-5 h-5 transition-colors", projectData.is_public ? "text-emerald-500" : "text-slate-400")} />
                <span className="text-sm font-bold">Enlace Público</span>
              </div>
              <button onClick={togglePublic} className={cn("w-12 h-6 rounded-full transition-colors relative", projectData.is_public ? "bg-emerald-500" : "bg-slate-300")}>
                <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", projectData.is_public ? "right-1" : "left-1")} />
              </button>
            </div>

            {projectData.is_public && (
              <div className="flex gap-2 group">
                <input readOnly value={`${window.location.origin}/public/schedule/${projectData.public_token}`} className="flex-1 bg-slate-100 dark:bg-slate-800 border-none px-3 py-2.5 rounded-xl text-[10px] truncate font-medium text-slate-500" />
                <button onClick={copyLink} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"><Copy className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};