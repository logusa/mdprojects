import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  usePageTitle('Acceso');
  
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  // Genera iniciales si no hay logo
  const initials = settings.app_name.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="mb-8 text-center">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm">
              <span className="text-white font-bold text-2xl">{initials}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Acceso a {settings.app_name}</h1>
          <p className="text-slate-500 mt-2 text-sm">Gestiona proyectos, tareas y documentos.</p>
        </div>
        <div className="auth-container">
          <Auth 
            supabaseClient={supabase} 
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                  }
                }
              }
            }} 
            theme="light" 
            providers={[]} 
          />
        </div>
      </div>
    </div>
  );
}