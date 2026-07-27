"use client";

import React, { useState, useEffect } from 'react';
import { Plus, ClipboardList, CloudRain, AlertTriangle, Image as ImageIcon, Search, Loader2, Calendar as CalendarIcon, User, MapPin } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';
import { ConstructionLog } from '../types/erp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ConstructionLogs = () => {
  usePageTitle('Bitácora de Obra');
  const { session } = useAuth();
  const [logs, setLogs] = useState<ConstructionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [session]);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('construction_logs')
      .select('*, projects(name), log_photos(id, photo_url)')
      .order('log_date', { ascending: false });
    
    if (error) showError('Error al cargar bitácoras');
    else if (data) setLogs(data as any);
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" /> Bitácora de Obra
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Reportes diarios de avance e incidencias en sitio.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95">
          <Plus className="w-5 h-5" /> Nuevo Reporte Diario
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay reportes de obra</p>
        </div>
      ) : (
        <div className="space-y-6">
          {logs.map(log => (
            <div key={log.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                      {format(new Date(log.log_date), "EEEE, d 'de' MMMM", { locale: es })}
                    </h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{log.projects?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {log.weather && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold">
                      <CloudRain className="w-3.5 h-3.5" /> {log.weather}
                    </div>
                  )}
                  {log.incidents && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Incidencia
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{log.content}</p>
                
                {log.log_photos && log.log_photos.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {log.log_photos.map(photo => (
                      <div key={photo.id} className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:scale-105 transition-transform cursor-pointer">
                        <img src={photo.photo_url} alt="Avance de obra" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConstructionLogs;