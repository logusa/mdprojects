import React from 'react';
import { KanbanBoard } from '@/components/workspace/KanbanBoard';

const Tasks = () => {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tablero de Tareas</h1>
          <p className="text-slate-500">Gestiona el flujo de trabajo de tu equipo.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button className="px-4 py-1.5 rounded-md bg-white dark:bg-slate-700 shadow-sm text-sm font-medium">Kanban</button>
          <button className="px-4 py-1.5 rounded-md text-slate-500 hover:text-slate-700 text-sm font-medium">Lista</button>
        </div>
      </div>
      
      {/* Contenedor del Kanban Board que ocupa el espacio restante */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
};

export default Tasks;