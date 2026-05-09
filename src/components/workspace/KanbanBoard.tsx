import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, Calendar, Loader2, X, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '../auth/AuthProvider';
import type { Project } from '../../pages/Tasks';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_id: string | null;
  created_at: string;
}

const initialColumns = {
  TODO: { id: 'TODO', title: 'Por Hacer', taskIds: [] as string[] },
  IN_PROGRESS: { id: 'IN_PROGRESS', title: 'En Progreso', taskIds: [] as string[] },
  REVIEW: { id: 'REVIEW', title: 'Revisión', taskIds: [] as string[] },
  DONE: { id: 'DONE', title: 'Completado', taskIds: [] as string[] },
};

interface KanbanProps {
  activeProjectId: string;
  projects: Project[];
}

export const KanbanBoard: React.FC<KanbanProps> = ({ activeProjectId, projects }) => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [columns, setColumns] = useState(initialColumns);
  const [loading, setLoading] = useState(true);

  // Modal de Crear Tarea
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState('TODO');
  const [newTaskForm, setNewTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', project_id: activeProjectId === 'ALL' || activeProjectId === 'NONE' ? '' : activeProjectId });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
    // Actualizar el proyecto por defecto en el form si cambia el filtro
    setNewTaskForm(prev => ({ ...prev, project_id: activeProjectId === 'ALL' || activeProjectId === 'NONE' ? '' : activeProjectId }));
  }, [session, activeProjectId]);

  const fetchTasks = async () => {
    if (!session) return;
    setLoading(true);
    
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: true });
    
    if (activeProjectId === 'NONE') {
      query = query.is('project_id', null);
    } else if (activeProjectId !== 'ALL') {
      query = query.eq('project_id', activeProjectId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      showError('Error al cargar tareas');
    } else if (data) {
      const newTasks: Record<string, Task> = {};
      const cols = {
        TODO: { ...initialColumns.TODO, taskIds: [] as string[] },
        IN_PROGRESS: { ...initialColumns.IN_PROGRESS, taskIds: [] as string[] },
        REVIEW: { ...initialColumns.REVIEW, taskIds: [] as string[] },
        DONE: { ...initialColumns.DONE, taskIds: [] as string[] },
      };

      data.forEach(task => {
        newTasks[task.id] = task;
        if (cols[task.status as keyof typeof cols]) {
          cols[task.status as keyof typeof cols].taskIds.push(task.id);
        }
      });

      setTasks(newTasks);
      setColumns(cols);
    }
    setLoading(false);
  };

  const openCreateModal = (columnId: string) => {
    setActiveColumnId(columnId);
    setNewTaskForm({ title: '', description: '', priority: 'MEDIUM', project_id: activeProjectId === 'ALL' || activeProjectId === 'NONE' ? '' : activeProjectId });
    setIsModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newTaskForm.title.trim()) return;
    setIsSubmitting(true);

    const newTask = {
      title: newTaskForm.title,
      description: newTaskForm.description,
      status: activeColumnId,
      priority: newTaskForm.priority,
      project_id: newTaskForm.project_id || null,
      user_id: session.user.id
    };

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    
    if (error) {
      showError('No se pudo crear la tarea');
    } else if (data) {
      // Si la tarea corresponde al filtro actual, la añadimos a la UI
      if (activeProjectId === 'ALL' || (activeProjectId === 'NONE' && !data.project_id) || activeProjectId === data.project_id) {
        setTasks(prev => ({ ...prev, [data.id]: data }));
        setColumns(prev => ({
          ...prev,
          [activeColumnId]: { ...prev[activeColumnId as keyof typeof prev], taskIds: [...prev[activeColumnId as keyof typeof prev].taskIds, data.id] }
        }));
      }
      showSuccess('Tarea añadida');
      setIsModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const start = columns[source.droppableId as keyof typeof columns];
    const finish = columns[destination.droppableId as keyof typeof columns];

    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setColumns({ ...columns, [start.id]: { ...start, taskIds: newTaskIds } });
      return;
    }

    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = { ...start, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finish, taskIds: finishTaskIds };

    setColumns({ ...columns, [newStart.id]: newStart, [newFinish.id]: newFinish });
    setTasks({ ...tasks, [draggableId]: { ...tasks[draggableId], status: destination.droppableId } });

    const { error } = await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId);
    if (error) {
      showError('Error al actualizar estado');
      fetchTasks();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/50';
      default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50';
    }
  };

  const getProject = (projectId: string | null) => projects.find(p => p.id === projectId);

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 sm:gap-6 h-full overflow-x-auto pb-6 pt-2 px-2 -mx-2 snap-x snap-mandatory scroll-smooth hide-scrollbar">
          {Object.values(columns).map(column => (
            <div key={column.id} className="flex-shrink-0 w-[85vw] max-w-[320px] sm:w-80 flex flex-col bg-slate-100/80 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800 snap-center shadow-sm">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-base">
                  {column.title}
                  <span className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold shadow-sm">{column.taskIds.length}</span>
                </h3>
                <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn("flex-1 min-h-[150px] transition-colors rounded-xl", snapshot.isDraggingOver && "bg-slate-200/50 dark:bg-slate-800/50")}
                  >
                    {column.taskIds.map((taskId, index) => {
                      const task = tasks[taskId];
                      if (!task) return null;
                      const taskProject = getProject(task.project_id);

                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...provided.draggableProps.style }}
                              className={cn(
                                "bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 mb-3 group relative cursor-grab active:cursor-grabbing hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors",
                                snapshot.isDragging && "shadow-xl rotate-2 scale-105 ring-2 ring-indigo-500 z-50"
                              )}
                            >
                              <div className="flex justify-between items-start mb-2.5">
                                <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md border", getPriorityColor(task.priority))}>
                                  {task.priority === 'HIGH' ? 'ALTA' : task.priority === 'MEDIUM' ? 'MEDIA' : 'BAJA'}
                                </span>
                                {taskProject && activeProjectId === 'ALL' && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700 max-w-[120px]">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: taskProject.color }} />
                                    <span className="truncate">{taskProject.name}</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 leading-snug">{task.title}</p>
                              
                              {task.description && (
                                <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                                  {task.description}
                                </p>
                              )}
                              
                              <div className={cn("flex items-center justify-between text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-3", !task.description && "mt-4")}>
                                <div className="flex items-center gap-1.5 text-xs font-medium">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{format(new Date(task.created_at || new Date()), 'MMM d')}</span>
                                </div>
                                {task.description && <AlignLeft className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <button 
                onClick={() => openCreateModal(column.id)}
                className="flex items-center justify-center gap-2 w-full py-3.5 mt-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-xl transition-all border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Añadir Tarea
              </button>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Modal Crear Tarea */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Nueva Tarea</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-4 sm:p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título de la Tarea</label>
                <input 
                  type="text" 
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm({...newTaskForm, title: e.target.value})}
                  placeholder="Ej. Revisar diseño de la landing page..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  autoFocus
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (Opcional)</label>
                <textarea 
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({...newTaskForm, description: e.target.value})}
                  placeholder="Detalles adicionales sobre lo que hay que hacer..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioridad</label>
                  <select 
                    value={newTaskForm.priority}
                    onChange={(e) => setNewTaskForm({...newTaskForm, priority: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Proyecto</label>
                  <select 
                    value={newTaskForm.project_id}
                    onChange={(e) => setNewTaskForm({...newTaskForm, project_id: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  >
                    <option value="">Sin Proyecto (Suela)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !newTaskForm.title.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};