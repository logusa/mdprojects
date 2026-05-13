import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export interface WhiteLabelSettings {
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  organization_domain: string;
  dashboard_desc: string;
  projects_desc: string;
  clients_desc: string;
  files_desc: string;
  label_dashboard: string;
  label_projects: string;
  label_clients: string;
  label_docs: string;
  label_files: string;
  enable_providers: boolean;
}

const defaultSettings: WhiteLabelSettings = { 
  app_name: 'Workspace', 
  logo_url: null, 
  favicon_url: null,
  organization_domain: '',
  dashboard_desc: 'Aquí tienes un vistazo a la actividad reciente.',
  projects_desc: 'Selecciona un proyecto para gestionar sus tareas.',
  clients_desc: 'Gestiona tu cartera de clientes y asócialos a tus proyectos.',
  files_desc: 'Almacenamiento y compartición de archivos.',
  label_dashboard: 'Dashboard',
  label_projects: 'Proyectos',
  label_clients: 'Clientes',
  label_docs: 'Procesos',
  label_files: 'Archivos',
  enable_providers: true
};

const WhiteLabelContext = createContext<{ 
  settings: WhiteLabelSettings; 
  refreshSettings: () => Promise<void> 
}>({
  settings: defaultSettings,
  refreshSettings: async () => {},
});

export const WhiteLabelProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<WhiteLabelSettings | null>(null);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('workspace_settings').select('*').eq('id', 1).single();
    if (data) {
      const mergedSettings = { ...defaultSettings, ...data };
      setSettings(mergedSettings);
      updateDOM(mergedSettings);
    } else {
      setSettings(defaultSettings);
      updateDOM(defaultSettings);
    }
  };

  const updateDOM = (data: WhiteLabelSettings) => {
    localStorage.setItem('wl_app_name', data.app_name);
    if (data.favicon_url) {
      localStorage.setItem('wl_favicon', data.favicon_url);
    }

    if (!document.title.includes(data.app_name)) {
      document.title = data.app_name;
    }
    
    if (data.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = data.favicon_url;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (!settings) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300 dark:text-slate-700" />
      </div>
    );
  }

  return (
    <WhiteLabelContext.Provider value={{ settings, refreshSettings: fetchSettings }}>
      {children}
    </WhiteLabelContext.Provider>
  );
};

export const useWhiteLabel = () => useContext(WhiteLabelContext);