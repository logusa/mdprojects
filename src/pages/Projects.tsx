import React, { useState, useEffect } from 'react';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { Plus, FolderKanban, X, Loader2, ArrowLeft, Inbox, Folder } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

export interface Project {
  id: string;
  name: string;
  color: string;
}

const PROJECT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Projects = () => {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null); // null = Grid, 'NONE' = Sueltas, UUID = Proyecto
  const [loading, setLoading] = useState(true);
  
  // Modal de Proyecto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [session]);

  const fetchProjects = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true });
    if (!error && data) setProjects(data);
    setLoading(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newProjectName.trim()) return;
    setIsSubmitting(true);

    const { data, error } = await supabase.from('projects').insert({
      name: newProjectName,
      color: newProjectColor,
      user_id: session.user.id
    }).select().single();

    if (error) {
      showError('Error al crear proyecto');
    } else if (data) {
      setProjects([...projects, data]);
      setIsModalOpen(false);
      setNewProjectName('');
      showSuccess('Proyecto creado exitosamente');
    }
    setIsSubmitting(false);
  };

  // VISTA 2: DENTRO DE UN PROYECTO (KANBAN)
  if (activeView !== null) {
    const isStandalone = activeView === 'NONE';
    const currentProject = isStandalone ? null : projects.find(p => p.id === activeView);

    return (
      <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col animate-in slide-in-from-right-4 duration-300">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <button 
            onClick={() => setActiveView(null)} 
            className="self-start sm:self-auto p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              {isStandalone ? (
                <><Inbox className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" /> Bandeja de Entrada</>
              ) : (
                <>
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${currentProject?.color}20`, color: currentProject?.color }}>
                    <Folder className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  {currentProject?.name}
                </>
              )}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1">
              {isStandalone ? "Tareas sin proyecto asignado." : "Gestiona las tareas de este proyecto."}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0">
          <KanbanBoard activeProjectId={activeView} projects={projects} />
        </div>
      </div>
    );
  }

  // VISTA 1: GRID PRINCIPAL DE PROYECTOS
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
            Proyectos
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Selecciona un proyecto para gestionar sus tareas.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm shadow-indigo-600/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Crear Proyecto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="space-y-8">
          {/* Tarjeta de Tareas Sueltas */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">General</h2>
            <div 
              onClick={() => setActiveView('NONE')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-sm group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Bandeja de Entrada</h3>
                <p className="text-sm text-slate-500">Tareas rápidas sin un proyecto asignado</p>
              </div>
            </div>
          </div>

          {/* Grid de Proyectos */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Mis Proyectos</h2>
            {projects.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <FolderKanban className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 font-medium">Aún no tienes proyectos</p>
                <button onClick={() => setIsModalOpen(true)} className="text-indigo-500 hover:text-indigo-600 font-medium text-sm mt-2">Crear el primero</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => setActiveView(project.id)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                        <Folder className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1">{project.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }}></span>
                        Área de trabajo
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Crear Proyecto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">Nuevo Proyecto</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Proyecto</label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Ej. Desarrollo Frontend, Marketing..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Color Identificador</label>
                <div className="flex flex-wrap gap-3">
                  {PROJECT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewProjectColor(color)}
                      className={cn(
                        "w-10 h-10 rounded-full transition-transform",
                        newProjectColor === color ? "scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 shadow-md" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting || !newProjectName.trim()}
                  className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;