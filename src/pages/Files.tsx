import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, File, Folder, Lock, Trash2, Loader2, FolderPlus, ChevronRight, Share2, Pencil, X, Users, ShieldAlert } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
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
  email?: string;
  avatar_url?: string;
}

const Files = () => {
  usePageTitle('Archivos');
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  
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

  useEffect(() => {
    const init = async () => {
      if (session) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data?.role === 'ADMIN') setIsAdmin(true);
        
        const { data: profs } = await supabase.from('profiles').select('id, first_name, last_name, email, avatar_url');
        if (profs) setProfiles(profs);
      }
      fetchFiles();
    };
    init();
  }, [session, currentFolder]);

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

  const isExternalEmail = (email: string | undefined) => {
    if (!settings?.organization_domain || !email) return false;
    const cleanDomain = settings.organization_domain.toLowerCase();
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain !== cleanDomain;
  };

  const shareItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTarget || !isAdmin) return;
    
    // Verificación de seguridad: Correos externos
    if (settings.organization_domain) {
      const externalSelected = profiles.filter(p => selectedUsers.includes(p.id) && isExternalEmail(p.email));
      if (externalSelected.length > 0) {
        const warningMessage = `Estás a punto de compartir "${shareTarget.name}" con usuarios externos a la organización (${settings.organization_domain}).\n\n¿Estás completamente seguro de que deseas otorgarles acceso?`;
        if (!window.confirm(warningMessage)) return;
      }
    }

    setIsSubmitting(true);

    const { error } = await supabase.from('files').update({ shared_users: selectedUsers }).eq('id', shareTarget.id);
    
    if (error) {
      showError('Error al compartir');
    } else {
      showSuccess('Permisos de compartición actualizados');
      setIsShareModalOpen(false);
      fetchFiles();
    }
    setIsSubmitting(false);
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

      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto hide-scrollbar">
        <button onClick={() => navigateUp(-1)} className={cn("font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap", breadcrumbs.length === 0 && "text-indigo-600 dark:text-indigo-400")}>
          Cloud Drive
        </button>
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={b.id}>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            <button onClick={() => navigateUp(i)} className={cn("font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap", i === breadcrumbs.length - 1 && "text-indigo-600 dark:text-indigo-400")}>
              {b.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          
          {currentFolder && (
            <div onClick={() => navigateUp(breadcrumbs.length - 2)} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
              <Folder className="w-10 h-10 text-slate-400" fill="currentColor" opacity={0.2} />
              <p className="font-medium text-slate-600 dark:text-slate-300 text-sm">Volver</p>
            </div>
          )}

          {files.map((file) => {
            const isFolder = file.type === 'folder';
            const hasSharedUsers = file.shared_users && file.shared_users.length > 0;
            
            return (
              <div 
                key={file.id} 
                onClick={() => isFolder ? navigateToFolder(file.id, file.name) : null}
                className={cn(
                  "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl flex flex-col gap-3 group relative transition-all shadow-sm",
                  isFolder ? "cursor-pointer hover:border-indigo-400 hover:shadow-md" : "hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-slate-100 dark:border-slate-800">
                    <button onClick={(e) => openShareModal(file, e)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-md" title="Compartir"><Share2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => openRenameModal(file, e)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md" title="Renombrar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => deleteFile(file.id, file.path, file.type, e)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                
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
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]" title={shareTarget.name}>{shareTarget.name}</p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={shareItem} className="p-5">
              <div className="flex justify-between items-end mb-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Selecciona los usuarios:</p>
                {settings.organization_domain && (
                  <p className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    Dominio protegido: {settings.organization_domain}
                  </p>
                )}
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 mb-5">
                {profiles.map(user => {
                  if (user.id === shareTarget.user_id) return null; // No mostrar al dueño
                  const isExternal = isExternalEmail(user.email);
                  
                  return (
                    <label key={user.id} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border", isExternal ? "hover:bg-orange-50/50 dark:hover:bg-orange-900/20 border-transparent hover:border-orange-200 dark:hover:border-orange-900" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700")}>
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                          else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }}
                        className={cn("w-4 h-4 rounded focus:ring-offset-0", isExternal ? "border-orange-300 text-orange-600 focus:ring-orange-500" : "border-slate-300 text-indigo-600 focus:ring-indigo-500")} 
                      />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {user.first_name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{user.first_name} {user.last_name}</span>
                          <span className="text-xs text-slate-500 truncate">{user.email}</span>
                        </div>
                      </div>
                      {isExternal && (
                        <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:border-orange-800/50">
                          <ShieldAlert className="w-3 h-3" /> EXT
                        </div>
                      )}
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