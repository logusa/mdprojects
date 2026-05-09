import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, FileText, FolderOpen, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
}

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Tareas', path: '/tasks', icon: CheckSquare },
  { name: 'Documentos', path: '/docs', icon: FileText },
  { name: 'Archivos', path: '/files', icon: FolderOpen },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800",
        isOpen ? "w-64" : "w-20"
      )}
    >
      <div className="h-16 flex items-center justify-center border-b border-slate-800">
        {isOpen ? (
          <span className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-sm">MD</span>
            </div>
            NEXUS
          </span>
        ) : (
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            MD
          </div>
        )}
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="font-medium">{item.name}</span>}
              {!isOpen && (
                <div className="absolute left-16 bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full hover:bg-slate-800 transition-colors text-left">
          <Settings className="w-5 h-5" />
          {isOpen && <span>Configuración</span>}
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full hover:bg-red-500/10 hover:text-red-400 transition-colors text-left">
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
};