"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Clock, CheckCircle2, LayoutGrid, ImageIcon, Construction } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PublicSchedule() {
  const { token } = useParams();
  const [project, setProject] = useState<any>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPublicData();
  }, [token]);

  const fetchPublicData = async () => {
    setLoading(true);
    try {
      // 1. Buscar proyecto por token
      const { data: proj, error: pErr } = await supabase
        .from('projects')
        .select('*')
        .eq('public_token', token)
        .eq('is_public', true)
        .single();

      if (pErr || !proj) throw new Error("No encontrado");

      setProject(proj);

      // 2. Buscar fases y fotos
      const { data: phs } = await supabase
        .from('project_phases')
        .select('*, project_phase_photos(id, photo_url)')
        .eq('project_id', proj.id)
        .order('start_date', { ascending: true });

      setPhases(phs || []);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
  if (error) return <div className="h-screen flex flex-col items-center justify-center bg-white p-6 text-center"><Construction className="w-16 h-16 text-slate-300 mb-4" /><h1 className="text-xl font-bold text-slate-800">Enlace No Válido</h1><p className="text-slate-500 max-w-xs">El cronograma solicitado no existe o ya no es público.</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
              <LayoutGrid className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Cronograma de Obra</p>
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 font-medium">AVANCE TOTAL</p>
            <p className="text-3xl font-black text-slate-900">{project.progress}%</p>
            <div className="w-32 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden ml-auto">
              <div className="h-full bg-indigo-600" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {phases.map((phase) => (
            <div key={phase.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{phase.name}</h3>
                    {phase.progress === 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {format(new Date(phase.start_date), 'dd MMM')} - {format(new Date(phase.end_date), 'dd MMM', { locale: es })}</div>
                    <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">{phase.progress}% COMPLETADO</div>
                  </div>
                </div>
              </div>

              {phase.project_phase_photos && phase.project_phase_photos.length > 0 && (
                <div className="px-6 pb-6 border-t border-slate-50 pt-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    <ImageIcon className="w-4 h-4" /> Evidencia Fotográfica
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {phase.project_phase_photos.map((photo: any) => (
                      <div key={photo.id} className="aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
                        <img src={photo.photo_url} alt="Avance" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="text-center py-8 text-slate-400 text-sm">
          Este es un informe de avance en tiempo real generado por {project.name}.
        </footer>
      </div>
    </div>
  );
}