"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ImageIcon, FileText, Loader2, ChevronLeft, ChevronRight, 
  X, Download, ExternalLink, Calendar, Search, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { showLoading, dismissToast, showError } from '@/utils/toast';

interface ProjectFilesProps {
  projectId: string;
}

export const ProjectFiles = ({ projectId }: ProjectFilesProps) => {
  const [activeTab, setActiveTab] = useState<'gallery' | 'docs'>('gallery');
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  
  // Lightbox state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  // Doc viewer state
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const [photosRes, docsRes] = await Promise.all([
        supabase.from('project_phase_photos')
          .select('*, project_phases(name, start_date)')
          .eq('project_phases.project_id', projectId)
          .order('created_at', { ascending: true }),
        supabase.from('project_phase_docs')
          .select('*, project_phases(name, start_date)')
          .eq('project_phases.project_id', projectId)
          .order('created_at', { ascending: false })
      ]);

      // Filtrar resultados nulos causados por el join si la fase no pertenece (aunque el query ya lo hace)
      setPhotos(photosRes.data?.filter(p => p.project_phases) || []);
      setDocs(docsRes.data?.filter(d => d.project_phases) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (path: string, fileName: string) => {
    const toastId = showLoading('Descargando...');
    try {
      const { data, error } = await supabase.storage.from('workspace_files').download(path.split('/').slice(-3).join('/'));
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      dismissToast(toastId);
    } catch (err) {
      showError('Error al descargar');
      dismissToast(toastId);
    }
  };

  const openDocPreview = async (doc: any) => {
    const toastId = showLoading('Abriendo vista previa...');
    try {
      const path = doc.file_url.split('/').slice(-3).join('/');
      const { data, error } = await supabase.storage.from('workspace_files').createSignedUrl(path, 3600);
      if (error) throw error;
      setDocUrl(data.signedUrl);
      setSelectedDoc(doc);
    } catch (err) {
      showError('No se pudo generar la vista previa');
    } finally {
      dismissToast(toastId);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('gallery')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'gallery' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500"
          )}
        >
          <ImageIcon className="w-4 h-4" /> Galería de Fotos
        </button>
        <button 
          onClick={() => setActiveTab('docs')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'docs' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500"
          )}
        >
          <FileText className="w-4 h-4" /> Documentos de Obra
        </button>
      </div>

      <div className="flex-1">
        {activeTab === 'gallery' ? (
          photos.length === 0 ? (
            <EmptyState icon={<ImageIcon className="w-12 h-12" />} title="Sin fotografías" message="No se han subido fotos a ninguna de las fases de este proyecto." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  onClick={() => setSelectedPhotoIndex(index)}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 group cursor-pointer relative hover:shadow-lg transition-all"
                >
                  <img src={photo.photo_url} alt="Avance" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-[10px] text-white font-bold truncate">{photo.project_phases?.name}</p>
                    <p className="text-[8px] text-slate-300">{format(new Date(photo.created_at), 'dd MMM, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          docs.length === 0 ? (
            <EmptyState icon={<FileText className="w-12 h-12" />} title="Sin documentos" message="No hay planos, permisos o informes vinculados a las fases." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc) => (
                <div key={doc.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center gap-4 group hover:border-indigo-400 transition-all cursor-pointer" onClick={() => openDocPreview(doc)}>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate" title={doc.file_name}>{doc.file_name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">{doc.project_phases?.name}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(doc.file_url, doc.file_name); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Lightbox Galería */}
      {selectedPhotoIndex !== null && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <button onClick={() => setSelectedPhotoIndex(null)} className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors z-50">
            <X className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setSelectedPhotoIndex(prev => prev! > 0 ? prev! - 1 : photos.length - 1)}
            className="absolute left-6 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-12 h-12" />
          </button>

          <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
            <img 
              src={photos[selectedPhotoIndex].photo_url} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain shadow-2xl" 
            />
            <div className="mt-6 text-center">
              <p className="text-white font-bold text-lg">{photos[selectedPhotoIndex].project_phases?.name}</p>
              <p className="text-white/50 text-sm mt-1">{format(new Date(photos[selectedPhotoIndex].created_at), 'PPP', { locale: es })}</p>
            </div>
          </div>

          <button 
            onClick={() => setSelectedPhotoIndex(prev => prev! < photos.length - 1 ? prev! + 1 : 0)}
            className="absolute right-6 text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight className="w-12 h-12" />
          </button>
        </div>
      )}

      {/* Visor de Documentos */}
      {selectedDoc && docUrl && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><FileText className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white truncate max-w-xs">{selectedDoc.file_name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{selectedDoc.project_phases?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownload(selectedDoc.file_url, selectedDoc.file_name)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                  <Download className="w-4 h-4" /> Descargar
                </button>
                <button onClick={() => { setSelectedDoc(null); setDocUrl(null); }} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-6">
              {selectedDoc.file_type?.includes('pdf') || selectedDoc.file_url.toLowerCase().endsWith('.pdf') ? (
                <iframe src={docUrl} className="w-full h-full rounded-2xl border-0 bg-white" />
              ) : selectedDoc.file_type?.startsWith('image/') ? (
                 <div className="w-full h-full flex items-center justify-center">
                    <img src={docUrl} className="max-w-full max-h-full object-contain" />
                 </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10">
                  <FileText className="w-20 h-20 text-slate-300 mb-6" />
                  <h4 className="text-xl font-bold text-slate-700 dark:text-slate-300">Vista previa no disponible</h4>
                  <p className="text-slate-500 max-w-xs mt-2 mb-8">Este tipo de archivo ({selectedDoc.file_type || 'Desconocido'}) no puede visualizarse directamente en el navegador.</p>
                  <button onClick={() => handleDownload(selectedDoc.file_url, selectedDoc.file_name)} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg">Descargar para ver</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode, title: string, message: string }) => (
  <div className="py-20 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
    <div className="text-slate-300 dark:text-slate-700 mx-auto mb-4 flex justify-center">{icon}</div>
    <h4 className="text-slate-800 dark:text-white font-bold">{title}</h4>
    <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">{message}</p>
  </div>
);