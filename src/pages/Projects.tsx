import React, { useState, useEffect } from 'react';
import { KanbanBoard } from '../components/workspace/KanbanBoard';
import { ProjectGantt } from '../components/workspace/ProjectGantt';
import { ProjectFinances } from '../components/workspace/ProjectFinances';
import { ProjectDashboard } from '../components/workspace/ProjectDashboard';
import { ProjectFiles } from '../components/workspace/ProjectFiles';
import { Plus, FolderKanban, X, Loader2, ArrowLeft, Inbox, Folder, Calendar, Pencil, Trash2, Briefcase, LayoutGrid, Clock, Wallet, LayoutDashboard, FolderOpen } from 'lucide-react';
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
  public_token?: string;
  is_public?: boolean;
}

const PROJECT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const Projects = () => {
  const { settings } = useWhiteLabel();
  usePageTitle(settings.label_projects || 'Proyectos');
  const { session } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'dashboard' | 'kanban' | 'gantt' | 'finances' | 'files'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projectPhases, setProjectPhases] = useState<{id: string, name: string}[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newProjectDueDate, setNewProjectDueDate] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const initData = async () => {
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'ADMIN') setIsAdmin(true);
      fetchProjectsAndClients();
    };
    initData();
  }, [session]);

  useEffect(() => {
    if (activeView && activeView !== 'NONE') {
      supabase.from('project_phases').select('id, name').eq('project_id', activeView)
        .then(({ data }) => { if (data) setProjectPhases(data); });
    }
  }, [activeView]);

  const fetchProjectsAndClients = async () => {
    const [projRes, clientRes] = await Promise.all([
      supabase.from('projects').select('*, clients(name)').order('created_at', { ascending: true }),
      supabase.from('clients').select('id, name').order('name')
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (clientRes.data) setClients(clientRes.data);
    setLoading(false);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setNewProjectDueDate('');
    setNewProjectClient('');
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newProjectName.trim()) return;
    setIsSubmitting(true);
    const projectData = {
      name: newProjectName, color: newProjectColor,
      due_date: newProjectDueDate ? new Date(newProjectDueDate).toISOString() : null,
      client_id: newProjectClient || null,
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
        showSuccess('Proyecto creado');
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
            <button onClick={() => { setActiveView(null); setDisplayMode('dashboard'); }} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                {isStandalone ? <><Inbox className="w-6 h-6 text-slate-400" /> Bandeja de Entrada</> : <><div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${currentProject?.color}20`, color: currentProject?.color }}><Folder className="w-4 h-4" /></div> {currentProject?.name}</>}
              </h1>
              {!isStandalone && currentProject?.clients && <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5"><Briefcase className="w-3 h-3" /> {currentProject.clients.name}</p>}
            </div>
          </div>
          {!isStandalone && (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl self-start lg:self-center overflow-x-auto hide-scrollbar">
              <button onClick={() => setDisplayMode('dashboard')} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all", displayMode === 'dashboard' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button onClick={() => setDisplayMode('kanban')} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all", displayMode === 'kanban' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <LayoutGrid className="w-4 h-4" /> Tareas
              </button>
              <button onClick={() => setDisplayMode('gantt')} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all", displayMode === 'gantt' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <Clock className="w-4 h-4" /> Cronograma
              </button>
              <button onClick={() => setDisplayMode('files')} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all", displayMode === 'files' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <FolderOpen className="w-4 h-4" /> Archivos
              </button>
              <button onClick={() => setDisplayMode('finances')} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all", displayMode === 'finances' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}>
                <Wallet className="w-4 h-4" /> Finanzas
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {isStandalone ? (
            <KanbanBoard activeProjectId={activeView} projects={projects} isAdmin={isAdmin} clients={clients} />
          ) : (
            <>
              {displayMode === 'dashboard' && <ProjectDashboard projectId={activeView} project={currentProject} />}
              {displayMode === 'kanban' && <KanbanBoard activeProjectId={activeView} projects={projects} isAdmin={isAdmin} clients={clients} />}
              {displayMode === 'gantt' && <ProjectGantt projectId={activeView} />}
              {displayMode === 'files' && <ProjectFiles projectId={activeView} />}
              {displayMode === 'finances' && <ProjectFinances projectId={activeView} phases={projectPhases} />}
            </>
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
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform"><Inbox className="w-6 h-6" /></div>
              <div><h3 className="font-bold text-lg text-slate-800 dark:text-white">Bandeja de Entrada</h3><p className="text-sm text-slate-500">Tareas rápidas sin proyecto asignado</p></div>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Mis Proyectos de Obra</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <div key={project.id} onClick={() => { setActiveView(project.id); setDisplayMode('dashboard'); }} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${project.color}20`, color: project.color }}><Folder className="w-6 h-6" /></div>
                    {project.due_date && <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border mt-1 mr-16", isPast(new Date(project.due_date)) ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-600")}><Calendar className="w-3.5 h-3.5" /> {format(new Date(project.due_date), 'd MMM', { locale: getBrowserLocale() })}</div>}
                    {isAdmin && (<div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); setEditingProject(project); setNewProjectName(project.name); setNewProjectColor(project.color); setNewProjectDueDate(project.due_date ? project.due_date.substring(0, 10) : ''); setNewProjectClient(project.client_id || ''); setIsModalOpen(true); }} className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 rounded-md transition-colors"><Pencil className="w-4 h-4" /></button><button onClick={(e) => { e.stopPropagation(); if (window.confirm('¿Eliminar proyecto?')) { supabase.from('projects').delete().eq('id', project.id).then(() => fetchProjectsAndClients()); } }} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button></div>)}
                  </div>
                  <div><h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1 pr-14">{project.name}</h3><div className="mt-4"><div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1"><span>AVANCE GENERAL</span> <span>{project.progress || 0}%</span></div><div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${project.progress || 0}%` }} /></div></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full transition-colors"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveProject} className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Proyecto</label><input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Ej. Residencial Las Lomas" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" autoFocus required /></div>
              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente Asociado</label><select value={newProjectClient} onChange={(e) => setNewProjectClient(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm appearance-none"><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha de Entrega</label><input type="date" value={newProjectDueDate} onChange={(e) => setNewProjectDueDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /></div>
              <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Color</label><div className="flex flex-wrap gap-2 pt-1">{PROJECT_COLORS.map(color => (<button key={color} type="button" onClick={() => setNewProjectColor(color)} className={cn("w-8 h-8 rounded-full border-4 transition-all", newProjectColor === color ? "border-slate-300 scale-110" : "border-transparent opacity-60")} style={{ backgroundColor: color }} />))}</div></div>
              <div className="pt-4"><button type="submit" disabled={isSubmitting || !newProjectName.trim()} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingProject ? 'Guardar' : 'Crear')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;