import React, { useState, useEffect, useRef } from 'react';
import { User, Shield, Users, Save, Loader2, Mail, Paintbrush, UploadCloud, Trash2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
}

const Settings = () => {
  usePageTitle('Configuración');
  const { session } = useAuth();
  const { settings: globalSettings, refreshSettings } = useWhiteLabel();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'branding'>('profile');
  
  // Estado del perfil
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Estado del equipo
  const [team, setTeam] = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Estado de Branding (Marca Blanca)
  const [brandingForm, setBrandingForm] = useState({
    app_name: '',
    logo_url: '',
    favicon_url: ''
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'favicon' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      fetchMyProfile();
      fetchTeam();
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
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session?.user.id).single();
    if (data) setMyProfile({ ...data, email: session?.user.email });
  };

  const fetchTeam = async () => {
    setLoadingTeam(true);
    const { data } = await supabase.from('profiles').select('*').order('first_name');
    if (data) setTeam(data);
    setLoadingTeam(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ first_name: myProfile.first_name, last_name: myProfile.last_name }).eq('id', myProfile.id);
    setSavingProfile(false);
    if (error) showError('No se pudo guardar el perfil');
    else showSuccess('Perfil actualizado correctamente');
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    if (myProfile?.role !== 'ADMIN') return;
    try {
      const { error } = await supabase.rpc('update_user_role', { target_user_id: targetUserId, new_role: newRole });
      if (error) throw error;
      showSuccess('Rol actualizado correctamente');
      fetchTeam();
    } catch (err: any) {
      showError(err.message || 'Error al cambiar el rol');
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
    const { error } = await supabase.from('workspace_settings').update({
      app_name: brandingForm.app_name,
      logo_url: brandingForm.logo_url || null,
      favicon_url: brandingForm.favicon_url || null
    }).eq('id', 1);

    setSavingBranding(false);
    if (error) {
      showError('Error al guardar la marca blanca');
    } else {
      showSuccess('Configuración visual actualizada');
      refreshSettings(); // Actualizar el contexto global para reflejar inmediatamente
    }
  };

  if (!myProfile) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tus preferencias y ajustes del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 w-full sm:w-max overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'profile' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
        >
          <User className="w-4 h-4" /> Mi Perfil
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'team' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
        >
          <Users className="w-4 h-4" /> Gestión de Equipo
        </button>
        {myProfile.role === 'ADMIN' && (
          <button 
            onClick={() => setActiveTab('branding')}
            className={cn("flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0", activeTab === 'branding' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            <Paintbrush className="w-4 h-4" /> Marca Blanca
          </button>
        )}
      </div>

      {/* Contenido de Mi Perfil */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Información Personal</h2>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
            <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl font-bold border border-indigo-200 dark:border-indigo-800">
                {myProfile.first_name?.[0] || session?.user.email?.[0]?.toUpperCase() || 'U'}
              </div>
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
                <input 
                  type="text" value={myProfile.first_name || ''} onChange={(e) => setMyProfile({...myProfile, first_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos</label>
                <input 
                  type="text" value={myProfile.last_name || ''} onChange={(e) => setMyProfile({...myProfile, last_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" disabled value={myProfile.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={savingProfile} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 shadow-sm">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contenido de Equipo */}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Directorio del Workspace</h2>
              <p className="text-sm text-slate-500">Administra los accesos y roles.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuario</th>
                  <th className="px-6 py-4 font-medium">ID de Referencia</th>
                  <th className="px-6 py-4 font-medium">Privilegios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {team.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs">
                          {user.first_name?.[0] || 'U'}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {user.first_name || 'Sin Nombre'} {user.last_name || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{user.id.split('-')[0]}...</td>
                    <td className="px-6 py-4">
                      {myProfile.role === 'ADMIN' && user.id !== myProfile.id ? (
                        <select 
                          value={user.role} onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          className={cn("text-xs font-semibold rounded-lg px-3 py-1.5 outline-none border cursor-pointer", user.role === 'ADMIN' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700")}
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg border", user.role === 'ADMIN' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700")}>{user.role}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contenido Marca Blanca */}
      {activeTab === 'branding' && myProfile.role === 'ADMIN' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personalización (Marca Blanca)</h2>
            <p className="text-sm text-slate-500 mt-1">Adapta la apariencia global del sistema a tu propia marca.</p>
          </div>
          
          <form onSubmit={handleSaveBranding} className="p-6 space-y-8">
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
              <p className="text-xs text-slate-500">Este nombre aparecerá en la barra lateral, en la pantalla de acceso y en las pestañas del navegador.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Logo Upload */}
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
                  <div className="flex-1">
                    <input type="file" accept="image/*" className="hidden" ref={logoInputRef} onChange={(e) => handleImageUpload(e, 'logo')} />
                    <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingImage === 'logo'} className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors w-full flex items-center justify-center gap-2">
                      {uploadingImage === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Subir Logo
                    </button>
                    {brandingForm.logo_url && (
                      <button type="button" onClick={() => setBrandingForm({...brandingForm, logo_url: ''})} className="text-xs text-red-500 hover:text-red-600 mt-2 flex items-center gap-1 mx-auto">
                        <Trash2 className="w-3 h-3" /> Eliminar logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Favicon Upload */}
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
                  <div className="flex-1">
                    <input type="file" accept="image/*" className="hidden" ref={faviconInputRef} onChange={(e) => handleImageUpload(e, 'favicon')} />
                    <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingImage === 'favicon'} className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors w-full flex items-center justify-center gap-2">
                      {uploadingImage === 'favicon' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Subir Favicon
                    </button>
                    {brandingForm.favicon_url && (
                      <button type="button" onClick={() => setBrandingForm({...brandingForm, favicon_url: ''})} className="text-xs text-red-500 hover:text-red-600 mt-2 flex items-center gap-1 mx-auto">
                        <Trash2 className="w-3 h-3" /> Eliminar favicon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={savingBranding || !brandingForm.app_name} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 shadow-sm">
                {savingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar Personalización
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;