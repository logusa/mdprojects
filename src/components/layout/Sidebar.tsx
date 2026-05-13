import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Briefcase, FileText, FolderOpen, Settings, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '../../integrations/supabase/client';
import { useWhiteLabel } from '../providers/WhiteLabelProvider';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const isMobile = useIsMobile();
  const { settings } = useWhiteLabel();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const initials = settings.app_name.substring(0, 2).toUpperCase();

  const navItems = [
    { name: settings.label_dashboard, path: '/dashboard', icon: LayoutDashboard },
    { name: settings.label_projects, path: '/projects', icon: FolderKanban },
    { name: settings.label_clients, path: '/clients', icon: Briefcase },
    { name: settings.label_docs, path: '/docs', icon: FileText },
    { name: settings.label_files, path: '/files', icon: FolderOpen },
  ];

  return (
    <>
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800",
          isMobile ? "fixed inset-y-0 left-0 z-50 w-72 transform shadow-2xl" : "relative",
          isMobile && !isOpen && "-translate-x-full",
          isMobile && isOpen && "translate-x-0",
          !isMobile && (isOpen ? "w-64" : "w-20")
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {(isOpen || isMobile) ? (
            <span className="text-xl font-bold text-white flex items-center gap-3 w-full">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/5" />
              ) : (
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-sm">{initials}</span>
                </div>
              )}
              <span className="truncate pr-2">{settings.app_name}</span>
            </span>
          ) : (
            <div className="w-full flex justify-center">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-contain bg-white/5" />
              ) : (
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
                  {initials}
                </div>
              )}
            </div>
          )}

          {isMobile && (
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 -mr-2 text-slate-400 hover:text-white rounded-md transition-colors shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group relative",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "hover:bg-slate-800 hover:text-white"
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {(isOpen || isMobile) && <span className="font-medium truncate">{item.name}</span>}
                {!isOpen && !isMobile && (
                  <div className="absolute left-full ml-4 bg-slate-800 text-white px-2 py-1.5 text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap">
                    {item.name}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <NavLink 
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg w-full transition-colors text-left group",
                isActive ? "bg-indigo-600 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )
            }
          >
            <Settings className="w-5 h-5 shrink-0" />
            {(isOpen || isMobile) && <span className="truncate">Configuración</span>}
          </NavLink>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-lg w-full hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors text-left group"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {(isOpen || isMobile) && <span className="truncate">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
};