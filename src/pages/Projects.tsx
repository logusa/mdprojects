import React, { useState, useEffect } from 'react';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { ProjectGantt } from '../components/workspace/ProjectGantt';
import { Plus, FolderKanban, X, Loader2, ArrowLeft, Inbox, Folder, Calendar, Pencil, Trash2, Briefcase, LayoutGrid, Clock, ShieldCheck } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { getBrowserLocale } from '@/utils/locale';

export interface Project {
  id: string;
  name: string;
  color: string;
  due_date?: string | null;
  client_id?: string | null;
  clients?: { name: string } | null;
  user_id: string;
  progress?: number;
  supervisor_id?: string | null;
}

const PROJECT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Projects = () => {
  const { settings } = useWhiteLabel();
  usePageTitle(settings.label_projects || 'Proyectos');
  const { session } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [profiles, setProfiles] = useState<{id: string, first_name: string, last_name: string}[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'kanban' | 'gantt'>('kanban');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newProjectDueDate, setNewProjectDueDate] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [newProjectSupervisor, setNewProjectSupervisor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const initData = async () => {
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'ADMIN') setIsAdmin(true);
      fetchProjectsAndClients();
      fetchProfiles();
    };
    initData();
  }, [session]);

  const fetchProjectsAndClients = async () => {
    const [projRes, clientRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: true }),
      supabase.from('clients').select('id, name').order('name')
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (clientRes.data) setClients(clientRes.data);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name').order('first_name');
    if (data) setProfiles(data as any);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setNewProjectDueDate('');
    setNewProjectClient('');
    setNewProjectSupervisor('');
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectColor(project.color);
    setNewProjectDueDate(project.due_date ? project.due_date.substring(0, 10) : '');
    setNewProjectClient(project.client_id || '');
    setNewProjectSupervisor(project.supervisor_id || '');
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Todas las tareas asociadas también se borrarán.')) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(projects.filter(p => p.id !== id));
      if (activeView === id) setActiveView(null);
      showSuccess('Proyecto eliminado correctamente');
    } catch (err) {
      showError('Error al eliminar el proyecto');
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newProjectName.trim()) return;
    setIsSubmitting(true);

    const projectData = {
      name: newProjectName,
      color: newProjectColor,
      due_date: newProjectDueDate ? new Date(newProjectDueDate).toISOString() : null,
      client_id: newProjectClient || null,
      supervisor_id: newProjectSupervisor || null,
    };

    if (editingProject) {
      const { data, error } = await supabase.from('projects').update(projectData).eq('id', editingProject.id).select('*, clients(name)').single();
      if (!error && data) {
        setProjects(projects.map(p => p.id === data.id ? data : p));
        setIsModalOpen(false);
        showSuccess('Proyecto actualizado');
      }
    } else {
      const { data, error } = await supabase.from('projects').insert({...projectData, user_id: session.user.id}).select('*, clients(name)').single();
      if (!error && data) {
        setProjects([...projects, data]);
        setIsModalOpen(false);
        showSuccess('Proyecto creado exitosamente');
      }
    }
    setIsSubmitting(false);
  };

  if (activeView !== null) {
    const isStandalone = activeView === 'NONE';
    const currentProject = isStandalone ? null : projects.find(p => p.id === activeView);

    return (
      <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col animate-in slide-in-from-right-4 duration-300">
        <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView(null)} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                {isStandalone ? (
                  <><Inbox className="w-6 h-6 text-slate-400" /> Bandeja de Entrada</>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${currentProject?.color}20`, color: currentProject?.color }}>
                      <Folder className="w-4 h-4" />
                    </div>
                    {currentProject?.name}
                  </>
                )}
              </h1>
              {!isStandalone && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5">
                  {currentProject?.clients && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> {currentProject.clients.name}</p>
                  )}
                  {currentProject?.supervisor_id && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" /> 
                      Supervisor: {profiles.find(p => p.id === currentProject.supervisor_id)?.first_name} {profiles.find(p => p.id === currentProject.supervisor_id)?.last_name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isStandalone && (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start lg:self-center">
              <button onClick={() => setDisplayMode('kanban')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all", displayMode === 'kanban' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <LayoutGrid className="w-4 h-4" /> Kanban
              </button>
              <button onClick={() => setDisplayMode('gantt')} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all", displayMode === 'gantt' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <Clock className="w-4 h-4" /> Cronograma
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {displayMode === 'kanban' || isStandalone ? (
            <KanbanBoard activeProjectId={activeView} projects={projects} isAdmin={isAdmin} clients={clients} />
          ) : (
            <ProjectGantt projectId={activeView} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" /> {settings.label_projects || 'Proyectos'}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">{settings.projects_desc}</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm shadow-indigo-600/20 active:scale-95">
          <Plus className="w-5 h-5" /> Crear Proyecto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">General</h2>
            <div onClick={() => setActiveView('NONE')} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-sm group">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Bandeja de Entrada</h3>
                <p className="text-sm text-slate-500">Tareas rápidas sin un proyecto asignado</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Mis Proyectos de Obra</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <div key={project.id} onClick={() => setActiveView(project.id)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${project.color}20`, color: project.color }}>
                      <Folder className="w-6 h-6" />
                    </div>
                    {project.due_date && (
                      <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border mt-1 mr-16", isPast(new Date(project.due_date)) ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-600")}>
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(project.due_date), 'd MMM', { locale: getBrowserLocale() })}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1 pr-14">{project.name}</h3>
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>AVANCE GENERAL</span>
                        <span>{project.progress || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${project.progress || 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;