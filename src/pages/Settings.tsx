import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Users, Save, Loader2, Mail, Paintbrush, UploadCloud, Trash2, Camera, Building, UserPlus, Send, MessageSquare, LayoutTemplate, AlertTriangle, ToggleLeft, Lock, Trash, PlusCircle, X } from 'lucide-react';
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
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${name || 'este usuario'}?`)) return;
    
    const toastId = showLoading('Eliminando usuario...');
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { target_user_id: targetUserId }
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      showSuccess(`Usuario eliminado`);
      fetchTeamAndDepts();
    } catch (err: any) {
      showError(err.message || 'Error al eliminar');
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
    
    setInviting(true);
    const toastId = showLoading('Enviando invitación...');
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, department_id: inviteDept || null }
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      showSuccess(`Invitación enviada`);
      setInviteEmail('');
      setInviteDept('');
      fetchTeamAndDepts();
    } catch (err: any) {
      showError(err.message || 'Error al invitar');
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
      showSuccess('Imagen cargada');
    } catch (err) {
      showError('Error al subir');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    const { error } = await supabase.from('workspace_settings').update({
      app_name: brandingForm.app_name,
      logo_url: brandingForm.logo_url || null,
      favicon_url: brandingForm.favicon_url || null,
      organization_domain: brandingForm.organization_domain,
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
    if (error) showError('Error al guardar');
    else {
      showSuccess('Configuración actualizada');
      refreshSettings();
    }
  };

  const getTabClass = (tabName: string) => cn(
    "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
    activeTab === tabName ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
  );

  if (!myProfile) return <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">Configuración</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tu identidad y los ajustes globales del workspace.</p>
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit overflow-x-auto hide-scrollbar max-w-full">
        <button onClick={() => setActiveTab('profile')} className={getTabClass('profile')}><User className="w-4 h-4" /> Mi Perfil</button>
        <button onClick={() => setActiveTab('team')} className={getTabClass('team')}><Users className="w-4 h-4" /> Equipo & Grupos</button>
        {myProfile.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('branding')} className={getTabClass('branding')}><Paintbrush className="w-4 h-4" /> Configuración Global</button>
        )}
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-50 dark:border-slate-800">
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative group w-24 h-24 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 text-3xl font-bold cursor-pointer overflow-hidden shrink-0"
                >
                  {uploadingAvatar ? <Loader2 className="w-8 h-8 animate-spin" /> : myProfile.avatar_url ? <img src={myProfile.avatar_url} className="w-full h-full object-cover" /> : <span>{myProfile.first_name[0]}</span>}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="text-white w-8 h-8" /></div>
                </div>
                <input type="file" ref={avatarInputRef} className="hidden" onChange={handleAvatarUpload} />
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{myProfile.first_name} {myProfile.last_name}</h3>
                  <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full w-fit">
                    {myProfile.role === 'ADMIN' ? <Shield className="w-4 h-4 text-emerald-500" /> : <User className="w-4 h-4 text-blue-500" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{myProfile.role}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre</label><input type="text" value={myProfile.first_name} onChange={e => setMyProfile({...myProfile, first_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Apellido</label><input type="text" value={myProfile.last_name || ''} onChange={e => setMyProfile({...myProfile, last_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Correo</label><input type="text" value={myProfile.email || ''} disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-400" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cumpleaños</label><input type="date" value={myProfile.birthday || ''} onChange={e => setMyProfile({...myProfile, birthday: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                </div>
                <div className="pt-4 flex justify-end"><button type="submit" disabled={savingProfile} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700">{savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Guardar Perfil</button></div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6"><Lock className="w-5 h-5 text-indigo-500" /> Seguridad</h3>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nueva Contraseña</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none" required /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none" required /></div>
                  <button type="submit" disabled={updatingPassword} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all">Actualizar Acceso</button>
                </form>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-8 py-5">Colaborador</th><th className="px-8 py-5">Rol / Permisos</th><th className="px-8 py-5 text-right">Acción</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {team.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50/50 group transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 overflow-hidden">{member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : <span>{member.first_name[0]}</span>}</div>
                            <div><p className="text-sm font-bold text-slate-800 dark:text-white">{member.first_name} {member.last_name}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{member.email}</p></div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                           {myProfile.role === 'ADMIN' && member.id !== myProfile.id ? (
                             <select value={member.role} onChange={e => handleChangeRole(member.id, e.target.value)} className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-black px-3 py-1.5 focus:ring-2 focus:ring-indigo-500"><option value="MEMBER">MEMBER</option><option value="ADMIN">ADMIN</option></select>
                           ) : <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">{member.role}</span>}
                        </td>
                        <td className="px-8 py-5 text-right">
                           {myProfile.role === 'ADMIN' && member.id !== myProfile.id && (
                             <button onClick={() => handleDeleteUser(member.id, member.first_name)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash className="w-4 h-4" /></button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6"><UserPlus className="w-5 h-5 text-indigo-500" /> Invitar Equipo</h3>
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label><input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none" required placeholder="nombre@empresa.com" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departamento</label><select value={inviteDept} onChange={e => setInviteDept(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none appearance-none"><option value="">-- Sin Departamento --</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <button type="submit" disabled={inviting} className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">{inviting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar Invitación</>}</button>
                </form>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6"><Building className="w-5 h-5 text-indigo-500" /> Grupos de Trabajo</h3>
                <form onSubmit={handleCreateDepartment} className="flex gap-2 mb-6"><input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="Ej. Arquitectura" /><button type="submit" className="p-2 bg-slate-900 text-white rounded-xl"><PlusCircle className="w-5 h-5" /></button></form>
                <div className="space-y-2">{departments.map(d => (<div key={d.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{d.name}</span><button onClick={() => { if (window.confirm('¿Eliminar grupo?')) supabase.from('departments').delete().eq('id', d.id).then(fetchTeamAndDepts); }} className="p-1 text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button></div>))}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branding' && myProfile.role === 'ADMIN' && (
        <form onSubmit={handleSaveBranding} className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-8">
              <div><h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg mb-6"><Paintbrush className="w-6 h-6 text-indigo-500" /> Identidad Visual</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo Principal</label>
                    <div onClick={() => logoInputRef.current?.click()} className="h-24 w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer group hover:border-indigo-400 transition-all overflow-hidden">{uploadingImage === 'logo' ? <Loader2 className="animate-spin text-indigo-500" /> : brandingForm.logo_url ? <img src={brandingForm.logo_url} className="h-full object-contain p-2" /> : <UploadCloud className="w-6 h-6 text-slate-300" />}</div>
                    <input type="file" ref={logoInputRef} className="hidden" onChange={e => handleImageUpload(e, 'logo')} />
                  </div>
                  <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Favicon (32x32)</label>
                    <div onClick={() => faviconInputRef.current?.click()} className="h-24 w-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer group hover:border-indigo-400 transition-all overflow-hidden mx-auto">{uploadingImage === 'favicon' ? <Loader2 className="animate-spin text-indigo-500" /> : brandingForm.favicon_url ? <img src={brandingForm.favicon_url} className="w-12 h-12" /> : <UploadCloud className="w-6 h-6 text-slate-300" />}</div>
                    <input type="file" ref={faviconInputRef} className="hidden" onChange={e => handleImageUpload(e, 'favicon')} />
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Aplicación</label><input type="text" value={brandingForm.app_name} onChange={e => setBrandingForm({...brandingForm, app_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 rounded-2xl font-bold outline-none" required /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Dominio de la Organización <Shield className="w-3 h-3 text-indigo-500" /></label><input type="text" value={brandingForm.organization_domain} onChange={e => setBrandingForm({...brandingForm, organization_domain: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="empresa.com" /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg mb-6"><LayoutTemplate className="w-6 h-6 text-indigo-500" /> Etiquetas Personalizadas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Proyectos</label><input type="text" value={brandingForm.label_projects} onChange={e => setBrandingForm({...brandingForm, label_projects: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Base Conocimiento</label><input type="text" value={brandingForm.label_docs} onChange={e => setBrandingForm({...brandingForm, label_docs: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Clientes</label><input type="text" value={brandingForm.label_clients} onChange={e => setBrandingForm({...brandingForm, label_clients: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">Cloud Drive</label><input type="text" value={brandingForm.label_files} onChange={e => setBrandingForm({...brandingForm, label_files: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm" /></div>
                </div>
                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                   <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">Módulo de Proveedores</p>
                      <p className="text-[10px] text-slate-500 font-medium">Habilitar directorio de suministros externos.</p>
                   </div>
                   <button type="button" onClick={() => setBrandingForm({...brandingForm, enable_providers: !brandingForm.enable_providers})} className={cn("w-12 h-6 rounded-full transition-all relative p-1", brandingForm.enable_providers ? "bg-indigo-600" : "bg-slate-300")}><div className={cn("w-4 h-4 bg-white rounded-full transition-all", brandingForm.enable_providers ? "ml-6" : "ml-0")} /></button>
                </div>
                <div className="pt-8 flex justify-end"><button type="submit" disabled={savingBranding} className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all">{savingBranding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aplicar Configuración'}</button></div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;