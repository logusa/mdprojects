import React from 'react';
import { KanbanBoard } from '@/components/workspace/KanbanBoard';

const Tasks = () => {
  return (
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Tablero de Tareas</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona el flujo de trabajo del equipo.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 w-full sm:w-auto overflow-hidden self-start sm:self-auto shadow-inner">
          <button className="flex-1 sm:flex-none px-6 py-2 rounded-md bg-white dark:bg-slate-700 shadow-sm text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all">Kanban</button>
          <button className="flex-1 sm:flex-none px-6 py-2 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium transition-all">Lista</button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0">
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Tasks;