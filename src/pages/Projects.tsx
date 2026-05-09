import React, { useState, useEffect } from 'react';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { Plus, FolderKanban, Hash, X, Loader2, ArrowLeft, ChevronRight, LayoutGrid } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  
  // Estado de navegación: 'GRID' muestra todos los proyectos, 'KANBAN' muestra el tablero activo
  const [view, setView] = useState<'GRID' | 'KANBAN'>('GRID');
  const [activeProject, setActiveProject] = useState<Project | 'NONE' | null>(null);
  
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
      
      // Opcional: Entrar automáticamente al nuevo proyecto
      setActiveProject(data);
      setView('KANBAN');
    }
    setIsSubmitting(false);
  };

  const openProject = (project: Project | 'NONE') => {
    setActiveProject(project);
    setView('KANBAN');
  };

  // VISTA 1: GRID DE PROYECTOS
  if (view === 'GRID') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
              Proyectos
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1">Selecciona un proyecto para gestionar sus tareas.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nuevo Proyecto
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Tarjeta especial para tareas sueltas */}
            <div 
              onClick={() => openProject('NONE')}
              className="group bg-slate-100 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-slate-200 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 group-hover:scale-110 transition-transform">
                  <Hash className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200">Tareas Sueltas</h3>
              </div>
              <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 font-medium mt-4 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                Ver tareas sin proyecto <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>

            {/* Tarjetas de Proyectos reales */}
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => openProject(p)}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between min-h-[140px] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: p.color }} />
                <div className="flex items-center gap-3 mb-2 pt-1">
                  <div className="p-2.5 rounded-xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${p.color}15`, color: p.color }}>
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-lg text-slate-800 dark:text-white line-clamp-1">{p.name}</h3>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500 mt-4">
                  <span className="font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center">
                    Abrir tablero <ChevronRight className="w-4 h-4 ml-0.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Crear Proyecto */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Crear Nuevo Proyecto</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-4 sm:p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del Proyecto</label>
                  <input 
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Ej. Rediseño Web, Campaña Q3..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Color Identificador</label>
                  <div className="flex gap-3">
                    {PROJECT_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewProjectColor(color)}
                        className={cn(
                          "w-8 h-8 rounded-full transition-transform",
                          newProjectColor === color ? "scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900" : "hover:scale-110"
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
                    className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Proyecto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VISTA 2: KANBAN DEL PROYECTO SELECCIONADO
  return (
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 sm:mb-6">
        <button 
          onClick={() => setView('GRID')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors text-sm font-medium mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Proyectos
        </button>
        <div className="flex items-center gap-3">
          {activeProject === 'NONE' ? (
            <>
              <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                <Hash className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Tareas Sueltas</h1>
                <p className="text-sm text-slate-500">Tareas que no pertenecen a ningún proyecto.</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${activeProject?.color}15`, color: activeProject?.color }}>
                <FolderKanban className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{activeProject?.name}</h1>
                <p className="text-sm text-slate-500">Tablero de proyecto</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0">
        <KanbanBoard 
          activeProjectId={activeProject === 'NONE' ? 'NONE' : activeProject?.id || 'NONE'} 
          projects={projects} 
        />
      </div>
    </div>
  );
};

export default Projects;