import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Users, Save, Loader2, Mail, Paintbrush, UploadCloud, Trash2, Camera, Building, UserPlus, Send } from 'lucide-react';
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
  
  // Perfil
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Equipo y Departamentos
  const [team, setTeam] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDept, setInviteDept] = useState('');
  const [inviting, setInviting] = useState(false);

  // Branding
  const [brandingForm, setBrandingForm] = useState({ app_name: '', logo_url: '', favicon_url: '' });
  const [savingBranding, setSavingBranding] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        favicon_url: globalSettings.favicon_url || ''
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
      
      // Auto-guardar URL en BD
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', myProfile.id);
      setMyProfile({ ...myProfile, avatar_url: publicUrl });
      showSuccess('Avatar actualizado (Refresca para ver en toda la app)');
    } catch (err) {
      showError('Error al subir avatar');
    } finally {
      setUploadingAvatar(false);
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

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    const { error } = await supabase.from('workspace_settings').update({
      app_name: brandingForm.app_name,
      logo_url: brandingForm.logo_url || null,
      favicon_url: brandingForm.favicon_url || null
    }).eq('id', 1);

    setSavingBranding(false);
    if (error) showError('Error al guardar la marca blanca');
    else {
      showSuccess('Configuración visual actualizada');
      refreshSettings();
    }
  };

  if (!myProfile) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tus preferencias y ajustes del sistema.</p>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 w-full sm:w-max overflow-x-auto hide-scrollbar">
        <button onClick={() => setActiveTab('profile')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'profile' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700")}>
          <User className="w-4 h-4" /> Mi Perfil
        </button>
        <button onClick={() => setActiveTab('team')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'team' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700")}>
          <Users className="w-4 h-4" /> Equipo & Grupos
        </button>
        {myProfile.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('branding')} className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'branding' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700")}>
            <Paintbrush className="w-4 h-4" /> Marca Blanca
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información Personal</h2>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div 
                onClick={() => avatarInputRef.current?.click()}
                className="relative group w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-3xl font-bold border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-pointer overflow-hidden"
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
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full w-max">
                  {myProfile.role === 'ADMIN' ? <Shield className="w-4 h-4 text-emerald-500" /> : <User className="w-4 h-4 text-blue-500" />}
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
              <button type="submit" disabled={savingProfile} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          {/* Lado Izquierdo: Departamentos */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Building className="w-5 h-5 text-indigo-500" /> Departamentos
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
                    <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Ej. Marketing" className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button type="submit" disabled={!newDeptName} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Crear</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Lado Derecho: Usuarios e Invitaciones */}
          <div className="lg:col-span-2 space-y-6">
            {myProfile.role === 'ADMIN' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-emerald-500" /> Invitar al Workspace
                </h2>
                <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo del invitado</label>
                    <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="correo@empresa.com" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
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
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Invitar
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">Miembros Activos</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                {team.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                          {user.first_name?.[0] || 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {user.first_name || 'Invitado'} {user.last_name || ''}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">{user.id.split('-')[0]}</p>
                      </div>
                    </div>
                    <div>
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-md border", user.role === 'ADMIN' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200")}>
                        {user.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branding' && myProfile.role === 'ADMIN' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personalización (Marca Blanca)</h2>
          </div>
          <form onSubmit={handleSaveBranding} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre de la Aplicación</label>
              <input type="text" value={brandingForm.app_name} onChange={(e) => setBrandingForm({...brandingForm, app_name: e.target.value})} required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={savingBranding || !brandingForm.app_name} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm">
                Guardar Personalización
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;