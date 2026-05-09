import React, { useState, useEffect } from 'react';
import { User, Shield, Users, Save, Loader2, Mail } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
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
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'team'>('profile');
  
  // Estado del perfil propio
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Estado del equipo
  const [team, setTeam] = useState<Profile[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (session) {
      fetchMyProfile();
      fetchTeam();
    }
  }, [session]);

  const fetchMyProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session?.user.id)
      .single();
      
    if (data) setMyProfile({ ...data, email: session?.user.email });
    if (error) console.error("Error fetching profile", error);
  };

  const fetchTeam = async () => {
    setLoadingTeam(true);
    const { data, error } = await supabase.from('profiles').select('*').order('first_name');
    if (data) setTeam(data);
    setLoadingTeam(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: myProfile.first_name, last_name: myProfile.last_name })
      .eq('id', myProfile.id);
      
    setSavingProfile(false);
    if (error) {
      showError('No se pudo guardar el perfil');
    } else {
      showSuccess('Perfil actualizado correctamente');
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    if (myProfile?.role !== 'ADMIN') return;
    
    try {
      // Llamada a la función Postgres definida para bypassear RLS de forma segura
      const { error } = await supabase.rpc('update_user_role', { 
        target_user_id: targetUserId, 
        new_role: newRole 
      });
      
      if (error) throw error;
      
      showSuccess('Rol actualizado correctamente');
      fetchTeam(); // Refrescar lista
    } catch (err: any) {
      showError(err.message || 'Error al cambiar el rol');
    }
  };

  if (!myProfile) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tus preferencias y los privilegios del equipo.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 w-full sm:w-max overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0",
            activeTab === 'profile' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <User className="w-4 h-4" /> Mi Perfil
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium transition-all shrink-0",
            activeTab === 'team' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Users className="w-4 h-4" /> Gestión de Equipo
        </button>
      </div>

      {/* Contenido de Mi Perfil */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
                  type="text" 
                  value={myProfile.first_name || ''}
                  onChange={(e) => setMyProfile({...myProfile, first_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos</label>
                <input 
                  type="text" 
                  value={myProfile.last_name || ''}
                  onChange={(e) => setMyProfile({...myProfile, last_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Tus apellidos"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    disabled
                    value={myProfile.email || ''}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500">El correo está vinculado a tu autenticación y no puede cambiarse desde aquí.</p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={savingProfile}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 shadow-sm"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contenido de Equipo */}
      {activeTab === 'team' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Directorio del Workspace</h2>
              <p className="text-sm text-slate-500">Administra los accesos y roles de los miembros.</p>
            </div>
            {myProfile.role === 'ADMIN' && (
              <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 w-max">
                <Shield className="w-3.5 h-3.5" /> Eres Administrador
              </span>
            )}
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
                          {user.id === myProfile.id && <span className="ml-2 text-xs text-indigo-500 font-normal">(Tú)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {user.id.split('-')[0]}...
                    </td>
                    <td className="px-6 py-4">
                      {myProfile.role === 'ADMIN' && user.id !== myProfile.id ? (
                        <select 
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          className={cn(
                            "text-xs font-semibold rounded-lg px-3 py-1.5 outline-none border cursor-pointer",
                            user.role === 'ADMIN' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" 
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          )}
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "text-xs font-semibold px-3 py-1.5 rounded-lg border",
                          user.role === 'ADMIN'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" 
                            : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        )}>
                          {user.role}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {team.length === 0 && !loadingTeam && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                      No hay otros miembros en el equipo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;