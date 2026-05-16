import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Users, Save, Loader2, Mail, Paintbrush, UploadCloud, Trash2, Camera, Building, UserPlus, Send, MessageSquare, LayoutTemplate, AlertTriangle, ToggleLeft, Lock } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
  birthday?: string;
  avatar_url?: string;
}

interface Department {
  id: string;
  name: string;
}

const Settings = () => {
  usePageTitle('Configuración');
  const { session } = useAuth();
  const { settings: globalSettings, refreshSettings } = useWhiteLabel();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'branding'>('profile');
  
  // --- Estado de Perfil ---
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // --- Estado de Contraseña ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  // --- Estado de Equipo y Departamentos ---
  const [team, setTeam] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDept, setInviteDept] = useState('');
  const [inviting, setInviting] = useState(false);

  // --- Estado de Marca Blanca ---
  const [brandingForm, setBrandingForm] = useState({ 
    app_name: '', logo_url: '', favicon_url: '', organization_domain: '',
    dashboard_desc: '', projects_desc: '', clients_desc: '', files_desc: '',
    label_dashboard: '', label_projects: '', label_clients: '', label_docs: '', label_files: '',
    enable_providers: true
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      fetchMyProfile();
      fetchTeamAndDepts();
    }
  }, [session]);

  useEffect(() => {
    if (globalSettings) {
      setBrandingForm({
        app_name: globalSettings.app_name || '',
        logo_url: globalSettings.logo_url || '',
        favicon_url: globalSettings.favicon_url || '',
        organization_domain: globalSettings.organization_domain || '',
        dashboard_desc: globalSettings.dashboard_desc || '',
        projects_desc: globalSettings.projects_desc || '',
        clients_desc: globalSettings.clients_desc || '',
        files_desc: globalSettings.files_desc || '',
        label_dashboard: globalSettings.label_dashboard || 'Dashboard',
        label_projects: globalSettings.label_projects || 'Proyectos',
        label_clients: globalSettings.label_clients || 'Clientes',
        label_docs: globalSettings.label_docs || 'Procesos',
        label_files: globalSettings.label_files || 'Archivos',
        enable_providers: globalSettings.enable_providers ?? true
      });
    }
  }, [globalSettings]);

  const fetchMyProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session?.user.id).single();
    if (data) setMyProfile({ ...data, email: session?.user.email });
  };

  const fetchTeamAndDepts = async () => {
    const [profilesRes, deptsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name')
    ]);
    if (profilesRes.data) setTeam(profilesRes.data);
    if (deptsRes.data) setDepartments(deptsRes.data);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ 
      first_name: myProfile.first_name, 
      last_name: myProfile.last_name,
      birthday: myProfile.birthday || null,
      avatar_url: myProfile.avatar_url
    }).eq('id', myProfile.id);
    setSavingProfile(false);
    if (error) showError('No se pudo guardar el perfil');
    else showSuccess('Perfil actualizado correctamente');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return showError('Las contraseñas no coinciden');
    }
    if (newPassword.length < 6) {
      return showError('La contraseña debe tener al menos 6 caracteres');
    }
    
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    
    if (error) {
      showError(error.message || 'Error al actualizar la contraseña');
    } else {
      showSuccess('Contraseña actualizada correctamente');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfile) return;
    
    setUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${myProfile.id}-${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', myProfile.id);
      setMyProfile({ ...myProfile, avatar_url: publicUrl });
      showSuccess('Avatar actualizado');
    } catch (err) {
      showError('Error al subir avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    if (myProfile?.role !== 'ADMIN') return;
    try {
      const { error } = await supabase.rpc('update_user_role', { target_user_id: targetUserId, new_role: newRole });
      if (error) throw error;
      showSuccess('Rol actualizado correctamente');
      fetchTeamAndDepts();
    } catch (err: any) {
      showError(err.message || 'Error al cambiar el rol');
    }
  };

  const handleDeleteUser = async (targetUserId: string, name: string) => {
    if (myProfile?.role !== 'ADMIN') return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${name || 'este usuario'} del sistema? Esta acción no se puede deshacer.`)) return;
    
    const toastId = showLoading('Eliminando usuario...');
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { target_user_id: targetUserId }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      showSuccess(`Usuario eliminado correctamente`);
      fetchTeamAndDepts();
    } catch (err: any) {
      showError(err.message || 'No se pudo eliminar el usuario');
    } finally {
      dismissToast(toastId);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const { data, error } = await supabase.from('departments').insert({ name: newDeptName }).select().single();
    if (error) showError('Error al crear departamento');
    else {
      showSuccess('Departamento creado');
      setDepartments([...departments, data]);
      setNewDeptName('');
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    
    // Verificación de dominio si está configurado
    if (isExternalEmail(inviteEmail)) {
      if (!window.confirm(`El correo ${inviteEmail} no pertenece al dominio de la organización (${globalSettings.organization_domain}). ¿Estás seguro de que quieres invitar a un usuario externo?`)) {
        return;
      }
    }

    setInviting(true);
    const toastId = showLoading('Enviando invitación...');
    
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, department_id: inviteDept || null }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      showSuccess(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      setInviteDept('');
      fetchTeamAndDepts();
    } catch (err: any) {
      showError(err.message || 'No se pudo enviar la invitación');
    } finally {
      dismissToast(toastId);
      setInviting(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(type);
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}-${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from('branding').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(fileName);
      
      setBrandingForm(prev => ({ ...prev, [type === 'logo' ? 'logo_url' : 'favicon_url']: publicUrl }));
      showSuccess('Imagen subida. Guarda para aplicar los cambios.');
    } catch (err) {
      showError('Error al subir la imagen');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    
    // Limpiar el dominio
    let cleanDomain = brandingForm.organization_domain.trim().toLowerCase();
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^@/, '').split('/')[0];

    const { error } = await supabase.from('workspace_settings').update({
      app_name: brandingForm.app_name,
      logo_url: brandingForm.logo_url || null,
      favicon_url: brandingForm.favicon_url || null,
      organization_domain: cleanDomain,
      dashboard_desc: brandingForm.dashboard_desc,
      projects_desc: brandingForm.projects_desc,
      clients_desc: brandingForm.clients_desc,
      files_desc: brandingForm.files_desc,
      label_dashboard: brandingForm.label_dashboard,
      label_projects: brandingForm.label_projects,
      label_clients: brandingForm.label_clients,
      label_docs: brandingForm.label_docs,
      label_files: brandingForm.label_files,
      enable_providers: brandingForm.enable_providers,
    }).eq('id', 1);

    setSavingBranding(false);
    if (error) showError('Error al guardar la configuración');
    else {
      showSuccess('Configuración visual y de seguridad actualizada');
      refreshSettings();
    }
  };

  const isExternalEmail = (email: string) => {
    if (!globalSettings?.organization_domain || !email) return false;
    const cleanDomain = globalSettings.organization_domain.toLowerCase();
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain !== cleanDomain;
  };

  const getTabClass = (tabName: string) => {
    const isActive = activeTab === tabName;
    return cn(
      "flex items-center justify-start sm:justify-center gap-3 px-5 py-3.5 sm:py-2.5 rounded-xl sm:rounded-md text-sm font-medium transition-all w-full sm:w-auto sm:flex-1 border",
      isActive
        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300 sm:bg-white sm:border-transparent sm:text-slate-900 sm:dark:bg-slate-700 sm:dark:text-white sm:shadow-sm"
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 sm:bg-transparent sm:border-transparent sm:text-slate-500 sm:hover:bg-slate-200/50 sm:dark:bg-transparent sm:dark:hover:bg-slate-700/50"
    );
  };

  if (!myProfile) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tus preferencias y ajustes del sistema.</p>
      </div>

      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center bg-transparent sm:bg-slate-100 sm:dark:bg-slate-800/80 rounded-lg sm:p-1 gap-2 sm:gap-1">
          <button onClick={() => setActiveTab('profile')} className={getTabClass('profile')}>
            <User className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Mi Perfil
          </button>
          
          <button onClick={() => setActiveTab('team')} className={getTabClass('team')}>
            <Users className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Equipo & Grupos
          </button>
          
          {myProfile.role === 'ADMIN' && (
            <button onClick={() => setActiveTab('branding')} className={getTabClass('branding')}>
              <Paintbrush className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Configuración Global
            </button>
          )}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información Personal</h2>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800 text-center sm:text-left">
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative group w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-3xl font-bold border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-pointer overflow-hidden mx-auto sm:mx-0 shrink-0"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  ) : myProfile.avatar_url ? (
                    <img src={myProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{myProfile.first_name?.[0] || 'U'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <Camera className="w-6 h-6" />
                  </div>
                </div>
                <input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={handleAvatarUpload} />
                
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Rol en el Workspace</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full w-max mx-auto sm:mx-0">
                    {myProfile.role === 'ADMIN' ? <Shield className="w-4 h-4 text-emerald-500 shrink-0" /> : <User className="w-4 h-4 text-blue-500 shrink-0" />}
                    <span className="text-sm font-semibold">{myProfile.role}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                  <input type="text" value={myProfile.first_name || ''} onChange={(e) => setMyProfile({...myProfile, first_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos</label>
                  <input type="text" value={myProfile.last_name || ''} onChange={(e) => setMyProfile({...myProfile, last_name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha de Nacimiento</label>
                  <input type="date" value={myProfile.birthday || ''} onChange={(e) => setMyProfile({...myProfile, birthday: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="email" disabled value={myProfile.email || ''} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={savingProfile} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Save className="w-4 h-4 shrink-0" />} Guardar Cambios
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-500" /> Seguridad
              </h2>
              <p className="text-sm text-slate-500 mt-1">Actualiza tu contraseña de acceso.</p>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nueva Contraseña</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="Escribe la nueva contraseña"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    required 
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Contraseña</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="Repite la nueva contraseña"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    required 
                    minLength={6}
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={updatingPassword || !newPassword || !confirmPassword} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm">
                  {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Lock className="w-4 h-4 shrink-0" />} Actualizar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Building className="w-5 h-5 text-indigo-500 shrink-0" /> Departamentos
              </h2>
              <div className="space-y-3 mb-6">
                {departments.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 font-medium text-sm text-slate-700 dark:text-slate-300">
                    {d.name}
                  </div>
                ))}
                {departments.length === 0 && <p className="text-sm text-slate-400 italic">No hay departamentos</p>}
              </div>

              {myProfile.role === 'ADMIN' && (
                <form onSubmit={handleCreateDepartment} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nuevo Departamento</label>
                  <div className="flex gap-2">
                    <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Ej. Marketing" className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-w-0" />
                    <button type="submit" disabled={!newDeptName} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0">Crear</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {myProfile.role === 'ADMIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-emerald-500 shrink-0" /> Invitar al Workspace
                </h2>
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="sm:col-span-5 space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo del invitado</label>
                      <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="correo@empresa.com" className={cn("w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors", isExternalEmail(inviteEmail) ? "border-amber-300 dark:border-amber-700/50" : "border-slate-200 dark:border-slate-800")} />
                    </div>
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asignar Departamento</label>
                      <select value={inviteDept} onChange={e => setInviteDept(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Sin departamento</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <button type="submit" disabled={inviting || !inviteEmail} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Send className="w-4 h-4 shrink-0" />} Invitar
                      </button>
                    </div>
                  </div>
                  
                  {isExternalEmail(inviteEmail) && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-sm animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Atención: Estás invitando a un usuario externo a la organización ({inviteEmail.split('@')[1]}).</span>
                    </div>
                  )}
                </form>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Directorio de Miembros</h3>
              </div>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">Usuario</th>
                      <th className="px-6 py-4 font-medium">Email / Dominio</th>
                      <th className="px-6 py-4 font-medium">Privilegios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {team.map((user) => {
                      const isExternal = isExternalEmail(user.email || '');
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs shrink-0">
                                  {user.first_name?.[0] || 'U'}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                  {user.first_name || 'Sin Nombre'} {user.last_name || ''}
                                  {isExternal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:border-orange-800">EXTERNO</span>}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{user.email || 'No registrado'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {myProfile.role === 'ADMIN' && user.id !== myProfile.id ? (
                                <>
                                  <select 
                                    value={user.role} onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                    className={cn("text-xs font-semibold rounded-lg px-3 py-1.5 outline-none border cursor-pointer", user.role === 'ADMIN' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700")}
                                  >
                                    <option value="MEMBER">MEMBER</option>
                                    <option value="ADMIN">ADMIN</option>
                                  </select>
                                  <button 
                                    onClick={() => handleDeleteUser(user.id, user.first_name)} 
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="Eliminar miembro"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <span className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg border", user.role === 'ADMIN' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700")}>{user.role}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branding' && myProfile.role === 'ADMIN' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
               <Shield className="w-5 h-5 text-indigo-500" /> Configuración Global
            </h2>
            <p className="text-sm text-slate-500 mt-1">Adapta la apariencia global del sistema y establece políticas de seguridad.</p>
          </div>
          
          <form onSubmit={handleSaveBranding} className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Aplicación</label>
                <input 
                  type="text" 
                  value={brandingForm.app_name} 
                  onChange={(e) => setBrandingForm({...brandingForm, app_name: e.target.value})}
                  placeholder="Ej. Mi Empresa CRM"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-500">Aparecerá en la pantalla de acceso y en las pestañas.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  Dominio de la Organización <Shield className="w-3.5 h-3.5 text-indigo-500" />
                </label>
                <input 
                  type="text" 
                  value={brandingForm.organization_domain} 
                  onChange={(e) => setBrandingForm({...brandingForm, organization_domain: e.target.value})}
                  placeholder="Ej. miempresa.com"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-xs text-slate-500">Se usará para detectar y advertir cuando se comparta información con externos (correos que no coincidan).</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <ToggleLeft className="w-5 h-5 text-indigo-500" /> Módulos Activos
              </h3>
              
              <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Directorio de Proveedores</p>
                  <p className="text-sm text-slate-500">Habilita la gestión del directorio para tus proveedores.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={brandingForm.enable_providers}
                  onClick={() => setBrandingForm({ ...brandingForm, enable_providers: !brandingForm.enable_providers })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    brandingForm.enable_providers ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      brandingForm.enable_providers ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Logotipo Principal</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                    {brandingForm.logo_url ? (
                      <img src={brandingForm.logo_url} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Paintbrush className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input type="file" accept="image/*" className="hidden" ref={logoInputRef} onChange={(e) => handleImageUpload(e, 'logo')} />
                    <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingImage === 'logo'} className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors w-full flex items-center justify-center gap-2">
                      {uploadingImage === 'logo' ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <UploadCloud className="w-4 h-4 shrink-0" />} <span className="truncate">Subir Logo</span>
                    </button>
                    {brandingForm.logo_url && (
                      <button type="button" onClick={() => setBrandingForm({...brandingForm, logo_url: ''})} className="text-xs text-red-500 hover:text-red-600 mt-2 flex items-center gap-1 mx-auto">
                        <Trash2 className="w-3 h-3 shrink-0" /> Eliminar logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Icono Pestaña (Favicon)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                    {brandingForm.favicon_url ? (
                      <img src={brandingForm.favicon_url} alt="Favicon Preview" className="w-8 h-8 object-contain" />
                    ) : (
                      <Paintbrush className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input type="file" accept="image/*" className="hidden" ref={faviconInputRef} onChange={(e) => handleImageUpload(e, 'favicon')} />
                    <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingImage === 'favicon'} className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors w-full flex items-center justify-center gap-2">
                      {uploadingImage === 'favicon' ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <UploadCloud className="w-4 h-4 shrink-0" />} <span className="truncate">Subir Favicon</span>
                    </button>
                    {brandingForm.favicon_url && (
                      <button type="button" onClick={() => setBrandingForm({...brandingForm, favicon_url: ''})} className="text-xs text-red-500 hover:text-red-600 mt-2 flex items-center gap-1 mx-auto">
                        <Trash2 className="w-3 h-3 shrink-0" /> Eliminar favicon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <LayoutTemplate className="w-5 h-5 text-indigo-500" /> Nombres del Menú y Cabecera
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sección Principal</label>
                  <input 
                    type="text" 
                    value={brandingForm.label_dashboard} 
                    onChange={(e) => setBrandingForm({...brandingForm, label_dashboard: e.target.value})}
                    placeholder="Dashboard"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sección Tareas</label>
                  <input 
                    type="text" 
                    value={brandingForm.label_projects} 
                    onChange={(e) => setBrandingForm({...brandingForm, label_projects: e.target.value})}
                    placeholder="Proyectos"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sección Contactos</label>
                  <input 
                    type="text" 
                    value={brandingForm.label_clients} 
                    onChange={(e) => setBrandingForm({...brandingForm, label_clients: e.target.value})}
                    placeholder="Clientes"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sección Documentos</label>
                  <input 
                    type="text" 
                    value={brandingForm.label_docs} 
                    onChange={(e) => setBrandingForm({...brandingForm, label_docs: e.target.value})}
                    placeholder="Procesos"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sección Almacenamiento</label>
                  <input 
                    type="text" 
                    value={brandingForm.label_files} 
                    onChange={(e) => setBrandingForm({...brandingForm, label_files: e.target.value})}
                    placeholder="Archivos"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-indigo-500" /> Textos y Descripciones
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtítulo del Dashboard</label>
                  <textarea 
                    value={brandingForm.dashboard_desc} 
                    onChange={(e) => setBrandingForm({...brandingForm, dashboard_desc: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtítulo de Proyectos</label>
                  <textarea 
                    value={brandingForm.projects_desc} 
                    onChange={(e) => setBrandingForm({...brandingForm, projects_desc: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtítulo de Clientes</label>
                  <textarea 
                    value={brandingForm.clients_desc} 
                    onChange={(e) => setBrandingForm({...brandingForm, clients_desc: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtítulo de Archivos</label>
                  <textarea 
                    value={brandingForm.files_desc} 
                    onChange={(e) => setBrandingForm({...brandingForm, files_desc: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={savingBranding || !brandingForm.app_name} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 shadow-sm">
                {savingBranding ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Save className="w-4 h-4 shrink-0" />} Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;