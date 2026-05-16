import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UploadCloud, File, Folder, Lock, Trash2, Loader2, FolderPlus, ChevronRight, Share2, Pencil, X, Users, ArrowLeft, Download } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { cn } from '@/lib/utils';

interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  shared_with: string;
  shared_users: string[];
  user_id: string;
  parent_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

const Files = () => {
  usePageTitle('Archivos');
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  const [searchParams] = useSearchParams();
  
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navegación de carpetas
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([]);

  // Modales
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FileMeta | null>(null);
  const [editName, setEditName] = useState('');

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<FileMeta | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visualizador
  const [selectedFileToView, setSelectedFileToView] = useState<FileMeta | null>(null);
  const [fileViewUrl, setFileViewUrl] = useState<string | null>(null);

  // Efecto que captura los IDs desde la URL (por notificaciones) solo una vez al montar
  useEffect(() => {
    const folderId = searchParams.get('folder');
    if (folderId) setCurrentFolder(folderId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      if (session) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data?.role === 'ADMIN') setIsAdmin(true);
        
        const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url');
        if (profs) setProfiles(profs);
      }
      fetchFiles();
    };
    init();
  }, [session, currentFolder]);

  // Si nos enviaron por URL el ID de un archivo específico para abrirlo
  useEffect(() => {
    const fileId = searchParams.get('file');
    if (fileId && files.length > 0 && !selectedFileToView) {
      const file = files.find(f => f.id === fileId);
      if (file) handleViewFile(file);
    }
  }, [files, searchParams]);

  const fetchFiles = async () => {
    setLoading(true);
    let query = supabase.from('files').select('*')
      .order('type', { ascending: false }) // 'folder' > 'application/pdf' etc.
      .order('name', { ascending: true });

    if (currentFolder) {
      query = query.eq('parent_id', currentFolder);
    } else {
      query = query.is('parent_id', null);
    }

    const { data, error } = await query;
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
        name: file.name, 
        size: file.size, 
        type: file.type, 
        path: filePath,
        shared_with: 'PRIVATE', 
        user_id: session.user.id,
        parent_id: currentFolder
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

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !session) return;
    setIsSubmitting(true);
    
    const { error } = await supabase.from('files').insert({
      name: newFolderName,
      size: 0,
      type: 'folder',
      path: `folder-${Date.now()}`,
      shared_with: 'PRIVATE',
      user_id: session.user.id,
      parent_id: currentFolder
    });

    if (error) {
      showError('Error al crear la carpeta');
    } else {
      showSuccess('Carpeta creada');
      setIsFolderModalOpen(false);
      setNewFolderName('');
      fetchFiles();
    }
    setIsSubmitting(false);
  };

  const deleteFile = async (id: string, path: string, type: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return showError('Solo los administradores pueden borrar archivos');
    if (!window.confirm(`¿Eliminar este ${type === 'folder' ? 'directorio' : 'archivo'}?`)) return;

    try {
      if (type !== 'folder') {
        await supabase.storage.from('workspace_files').remove([path]);
      }
      const { error } = await supabase.from('files').delete().eq('id', id);
      if (error) throw error;
      setFiles(files.filter(f => f.id !== id));
      showSuccess('Elemento eliminado');
    } catch (error) {
      showError('No se pudo eliminar el elemento');
    }
  };

  const renameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editName.trim() || !isAdmin) return;
    setIsSubmitting(true);

    const { error } = await supabase.from('files').update({ name: editName }).eq('id', editTarget.id);
    
    if (error) {
      showError('Error al renombrar');
    } else {
      showSuccess('Renombrado con éxito');
      setIsEditModalOpen(false);
      fetchFiles();
    }
    setIsSubmitting(false);
  };

  const shareItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTarget || !isAdmin) return;
    setIsSubmitting(true);

    const newUsersToNotify = selectedUsers.filter(userId => !(shareTarget.shared_users || []).includes(userId));

    const { error } = await supabase.from('files').update({ shared_users: selectedUsers }).eq('id', shareTarget.id);
    
    if (error) {
      showError('Error al compartir');
    } else {
      if (newUsersToNotify.length > 0) {
        const linkTarget = shareTarget.type === 'folder' 
          ? `/files?folder=${shareTarget.id}` 
          : `/files?file=${shareTarget.id}`;

        const notifications = newUsersToNotify.map(userId => ({
          user_id: userId,
          title: 'Acceso concedido',
          message: `Se te ha compartido el archivo o carpeta "${shareTarget.name}".`,
          link: linkTarget
        }));
        await supabase.from('notifications').insert(notifications);
      }

      showSuccess('Permisos de compartición actualizados');
      setIsShareModalOpen(false);
      fetchFiles();
    }
    setIsSubmitting(false);
  };

  const downloadFile = async (file: FileMeta) => {
    const toastId = showLoading('Iniciando descarga...');
    try {
      const { data, error } = await supabase.storage.from('workspace_files').download(file.path);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      dismissToast(toastId);
    } catch (err) {
      showError('Error al descargar el archivo');
      dismissToast(toastId);
    }
  };

  const handleViewFile = async (file: FileMeta) => {
    if (file.type === 'folder') return;
    
    const toastId = showLoading('Cargando previsualización...');
    try {
      const { data, error } = await supabase.storage.from('workspace_files').createSignedUrl(file.path, 3600);
      if (error) throw error;
      
      setFileViewUrl(data.signedUrl);
      setSelectedFileToView(file);
    } catch (err) {
      showError('Error al cargar el archivo');
    } finally {
      dismissToast(toastId);
    }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const navigateUp = (index: number) => {
    if (index === -1) {
      setCurrentFolder(null);
      setBreadcrumbs([]);
    } else {
      setCurrentFolder(breadcrumbs[index].id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  const openRenameModal = (file: FileMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return showError('Solo los administradores pueden editar');
    setEditTarget(file);
    setEditName(file.name);
    setIsEditModalOpen(true);
  };

  const openShareModal = (file: FileMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return showError('Solo los administradores pueden compartir');
    setShareTarget(file);
    setSelectedUsers(file.shared_users || []);
    setIsShareModalOpen(true);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '--';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" /> Bóveda Segura
          </h1>
          <p className="text-sm text-slate-500 mt-1">{settings.files_desc}</p>
        </div>
        
        <div className="w-full sm:w-auto flex items-center gap-2">
          <button 
            onClick={() => { setIsFolderModalOpen(true); setNewFolderName(''); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm border border-slate-200 dark:border-slate-700"
          >
            <FolderPlus className="w-4 h-4" /> Nueva Carpeta
          </button>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            Subir Archivo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto hide-scrollbar">
        {currentFolder && (
          <>
            <button 
              onClick={() => navigateUp(breadcrumbs.length - 2)} 
              className="flex items-center justify-center p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 shrink-0"
              title="Volver a la carpeta anterior"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-1"></div>
          </>
        )}
        <button onClick={() => navigateUp(-1)} className={cn("font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap px-2 py-1 rounded-md transition-colors", breadcrumbs.length === 0 && "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30")}>
          Cloud Drive
        </button>
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={b.id}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button onClick={() => navigateUp(i)} className={cn("font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap px-2 py-1 rounded-md transition-colors", i === breadcrumbs.length - 1 && "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30")}>
              {b.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          
          {files.map((file) => {
            const isFolder = file.type === 'folder';
            const hasSharedUsers = file.shared_users && file.shared_users.length > 0;
            
            return (
              <div 
                key={file.id} 
                onClick={() => isFolder ? navigateToFolder(file.id, file.name) : handleViewFile(file)}
                className={cn(
                  "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex flex-col gap-3 group relative transition-all shadow-sm",
                  "cursor-pointer hover:border-indigo-400 hover:shadow-md"
                )}
              >
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-slate-100 dark:border-slate-800">
                  {!isFolder && (
                    <button onClick={(e) => { e.stopPropagation(); downloadFile(file); }} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md" title="Descargar"><Download className="w-3.5 h-3.5" /></button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={(e) => openShareModal(file, e)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-md" title="Compartir"><Share2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => openRenameModal(file, e)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md" title="Renombrar"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => deleteFile(file.id, file.path, file.type, e)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
                
                <div className="h-20 sm:h-24 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center relative">
                  {isFolder ? (
                    <Folder className="w-12 h-12 text-blue-400" fill="currentColor" opacity={hasSharedUsers ? 0.7 : 0.4} />
                  ) : (
                    <File className="w-10 h-10 text-indigo-400" />
                  )}
                  {hasSharedUsers && (
                    <div className="absolute bottom-2 right-2 bg-white dark:bg-slate-900 p-1 rounded-full shadow-sm">
                      <Users className="w-3 h-3 text-emerald-500" />
                    </div>
                  )}
                  {!hasSharedUsers && file.shared_with === 'PRIVATE' && !isFolder && (
                    <Lock className="w-3 h-3 text-slate-400 absolute bottom-2 right-2" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-slate-400 flex justify-between mt-1">
                    <span className="font-medium">{formatSize(file.size)}</span>
                  </p>
                </div>
              </div>
            );
          })}

          {files.length === 0 && !currentFolder && (
            <div className="col-span-full py-16 px-4 text-center text-slate-500 bg-white/50 border-2 border-dashed rounded-2xl dark:border-slate-800 dark:bg-slate-900/50">
              <Folder className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">La bóveda está vacía</p>
              <p className="text-sm mt-1">Crea una carpeta o sube un archivo para empezar.</p>
            </div>
          )}
          
          {files.length === 0 && currentFolder && (
             <div className="col-span-full py-12 px-4 text-center text-slate-500">
               <p className="font-medium">Carpeta vacía</p>
             </div>
          )}
        </div>
      )}

      {selectedFileToView && fileViewUrl && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-6xl h-full max-h-[95vh] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <File className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white truncate" title={selectedFileToView.name}>{selectedFileToView.name}</h3>
                  <p className="text-xs text-slate-500">{formatSize(selectedFileToView.size)} • {selectedFileToView.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pl-2">
                {isAdmin && (
                  <button onClick={(e) => openShareModal(selectedFileToView, e as any)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors">
                    <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Compartir</span>
                  </button>
                )}
                <button onClick={() => downloadFile(selectedFileToView)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors">
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">Descargar</span>
                </button>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                <button onClick={() => { setSelectedFileToView(null); setFileViewUrl(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-100/50 dark:bg-slate-950 overflow-hidden relative flex items-center justify-center p-0 sm:p-4">
               {selectedFileToView.type.startsWith('image/') ? (
                 <img src={fileViewUrl} alt={selectedFileToView.name} className="max-w-full max-h-full object-contain rounded-lg drop-shadow-sm" />
               ) : selectedFileToView.type === 'application/pdf' ? (
                 <iframe src={fileViewUrl} className="w-full h-full rounded-none sm:rounded-lg shadow-sm border-0 sm:border border-slate-200 dark:border-slate-800 bg-white" />
               ) : selectedFileToView.type.startsWith('video/') ? (
                 <video src={fileViewUrl} controls className="max-w-full max-h-full rounded-lg shadow-md bg-black" />
               ) : selectedFileToView.type.startsWith('audio/') ? (
                 <audio src={fileViewUrl} controls className="w-full max-w-md shadow-md" />
               ) : (
                 <div className="text-center bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-sm w-full mx-4">
                   <File className="w-16 h-16 text-indigo-200 dark:text-indigo-900/50 mx-auto mb-4" />
                   <p className="text-slate-800 dark:text-slate-200 font-semibold text-lg">Vista previa no disponible</p>
                   <p className="text-slate-500 text-sm mt-2 mb-6">Este tipo de archivo ({selectedFileToView.type || 'Desconocido'}) no puede visualizarse directamente en el navegador.</p>
                   <button onClick={() => downloadFile(selectedFileToView)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                     <Download className="w-4 h-4" /> Descargar Archivo
                   </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Nueva Carpeta</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createFolder} className="p-5">
              <input 
                type="text" 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)} 
                placeholder="Nombre de la carpeta" 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-5" 
                autoFocus 
                required 
              />
              <button type="submit" disabled={isSubmitting || !newFolderName.trim()} className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Renombrar</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={renameFile} className="p-5">
              <input 
                type="text" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-5" 
                autoFocus 
                required 
              />
              <button type="submit" disabled={isSubmitting || !editName.trim()} className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isShareModalOpen && shareTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Compartir Acceso</h3>
                <p className="text-xs text-slate-500 mt-0.5">{shareTarget.name}</p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={shareItem} className="p-5">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Selecciona los usuarios:</p>
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 mb-5">
                {profiles.map(user => {
                  if (user.id === shareTarget.user_id) return null;
                  return (
                    <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                          else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {user.first_name?.[0] || 'U'}
                          </div>
                        )}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.first_name} {user.last_name}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Permisos'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Files;