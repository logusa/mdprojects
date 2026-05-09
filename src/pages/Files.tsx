import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, File, Folder, Lock, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';

interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  shared_with: string;
  created_at: string;
}

const Files = () => {
  usePageTitle('Archivos');
  const { session } = useAuth();
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('files').select('*').order('created_at', { ascending: false });
    if (error) {
      showError('Error al cargar archivos');
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${session.user.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('workspace_files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('files').insert({
        name: file.name, size: file.size, type: file.type, path: filePath,
        shared_with: 'PRIVATE', user_id: session.user.id
      });
      if (dbError) throw dbError;

      showSuccess('Archivo subido exitosamente');
      fetchFiles();
    } catch (error: any) {
      showError(error.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteFile = async (id: string, path: string) => {
    try {
      await supabase.storage.from('workspace_files').remove([path]);
      await supabase.from('files').delete().eq('id', id);
      setFiles(files.filter(f => f.id !== id));
      showSuccess('Archivo eliminado');
    } catch (error) {
      showError('No se pudo eliminar el archivo');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Cloud Drive</h1>
          <p className="text-sm text-slate-500 mt-1">Almacenamiento seguro en la nube.</p>
        </div>
        
        <div className="w-full sm:w-auto">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 bg-indigo-600 text-white rounded-xl sm:rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-sm shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            {uploading ? 'Subiendo archivo...' : 'Subir Archivo'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center sm:items-center gap-3 cursor-pointer hover:border-indigo-300 transition-colors shadow-sm text-center sm:text-left">
            <Folder className="w-10 h-10 sm:w-8 sm:h-8 text-blue-400" fill="currentColor" opacity={0.2} />
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm sm:text-base">Global</p>
              <p className="text-[10px] sm:text-xs text-slate-400">Archivos compartidos</p>
            </div>
          </div>
          
          {files.map((file) => (
            <div key={file.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex flex-col gap-3 group relative transition-all hover:border-indigo-300 shadow-sm">
              <button 
                onClick={() => deleteFile(file.id, file.path)}
                className="absolute top-2 right-2 p-1.5 bg-red-100/80 text-red-600 rounded-lg sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 active:scale-90 z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="h-20 sm:h-24 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center relative">
                <File className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                {file.shared_with === 'PRIVATE' && (
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute bottom-2 right-2" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 flex justify-between mt-1">
                  <span className="font-medium">{formatSize(file.size)}</span>
                  <span className="uppercase tracking-wider">{file.shared_with}</span>
                </p>
              </div>
            </div>
          ))}

          {files.length === 0 && (
            <div className="col-span-full py-16 px-4 text-center text-slate-500 bg-white/50 border-2 border-dashed rounded-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <UploadCloud className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No hay archivos subidos</p>
              <p className="text-sm mt-1">Toca el botón superior para añadir tu primer documento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Files;