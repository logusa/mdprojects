"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Plus, ClipboardList, CloudRain, AlertTriangle, Image as ImageIcon, Search, Loader2, Calendar as CalendarIcon, User, MapPin, X, Save, Camera, Trash2, Building } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { ConstructionLog } from '../types/erp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ConstructionLogs = () => {
  usePageTitle('Bitácora de Obra');
  const { session } = useAuth();
  const [logs, setLogs] = useState<ConstructionLog[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    log_date: format(new Date(), 'yyyy-MM-dd'),
    content: '',
    weather: 'Despejado',
    incidents: ''
  });
  
  // Photos State
  const [tempPhotos, setTempPhotos] = useState<{file: File, preview: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      fetchLogs();
      fetchProjects();
    }
  }, [session]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('construction_logs')
      .select('*, projects(name), log_photos(id, photo_url)')
      .order('log_date', { ascending: false });
    
    if (error) showError('Error al cargar bitácoras');
    else if (data) setLogs(data as any);
    setLoading(false);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    if (data) setProjects(data);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setTempPhotos([...tempPhotos, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...tempPhotos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setTempPhotos(newPhotos);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project_id || !formData.content.trim() || !session) return;
    
    setIsSubmitting(true);
    const toastId = showLoading('Guardando reporte diario...');

    try {
      // 1. Insertar el log principal
      const { data: logData, error: logError } = await supabase
        .from('construction_logs')
        .insert({
          project_id: formData.project_id,
          user_id: session.user.id,
          log_date: formData.log_date,
          content: formData.content,
          weather: formData.weather,
          incidents: formData.incidents || null
        })
        .select()
        .single();

      if (logError) throw logError;

      // 2. Subir fotos si existen
      if (tempPhotos.length > 0 && logData) {
        for (const photo of tempPhotos) {
          const fileExt = photo.file.name.split('.').pop();
          const filePath = `logs/${logData.id}/${Math.random()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('workspace_files')
            .upload(filePath, photo.file);
          
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('workspace_files')
              .getPublicUrl(filePath);
              
            await supabase.from('log_photos').insert({
              log_id: logData.id,
              photo_url: publicUrl
            });
          }
        }
      }

      showSuccess('Reporte de bitácora guardado exitosamente');
      setIsModalOpen(false);
      setFormData({ project_id: '', log_date: format(new Date(), 'yyyy-MM-dd'), content: '', weather: 'Despejado', incidents: '' });
      setTempPhotos([]);
      fetchLogs();
    } catch (err) {
      showError('Error al guardar el reporte');
    } finally {
      setIsSubmitting(false);
      dismissToast(toastId);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" /> Bitácora de Obra
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Reportes diarios de avance e incidencias en sitio.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nuevo Reporte Diario
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay reportes de obra</p>
          <button onClick={() => setIsModalOpen(true)} className="text-emerald-600 hover:underline mt-2 text-sm font-medium">Crea el primer reporte</button>
        </div>
      ) : (
        <div className="space-y-6">
          {logs.map(log => (
            <div key={log.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                      {format(new Date(log.log_date), "EEEE, d 'de' MMMM", { locale: es })}
                    </h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{log.projects?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {log.weather && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold">
                      <CloudRain className="w-3.5 h-3.5" /> {log.weather}
                    </div>
                  )}
                  {log.incidents && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Incidencia
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                   <ClipboardList className="w-4 h-4" /> Resumen de Actividades
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{log.content}</p>
                
                {log.incidents && (
                  <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-xs uppercase mb-2">
                      <AlertTriangle className="w-4 h-4" /> Incidencias Reportadas
                    </div>
                    <p className="text-sm text-orange-800 dark:text-orange-300/80">{log.incidents}</p>
                  </div>
                )}

                {log.log_photos && log.log_photos.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                       <ImageIcon className="w-4 h-4" /> Evidencia en Sitio
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {log.log_photos.map(photo => (
                        <div key={photo.id} className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform cursor-pointer">
                          <img src={photo.photo_url} alt="Avance de obra" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo Reporte */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-emerald-500" /> Nuevo Reporte Diario
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-500" /> Proyecto
                  </label>
                  <select 
                    value={formData.project_id} 
                    onChange={e => setFormData({...formData, project_id: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    required
                  >
                    <option value="">Selecciona un proyecto</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-500" /> Fecha del Reporte
                  </label>
                  <input 
                    type="date" 
                    value={formData.log_date} 
                    onChange={e => setFormData({...formData, log_date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-emerald-500" /> Condición Climática
                </label>
                <select 
                  value={formData.weather} 
                  onChange={e => setFormData({...formData, weather: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option value="Despejado">☀️ Despejado</option>
                  <option value="Nublado">☁️ Nublado</option>
                  <option value="Lluvia Ligera">🌦️ Lluvia Ligera</option>
                  <option value="Lluvia Fuerte">🌧️ Lluvia Fuerte</option>
                  <option value="Tormenta">⛈️ Tormenta</option>
                  <option value="Vientos Fuertes">💨 Vientos Fuertes</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                   Actividades y Avances del Día
                </label>
                <textarea 
                  value={formData.content} 
                  onChange={e => setFormData({...formData, content: e.target.value})}
                  placeholder="Describe las tareas realizadas, personal presente, materiales recibidos..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> Incidentes o Retrasos (Opcional)
                </label>
                <textarea 
                  value={formData.incidents} 
                  onChange={e => setFormData({...formData, incidents: e.target.value})}
                  placeholder="Accidentes, fallas de equipo, falta de suministros..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none border-orange-100 dark:border-orange-900/30"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-500" /> Fotos de Evidencia
                  </label>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Añadir Fotos
                  </button>
                </div>
                
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoSelect} />
                
                {tempPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    {tempPhotos.map((photo, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group border border-slate-200 dark:border-slate-700 shadow-sm">
                        <img src={photo.preview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors"
                  >
                    <Camera className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs font-medium">Click para capturar o subir fotos del avance</p>
                  </div>
                )}
              </div>

              <div className="pt-4 shrink-0">
                <button 
                  type="submit" 
                  disabled={isSubmitting || !formData.project_id || !formData.content.trim()} 
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.99]"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Guardar Reporte Diario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstructionLogs;