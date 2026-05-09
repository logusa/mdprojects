import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '../../integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useAuth } from '../auth/AuthProvider';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

const initialColumns = {
  TODO: { id: 'TODO', title: 'To Do', taskIds: [] as string[] },
  IN_PROGRESS: { id: 'IN_PROGRESS', title: 'In Progress', taskIds: [] as string[] },
  REVIEW: { id: 'REVIEW', title: 'Review', taskIds: [] as string[] },
  DONE: { id: 'DONE', title: 'Done', taskIds: [] as string[] },
};

export const KanbanBoard = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [columns, setColumns] = useState(initialColumns);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [session]);

  const fetchTasks = async () => {
    if (!session) return;
    setLoading(true);
    
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
    
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

  const handleCreateTask = async (status: string) => {
    if (!session) return;
    const title = window.prompt('Título de la tarea:');
    if (!title) return;

    const newTask = {
      title,
      status,
      priority: 'MEDIUM',
      user_id: session.user.id
    };

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    if (error) {
      showError('No se pudo crear la tarea');
    } else if (data) {
      setTasks(prev => ({ ...prev, [data.id]: data }));
      setColumns(prev => ({
        ...prev,
        [status]: { ...prev[status as keyof typeof prev], taskIds: [...prev[status as keyof typeof prev].taskIds, data.id] }
      }));
      showSuccess('Tarea añadida');
    }
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

    // Move to another column
    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = { ...start, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finish, taskIds: finishTaskIds };

    setColumns({ ...columns, [newStart.id]: newStart, [newFinish.id]: newFinish });
    setTasks({ ...tasks, [draggableId]: { ...tasks[draggableId], status: destination.droppableId } });

    // Persist status change
    const { error } = await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId);
    if (error) {
      showError('Error al actualizar estado en DB');
      fetchTasks(); // Revert on fail
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'bg-red-100 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 h-full overflow-x-auto pb-4">
        {Object.values(columns).map(column => (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col bg-slate-100 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                {column.title}
                <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">{column.taskIds.length}</span>
              </h3>
              <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
            </div>

            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn("flex-1 min-h-[150px] transition-colors rounded-lg", snapshot.isDraggingOver && "bg-slate-200/50 dark:bg-slate-800/50")}
                >
                  {column.taskIds.map((taskId, index) => {
                    const task = tasks[taskId];
                    if (!task) return null;
                    return (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              "bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 mb-3 group",
                              snapshot.isDragging && "shadow-lg rotate-2 scale-105 ring-2 ring-indigo-500"
                            )}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={cn("text-[10px] font-bold px-2 py-1 rounded border", getPriorityColor(task.priority))}>
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">{task.title}</p>
                            <div className="flex items-center justify-between text-slate-400">
                              <div className="flex items-center gap-1 text-xs">
                                <Calendar className="w-3 h-3" />
                                <span>{format(new Date(task.created_at || new Date()), 'MMM d')}</span>
                              </div>
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
              onClick={() => handleCreateTask(column.id)}
              className="flex items-center justify-center gap-2 w-full py-3 mt-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-300"
            >
              <Plus className="w-4 h-4" /> Añadir Tarea
            </button>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};