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

  const tabsRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll para pestañas de configuración
  useEffect(() => {
    if (tabsRef.current) {
      const activeTabEl = tabsRef.current.querySelector('[data-active="true"]');
      if (activeTabEl) {
        activeTabEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);

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
      "flex items-center justify-start sm:justify-center gap-3 px-5 py-3.5 sm:py-2.5 rounded-xl sm:rounded-md text-sm font-medium transition-all w-full sm:w-auto sm:flex-1 border whitespace-nowrap",
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
        <div ref={tabsRef} className="flex flex-col sm:flex-row sm:items-center bg-transparent sm:bg-slate-100 sm:dark:bg-slate-800/80 rounded-lg sm:p-1 gap-2 sm:gap-1 overflow-x-auto hide-scrollbar max-w-full">
          <button onClick={() => setActiveTab('profile')} data-active={activeTab === 'profile'} className={getTabClass('profile')}>
            <User className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Mi Perfil
          </button>
          
          <button onClick={() => setActiveTab('team')} data-active={activeTab === 'team'} className={getTabClass('team')}>
            <Users className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Equipo & Grupos
          </button>
          
          {myProfile.role === 'ADMIN' && (
            <button onClick={() => setActiveTab('branding')} data-active={activeTab === 'branding'} className={getTabClass('branding')}>
              <Paintbrush className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /> Configuración Global
            </button>
          )}
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6 animate-in fade-in">
          {/* ... resto del componente permanece igual ... */}
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
          {/* ... resto del contenido ... */}
        </div>
      )}
      {/* ... resto de las pestañas permanecen iguales ... */}
    </div>
  );
};

export default Settings;