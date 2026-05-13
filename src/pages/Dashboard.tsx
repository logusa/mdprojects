import React, { useState, useEffect } from 'react';
import { Activity, Users, CheckCircle, Clock, FileText, Loader2 } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const Dashboard = () => {
  const { settings } = useWhiteLabel();
  usePageTitle(settings.label_dashboard || 'Dashboard');
  const { session } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, completed: 0, members: 0, docs: 0 });
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!session) return;
    
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Stats
        const [
          { count: pendingCount },
          { count: completedCount },
          { count: membersCount },
          { count: docsCount }
        ] = await Promise.all([
          supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'DONE'),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'DONE'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('documents').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          pending: pendingCount || 0,
          completed: completedCount || 0,
          members: membersCount || 0,
          docs: docsCount || 0
        });

        // Actividad Reciente combinada (tareas y documentos)
        const { data: recentTasks } = await supabase
          .from('tasks')
          .select('title, status, created_at, profiles(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: recentDocs } = await supabase
          .from('documents')
          .select('title, updated_at, profiles(first_name, last_name)')
          .order('updated_at', { ascending: false })
          .limit(5);

        const combinedActivities = [
          ...(recentTasks || []).map((t: any) => ({
            id: `t-${t.created_at}`,
            user: t.profiles?.first_name ? `${t.profiles.first_name} ${t.profiles.last_name || ''}`.trim() : 'Usuario',
            action: t.status === 'DONE' ? 'completó la tarea' : 'creó la tarea',
            target: t.title,
            time: new Date(t.created_at)
          })),
          ...(recentDocs || []).map((d: any) => ({
            id: `d-${d.updated_at}`,
            user: d.profiles?.first_name ? `${d.profiles.first_name} ${d.profiles.last_name || ''}`.trim() : 'Usuario',
            action: 'actualizó el documento',
            target: d.title,
            time: new Date(d.updated_at)
          }))
        ];

        // Ordenar por fecha más reciente
        combinedActivities.sort((a, b) => b.time.getTime() - a.time.getTime());
        
        // Tomar los 6 más recientes
        setActivities(combinedActivities.slice(0, 6));

      } catch (error) {
        console.error('Error cargando el dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" /> 
          {settings.label_dashboard || 'Dashboard'}
        </h1>
        <p className="text-slate-500 mt-1">{settings.dashboard_desc}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Tareas Pendientes" value={stats.pending} icon={<Clock className="w-6 h-6 text-orange-500" />} />
            <StatCard title="Completadas" value={stats.completed} icon={<CheckCircle className="w-6 h-6 text-emerald-500" />} />
            <StatCard title="Miembros Activos" value={stats.members} icon={<Users className="w-6 h-6 text-blue-500" />} />
            <StatCard title="Total Documentos" value={stats.docs} icon={<FileText className="w-6 h-6 text-indigo-500" />} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Actividad Reciente</h2>
            {activities.length === 0 ? (
              <p className="text-slate-500 text-sm">No hay actividad reciente.</p>
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => (
                  <ActivityItem 
                    key={activity.id}
                    user={activity.user} 
                    action={activity.action} 
                    target={activity.target} 
                    time={formatDistanceToNow(activity.time, { addSuffix: true, locale: es })} 
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon }: { title: string, value: number | string, icon: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">{icon}</div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const ActivityItem = ({ user, action, target, time }: { user: string, action: string, target: string, time: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg transition-colors">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
        {user.charAt(0).toUpperCase()}
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        <span className="font-semibold text-slate-900 dark:text-white">{user}</span> {action} <span className="font-semibold text-indigo-600 dark:text-indigo-400">{target}</span>
      </p>
    </div>
    <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{time}</span>
  </div>
);

export default Dashboard;