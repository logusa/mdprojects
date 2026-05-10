import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Calendar, Loader2, X, AlignLeft, Clock, Pencil, Trash2, BellRing, Briefcase } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '../auth/AuthProvider';
import type { Project } from '../../pages/Projects';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_id: string | null;
  client_id: string | null;
  clients?: { name: string } | null;
  due_date: string | null;
  created_at: string;
  user_id: string;
}

interface Reminder {
  minutes: number;
}

const initialColumns = {
  TODO: { id: 'TODO', title: 'Por Hacer', taskIds: [] as string[] },
  IN_PROGRESS: { id: 'IN_PROGRESS', title: 'En Progreso', taskIds: [] as string[] },
  REVIEW: { id: 'REVIEW', title: 'Revisión', taskIds: [] as string[] },
  DONE: { id: 'DONE', title: 'Completado', taskIds: [] as string[] },
};

interface KanbanProps {
  activeProjectId: string | null;
  projects: Project[];
  isAdmin: boolean;
  clients: {id: string, name: string}[];
}

export const KanbanBoard: React.FC<KanbanProps> = ({ activeProjectId, projects, isAdmin, clients }) => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [columns, setColumns] = useState(initialColumns);
  const [loading, setLoading] = useState(true);

  // Modal de Tarea
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState('TODO');
  
  const [newTaskForm, setNewTaskForm] = useState({ 
    title: '', 
    description: '', 
    priority: 'MEDIUM',
    client_id: '',
    due_date: ''
  });
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [session, activeProjectId]);

  const fetchTasks = async () => {
    if (!session) return;
    setLoading(true);
    let query = supabase.from('tasks').select('*, clients(name)').order('created_at', { ascending: true });
    
    if (activeProjectId === 'NONE') query = query.is('project_id', null);
    else if (activeProjectId) query = query.eq('project_id', activeProjectId);
    
    const { data, error } = await query;
    if (error) showError('Error al cargar tareas');
    else if (data) {
      const newTasks: Record<string, Task> = {};
      const cols = {
        TODO: { ...initialColumns.TODO, taskIds: [] as string[] },
        IN_PROGRESS: { ...initialColumns.IN_PROGRESS, taskIds: [] as string[] },
        REVIEW: { ...initialColumns.REVIEW, taskIds: [] as string[] },
        DONE: { ...initialColumns.DONE, taskIds: [] as string[] },
      };
      data.forEach(task => {
        newTasks[task.id] = task;
        if (cols[task.status as keyof typeof cols]) cols[task.status as keyof typeof cols].taskIds.push(task.id);
      });
      setTasks(newTasks);
      setColumns(cols);
    }
    setLoading(false);
  };

  const openCreateModal = (columnId: string) => {
    setEditingTask(null);
    setActiveColumnId(columnId);
    setNewTaskForm({ title: '', description: '', priority: 'MEDIUM', client_id: '', due_date: '' });
    setReminders([]);
    setIsModalOpen(true);
  };

  const openEditModal = async (task: Task) => {
    setEditingTask(task);
    setActiveColumnId(task.status);
    setNewTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      client_id: task.client_id || '',
      due_date: task.due_date ? task.due_date.substring(0, 16) : ''
    });
    
    const { data: rems } = await supabase.from('task_reminders').select('minutes_before').eq('task_id', task.id);
    if (rems) setReminders(rems.map(r => ({ minutes: r.minutes_before })));
    else setReminders([]);
    
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;
    try {
      await supabase.from('tasks').delete().eq('id', id);
      const taskToDelete = tasks[id];
      const column = columns[taskToDelete.status as keyof typeof columns];
      const newTasks = { ...tasks }; delete newTasks[id];
      setTasks(newTasks);
      setColumns({ ...columns, [taskToDelete.status]: { ...column, taskIds: column.taskIds.filter(taskId => taskId !== id) } });
      showSuccess('Tarea eliminada');
    } catch (err) { showError('Error al eliminar la tarea'); }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !newTaskForm.title.trim()) return;
    setIsSubmitting(true);

    const taskData = {
      title: newTaskForm.title,
      description: newTaskForm.description,
      status: activeColumnId,
      priority: newTaskForm.priority,
      client_id: newTaskForm.client_id || null,
      due_date: newTaskForm.due_date ? new Date(newTaskForm.due_date).toISOString() : null,
      project_id: activeProjectId === 'NONE' ? null : activeProjectId,
    };

    let savedTaskId = null;

    if (editingTask) {
      const { data, error } = await supabase.from('tasks').update(taskData).eq('id', editingTask.id).select('*, clients(name)').single();
      if (!error && data) {
        savedTaskId = data.id;
        setTasks(prev => ({ ...prev, [data.id]: data }));
        showSuccess('Tarea actualizada');
      }
    } else {
      const { data, error } = await supabase.from('tasks').insert({ ...taskData, user_id: session.user.id }).select('*, clients(name)').single();
      if (!error && data) {
        savedTaskId = data.id;
        setTasks(prev => ({ ...prev, [data.id]: data }));
        setColumns(prev => ({ ...prev, [activeColumnId]: { ...prev[activeColumnId as keyof typeof prev], taskIds: [...prev[activeColumnId as keyof typeof prev].taskIds, data.id] } }));
        showSuccess('Tarea añadida');
      }
    }

    if (savedTaskId) {
      await supabase.from('task_reminders').delete().eq('task_id', savedTaskId);
      if (newTaskForm.due_date && reminders.length > 0) {
        const reminderInserts = reminders.map(r => ({ task_id: savedTaskId, minutes_before: r.minutes }));
        await supabase.from('task_reminders').insert(reminderInserts);
      }
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
      newTaskIds.splice(source.index, 1); newTaskIds.splice(destination.index, 0, draggableId);
      setColumns({ ...columns, [start.id]: { ...start, taskIds: newTaskIds } });
      return;
    }

    const startTaskIds = Array.from(start.taskIds); startTaskIds.splice(source.index, 1);
    const finishTaskIds = Array.from(finish.taskIds); finishTaskIds.splice(destination.index, 0, draggableId);
    
    setColumns({ ...columns, [start.id]: { ...start, taskIds: startTaskIds }, [finish.id]: { ...finish, taskIds: finishTaskIds } });
    setTasks({ ...tasks, [draggableId]: { ...tasks[draggableId], status: destination.droppableId } });

    await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId);
  };

  const addReminder = () => {
    if (!newTaskForm.due_date) return showError("Debes establecer una fecha límite primero");
    setReminders([...reminders, { minutes: 15 }]);
  };

  const removeReminder = (index: number) => setReminders(reminders.filter((_, i) => i !== index));
  const updateReminder = (index: number, minutes: number) => {
    const newReminders = [...reminders]; newReminders[index].minutes = minutes; setReminders(newReminders);
  };

  const hasPermission = (userId: string) => isAdmin || session?.user.id === userId;
  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

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
                  <span className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold shadow-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{column.taskIds.length}</span>
                </h3>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("flex-1 min-h-[150px] transition-colors rounded-xl", snapshot.isDraggingOver && "bg-slate-200/50 dark:bg-slate-800/50")}>
                    {column.taskIds.map((taskId, index) => {
                      const task = tasks[taskId];
                      if (!task) return null;
                      const hasDueDate = !!task.due_date;
                      const isTaskPast = hasDueDate && isPast(new Date(task.due_date!)) && task.status !== 'DONE';

                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 mb-3 group relative cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors", snapshot.isDragging && "shadow-xl rotate-2 scale-105 ring-2 ring-indigo-500 z-50", isTaskPast && "border-red-300")}>
                              {hasPermission(task.user_id) && (
                                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm">
                                  <button onClick={() => openEditModal(task)} className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-md transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                              <div className="flex justify-between items-start mb-2.5">
                                <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md border", getPriorityColor(task.priority))}>{task.priority}</span>
                              </div>
                              <p className={cn("text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 leading-snug", hasPermission(task.user_id) && "pr-14")}>{task.title}</p>
                              {task.clients && (
                                <p className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" /> {task.clients.name}
                                </p>
                              )}
                              {task.description && <p className="text-xs text-slate-500 line-clamp-2 mb-4">{task.description}</p>}
                              <div className={cn("flex items-center justify-between text-slate-400 border-t border-slate-100 pt-3", !task.description && "mt-4")}>
                                {hasDueDate ? (
                                  <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md", isTaskPast ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500")}>
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{isToday(new Date(task.due_date!)) ? `Hoy, ${format(new Date(task.due_date!), 'HH:mm')}` : format(new Date(task.due_date!), 'd MMM, HH:mm', { locale: es })}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs font-medium opacity-60"><Calendar className="w-3.5 h-3.5" /><span>{format(new Date(task.created_at || new Date()), 'd MMM')}</span></div>
                                )}
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
              <button onClick={() => openCreateModal(column.id)} className="flex items-center justify-center gap-2 w-full py-3.5 mt-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border-2 border-dashed border-slate-300 hover:border-indigo-300 active:scale-[0.98]">
                <Plus className="w-4 h-4" /> Añadir Tarea
              </button>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Modal Crear/Editar Tarea */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveTask} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Título</label>
                <input type="text" value={newTaskForm.title} onChange={(e) => setNewTaskForm({...newTaskForm, title: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" autoFocus required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente (Opcional)</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={newTaskForm.client_id} onChange={(e) => setNewTaskForm({...newTaskForm, client_id: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm appearance-none">
                    <option value="">-- Sin Cliente --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Descripción</label>
                <textarea value={newTaskForm.description} onChange={(e) => setNewTaskForm({...newTaskForm, description: e.target.value})} rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Prioridad</label>
                  <select value={newTaskForm.priority} onChange={(e) => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium">
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha Límite</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="datetime-local" value={newTaskForm.due_date} onChange={(e) => setNewTaskForm({...newTaskForm, due_date: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                </div>
              </div>

              {/* Sistema de Recordatorios */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-indigo-500" /> Recordatorios
                  </label>
                  <button type="button" onClick={addReminder} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                    + Añadir aviso
                  </button>
                </div>
                
                {!newTaskForm.due_date && reminders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Establece una fecha límite para programar recordatorios.</p>
                ) : (
                  <div className="space-y-2">
                    {reminders.map((reminder, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-sm text-slate-500 pl-2">Avisarme</span>
                        <select 
                          value={reminder.minutes}
                          onChange={(e) => updateReminder(idx, parseInt(e.target.value))}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm outline-none"
                        >
                          <option value={10}>10 minutos antes</option>
                          <option value={15}>15 minutos antes</option>
                          <option value={30}>30 minutos antes</option>
                          <option value={60}>1 hora antes</option>
                          <option value={120}>2 horas antes</option>
                          <option value={1440}>1 día antes</option>
                          <option value={2880}>2 días antes</option>
                          <option value={10080}>1 semana antes</option>
                        </select>
                        <button type="button" onClick={() => removeReminder(idx)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="pt-4 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium text-sm">Cancelar</button>
                <button type="submit" disabled={isSubmitting || !newTaskForm.title.trim()} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTask ? 'Guardar' : 'Crear Tarea')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};