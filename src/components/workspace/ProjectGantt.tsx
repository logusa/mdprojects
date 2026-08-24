"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, differenceInDays, startOfDay, endOfDay, eachMonthOfInterval, isSameMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, Edit3, Clock, Share2, Camera, X, Globe, Copy, CheckCircle2, Trash2, Upload, ImageIcon, ChevronRight, Calendar, Info, FileText } from 'lucide-react';
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
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<any[]>([]);

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

  const fetchExistingDocs = async (phaseId: string) => {
    const { data } = await supabase.from('project_phase_docs').select('*').eq('phase_id', phaseId);
    if (data) setExistingDocs(data);
  };

  const timelineData = useMemo(() => {
    if (phases.length === 0) return null;
    const starts = phases.map(p => new Date(p.start_date).getTime());
    const ends = phases.map(p => new Date(p.end_date).getTime());
    const minDate = startOfDay(addDays(new Date(Math.min(...starts)), -7));
    const maxDate = endOfDay(addDays(new Date(Math.max(...ends)), 14));
    const totalDays = differenceInDays(maxDate, minDate) + 1;
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

  // Dropzone para Fotos
  const onDropPhotos = useCallback((acceptedFiles: File[]) => {
    setPendingPhotos(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps: getRootPhotos, getInputProps: getInputPhotos, isDragActive: isDragPhotos } = useDropzone({ 
    onDrop: onDropPhotos,
    accept: { 'image/*': [] }
  });

  // Dropzone para Documentos
  const onDropDocs = useCallback((acceptedFiles: File[]) => {
    setPendingDocs(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps: getRootDocs, getInputProps: getInputDocs, isDragActive: isDragDocs } = useDropzone({ 
    onDrop: onDropDocs,
    accept: { 'application/pdf': [], 'application/msword': [], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [], 'application/vnd.ms-excel': [], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [] }
  });

  const uploadFiles = async (phaseId: string) => {
    if (pendingPhotos.length === 0 && pendingDocs.length === 0) return;
    setIsUploading(true);
    try {
      // Subir fotos
      const photoPromises = pendingPhotos.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `phases/${phaseId}/img-${Math.random()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('workspace_files').upload(fileName, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('workspace_files').getPublicUrl(fileName);
        return supabase.from('project_phase_photos').insert({ phase_id: phaseId, photo_url: publicUrl });
      });

      // Subir documentos
      const docPromises = pendingDocs.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `phases/${phaseId}/doc-${Math.random()}.${fileExt}`;
        const { error: upErr } = await supabase.storage.from('workspace_files').upload(fileName, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('workspace_files').getPublicUrl(fileName);
        return supabase.from('project_phase_docs').insert({ 
            phase_id: phaseId, 
            file_url: publicUrl, 
            file_name: file.name, 
            file_type: file.type 
        });
      });

      await Promise.all([...photoPromises, ...docPromises]);
      setPendingPhotos([]);
      setPendingDocs([]);
    } catch (err) {
      showError('Error al subir archivos');
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
      if (phaseId) await uploadFiles(phaseId);
      setIsModalOpen(false);
      fetchProjectAndPhases();
    } catch (err) {
      showError('Error al guardar');
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    await supabase.from('project_phase_docs').delete().eq('id', docId);
    setExistingDocs(existingDocs.filter(d => d.id !== docId));
  };

  const openModalForEditing = (phase: Phase) => {
    setEditingPhase(phase);
    setPendingPhotos([]);
    setPendingDocs([]);
    setExistingDocs([]);
    setFormData({ 
        name: phase.name, 
        start_date: phase.start_date.split('T')[0], 
        end_date: phase.end_date.split('T')[0], 
        progress: phase.progress, 
        dependency_id: phase.dependency_id || '', 
        details: phase.details || '', 
        weather: phase.weather || 'Despejado' 
    });
    fetchExistingDocs(phase.id);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col overflow-hidden pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">Cronograma de Obra</h3>
          <p className="text-xs text-slate-500">Flujo de trabajo y carga de evidencias por fase.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsShareModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200"><Share2 className="w-4 h-4" /> Compartir</button>
          <button onClick={() => { setEditingPhase(null); setPendingPhotos([]); setPendingDocs([]); setExistingDocs([]); setFormData({ name: '', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), progress: 0, dependency_id: '', details: '', weather: 'Despejado' }); setIsModalOpen(true); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"><Plus className="w-4 h-4" /> Nueva Fase</button>
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
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0 overflow-x-auto hide-scrollbar scroll-smooth">
            <div className="w-48 sm:w-64 border-r border-slate-100 dark:border-slate-800 p-4 shrink-0 font-black text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-3 h-3" /> Fases del Proyecto</div>
            <div className="flex-1 relative min-w-[600px]"><div className="flex h-full">{timelineData?.months.map((month, idx) => (<div key={idx} className="flex-1 border-r border-slate-100 dark:border-slate-800 last:border-0 p-3 text-center"><span className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{format(month, 'MMMM yyyy', { locale: es })}</span></div>))}</div></div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
            <div className="min-w-full inline-flex flex-col">
              {phases.map((phase) => (
                <div key={phase.id} className="flex group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors h-16 sm:h-20">
                  <div className="w-48 sm:w-64 border-r border-slate-50 dark:border-slate-800 p-4 shrink-0 flex flex-col justify-center">
                    <p className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">{phase.name}</p>
                    <div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(phase.start_date), 'dd MMM')}</span><ChevronRight className="w-2 h-2 text-slate-300" /><span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(phase.end_date), 'dd MMM')}</span></div>
                  </div>
                  <div className="flex-1 relative min-w-[600px] h-full flex items-center px-4">
                    <div className="absolute inset-0 flex">{timelineData?.months.map((_, i) => (<div key={i} className="flex-1 border-r border-slate-50 dark:border-slate-800/50 last:border-0" />))}</div>
                    <div className="absolute h-9 sm:h-11 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-full shadow-sm flex items-center px-4 group/bar transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer z-10" style={getPhaseStyles(phase)} onClick={() => openModalForEditing(phase)}>
                      <div className="absolute inset-y-0 left-0 bg-indigo-600 rounded-full opacity-10 transition-all duration-1000" style={{ width: `${phase.progress}%` }} />
                      <div className="flex items-center justify-between w-full relative z-10"><span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 truncate pr-2">{phase.progress}%</span>{phase.progress === 100 ? (<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />) : (<div className="flex items-center gap-1 opacity-0 group-hover/bar:opacity-100 transition-opacity"><Edit3 className="w-3 h-3 text-indigo-400" />{phase.project_phase_photos && phase.project_phase_photos.length > 0 && <ImageIcon className="w-3 h-3 text-indigo-400" />}</div>)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingPhase ? 'Editar Fase' : 'Nueva Fase'}</h3>
              <div className="flex items-center gap-2">
                {editingPhase && (<button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar fase?')) { supabase.from('project_phases').delete().eq('id', editingPhase.id).then(() => { setIsModalOpen(false); fetchProjectAndPhases(); }); }}} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-5 h-5" /></button>)}
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Fase</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="Ej. Cimentación" /></div>
              <div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Inicio</label><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div><div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Fin</label><input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div></div>
              <div className="space-y-1.5"><div className="flex justify-between items-center mb-1"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Avance</label><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{formData.progress}%</span></div><input type="range" min="0" max="100" step="5" value={formData.progress} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> Galería de Fotos</label>
                  <div {...getRootPhotos()} className={cn("border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer", isDragPhotos ? "border-indigo-500 bg-indigo-50" : "border-slate-200 dark:border-slate-800 hover:border-slate-300")}>
                    <input {...getInputPhotos()} />
                    <Camera className="w-5 h-5 text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Subir Fotos</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {editingPhase?.project_phase_photos?.map(p => (<div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200"><img src={p.photo_url} className="w-full h-full object-cover" /></div>))}
                    {pendingPhotos.map((f, i) => (<div key={i} className="aspect-square rounded-lg overflow-hidden border border-indigo-200 relative"><img src={URL.createObjectURL(f)} className="w-full h-full object-cover" /><button type="button" onClick={() => setPendingPhotos(p => p.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5 text-red-500"><X className="w-2.5 h-2.5" /></button></div>))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500" /> Documentos de Obra</label>
                  <div {...getRootDocs()} className={cn("border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer", isDragDocs ? "border-indigo-500 bg-indigo-50" : "border-slate-200 dark:border-slate-800 hover:border-slate-300")}>
                    <input {...getInputDocs()} />
                    <Upload className="w-5 h-5 text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Subir Archivos</p>
                  </div>
                  <div className="space-y-1 mt-2">
                    {existingDocs.map(d => (<div key={d.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-medium"><span className="truncate flex-1">{d.file_name}</span><button type="button" onClick={() => deleteDoc(d.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button></div>))}
                    {pendingDocs.map((f, i) => (<div key={i} className="flex items-center justify-between p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-[10px] font-medium border border-indigo-100"><span className="truncate flex-1">{f.name}</span><button type="button" onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))} className="text-slate-400"><X className="w-3 h-3" /></button></div>))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notas de la fase</label><textarea value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs resize-none" placeholder="Observaciones..." /></div>
              <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-semibold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button><button type="submit" disabled={isUploading} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">{isUploading && <Loader2 className="w-4 h-4 animate-spin" />}{editingPhase ? 'Guardar' : 'Crear'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};