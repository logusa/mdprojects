import React from 'react';
import { Activity, Users, CheckCircle, Clock } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resumen del Proyecto</h1>
        <p className="text-slate-500">Bienvenido a Elmony Nexus. Aquí tienes un vistazo a la actividad reciente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tareas Pendientes" value="12" icon={<Clock className="w-6 h-6 text-orange-500" />} />
        <StatCard title="Completadas Hoy" value="5" icon={<CheckCircle className="w-6 h-6 text-emerald-500" />} />
        <StatCard title="Miembros Activos" value="8" icon={<Users className="w-6 h-6 text-blue-500" />} />
        <StatCard title="Actividad (Docs)" value="24" icon={<Activity className="w-6 h-6 text-indigo-500" />} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Actividad Reciente</h2>
        <div className="space-y-4">
          <ActivityItem user="Carlos M." action="actualizó el estado de" target="Diseño UI" time="hace 2 horas" />
          <ActivityItem user="Ana P." action="comentó en el documento" target="Arquitectura Base" time="hace 4 horas" />
          <ActivityItem user="Sistema" action="ejecutó backup exitoso" target="Supabase DB" time="hace 5 horas" />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }: any) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">{icon}</div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const ActivityItem = ({ user, action, target, time }: any) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">{user[0]}</div>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        <span className="font-semibold">{user}</span> {action} <span className="font-semibold text-indigo-600 dark:text-indigo-400">{target}</span>
      </p>
    </div>
    <span className="text-xs text-slate-400">{time}</span>
  </div>
);

export default Dashboard;