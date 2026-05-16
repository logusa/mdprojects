import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, Bell, Search, User, Check, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { useWhiteLabel } from '../providers/WhiteLabelProvider';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { getBrowserLocale } from '@/utils/locale';
import { showNotification } from '@/utils/toast';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export const DashboardLayout = () => {
  const isMobile = useIsMobile();
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Estado Notificaciones
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (session) {
      supabase.from('profiles').select('avatar_url').eq('id', session.user.id).single()
        .then(({data}) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });

      fetchNotifications();

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const channel = supabase.channel('notif_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, 
          (payload) => {
            const newNotif = payload.new as AppNotification;
            setNotifications(prev => [newNotif, ...prev]);

            // Mostrar Toast visual con acción de clic
            showNotification(
              newNotif.title, 
              newNotif.message, 
              newNotif.link ? () => navigate(newNotif.link!) : undefined
            );

            // Notificación nativa SO
            if ('Notification' in window && Notification.permission === 'granted') {
              const sysNotif = new Notification(newNotif.title, {
                body: newNotif.message,
                icon: settings.favicon_url || settings.logo_url || '/favicon.ico',
              });
              if (newNotif.link) {
                sysNotif.onclick = () => {
                  window.focus();
                  navigate(newNotif.link!);
                };
              }
            }
          }
        ).subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session, settings.favicon_url, settings.logo_url, navigate]);

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', session?.user.id).order('created_at', { ascending: false }).limit(20);
    if (data) setNotifications(data);
  };

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleNotifClick = (notif: AppNotification) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setShowNotifs(false);
    }
  };

  const clearAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', session?.user.id);
    setNotifications([]);
    setShowNotifs(false);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return settings.label_dashboard;
    if (path.includes('/projects')) return settings.label_projects;
    if (path.includes('/clients')) return settings.label_clients;
    if (path.includes('/docs')) return settings.label_docs;
    if (path.includes('/files')) return settings.label_files;
    if (path.includes('/settings')) return 'Configuración';
    return settings.label_dashboard;
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0 shadow-sm relative">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar tareas, documentos..." className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 transition-all" />
            </div>
            <span className="sm:hidden font-semibold text-slate-800 dark:text-slate-200 truncate">
              {getPageTitle()}
            </span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="p-2 relative rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                )}
              </button>

              {showNotifs && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)}></div>
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                      <h3 className="font-semibold text-slate-800 dark:text-white">Notificaciones</h3>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Limpiar
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">No tienes notificaciones nuevas.</div>
                      ) : (
                        notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => handleNotifClick(notif)}
                            className={cn(
                              "p-4 transition-colors group", 
                              notif.is_read ? "opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800/50" : "bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20",
                              notif.link ? "cursor-pointer" : ""
                            )}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className={cn("text-sm font-semibold", notif.is_read ? "text-slate-700 dark:text-slate-300" : "text-indigo-900 dark:text-indigo-100")}>{notif.title}</h4>
                              {!notif.is_read && (
                                <button onClick={(e) => markAsRead(notif.id, e)} className="p-1 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md" title="Marcar como leída">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: getBrowserLocale() })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-semibold text-sm cursor-pointer shadow-sm ring-2 ring-white dark:ring-slate-900 overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};