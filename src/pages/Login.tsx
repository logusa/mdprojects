import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

export default function Login() {
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  usePageTitle('Acceso');
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!firstName.trim()) throw new Error("El nombre es obligatorio");
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            }
          }
        });
        if (error) throw error;
        showSuccess('Registro exitoso. Revisa tu correo para confirmar la cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      showError(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  const initials = settings.app_name.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
          <div className="mb-8 text-center">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-14 mx-auto mb-6 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-indigo-200 shadow-lg">
                <span className="text-white font-bold text-2xl">{initials}</span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isSignUp ? 'Crear Cuenta' : `Acceso a ${settings.app_name}`}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {isSignUp ? 'Únete al equipo de trabajo' : 'Gestiona tus proyectos y tareas.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" required value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="Ej. Juan"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Apellido</label>
                  <div className="relative">
                    <input 
                      type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="Ej. Pérez"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-70 mt-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isSignUp ? 'Crear mi cuenta' : 'Iniciar Sesión'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500">
              {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes cuenta aún?'}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="ml-2 font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline"
              >
                {isSignUp ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </p>
          </div>
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-8">
          © {new Date().getFullYear()} {settings.app_name}. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}