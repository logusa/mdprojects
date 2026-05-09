import React, { useState, useEffect } from 'react';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { Plus, FolderKanban, Hash, X, Loader2 } from 'lucide-react';
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

const Tasks = () => {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL'); // 'ALL', 'NONE', or project_id
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
      setActiveFilter(data.id);
      setIsModalOpen(false);
      setNewProjectName('');
      showSuccess('Proyecto creado exitosamente');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      {/* Cabecera */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
            Proyectos y Tareas
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Organiza tu trabajo por iniciativas o gestiona tareas individuales.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nuevo Proyecto
        </button>
      </div>

      {/* Filtros Rápidos (Pills) con Scroll Horizontal */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-4 snap-x">
        <FilterPill 
          active={activeFilter === 'ALL'} 
          onClick={() => setActiveFilter('ALL')} 
          label="Todas las Tareas" 
          icon={<Hash className="w-3.5 h-3.5" />} 
        />
        <FilterPill 
          active={activeFilter === 'NONE'} 
          onClick={() => setActiveFilter('NONE')} 
          label="Tareas Sueltas" 
          color="#64748b"
        />
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0 self-center" />
        {loading ? (
          <div className="px-4 py-2 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
        ) : (
          projects.map(p => (
            <FilterPill 
              key={p.id} 
              active={activeFilter === p.id} 
              onClick={() => setActiveFilter(p.id)} 
              label={p.name} 
              color={p.color} 
            />
          ))
        )}
      </div>
      
      {/* Tablero Kanban */}
      <div className="flex-1 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0">
        <KanbanBoard activeProjectId={activeFilter} projects={projects} />
      </div>

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
};

const FilterPill = ({ active, onClick, label, color, icon }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 snap-start border",
      active 
        ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-md" 
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    )}
  >
    {icon}
    {color && (
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
    )}
    {label}
  </button>
);

export default Tasks;