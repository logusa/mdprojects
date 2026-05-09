import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export interface WhiteLabelSettings {
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
}

const WhiteLabelContext = createContext<{ 
  settings: WhiteLabelSettings; 
  refreshSettings: () => Promise<void> 
}>({
  settings: { app_name: 'Workspace', logo_url: null, favicon_url: null },
  refreshSettings: async () => {},
});

export const WhiteLabelProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<WhiteLabelSettings | null>(null);

  const fetchSettings = async () => {
    const { data, error } = await supabase.from('workspace_settings').select('*').eq('id', 1).single();
    if (data) {
      setSettings(data);
      updateDOM(data);
    } else {
      const fallback = { app_name: 'Workspace', logo_url: null, favicon_url: null };
      setSettings(fallback);
      updateDOM(fallback);
    }
  };

  const updateDOM = (data: WhiteLabelSettings) => {
    document.title = data.app_name;
    
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