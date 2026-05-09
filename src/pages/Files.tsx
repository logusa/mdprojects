import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, File, Folder, Lock, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '../components/auth/AuthProvider';

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
      // 1. Subir al Storage
      const { error: uploadError } = await supabase.storage
        .from('workspace_files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Guardar Metadatos
      const { error: dbError } = await supabase.from('files').insert({
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
        shared_with: 'PRIVATE', // Por defecto privado
        user_id: session.user.id
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
      // Borrar de storage
      await supabase.storage.from('workspace_files').remove([path]);
      // Borrar metadatos
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Drive</h1>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {uploading ? 'Subiendo...' : 'Subir Archivo'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
            <Folder className="w-8 h-8 text-blue-400" fill="currentColor" opacity={0.2} />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">Global</p>
              <p className="text-xs text-slate-400">Archivos compartidos</p>
            </div>
          </div>
          
          {files.map((file) => (
            <div key={file.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3 group relative transition-all hover:border-indigo-300">
              <button 
                onClick={() => deleteFile(file.id, file.path)}
                className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center relative">
                <File className="w-10 h-10 text-indigo-400" />
                {file.shared_with === 'PRIVATE' && (
                  <Lock className="w-4 h-4 text-slate-500 absolute bottom-2 right-2" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 flex justify-between">
                  <span>{formatSize(file.size)}</span>
                  <span>{file.shared_with}</span>
                </p>
              </div>
            </div>
          ))}

          {files.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white/50 border border-dashed rounded-xl dark:border-slate-800 dark:bg-slate-900/50">
              No hay archivos subidos. Empieza arrastrando o usando el botón de subir.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Files;