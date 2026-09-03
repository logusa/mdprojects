import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Briefcase, X, Loader2, Pencil, Trash2, Mail, Phone, Building, FolderKanban, User, List, LayoutGrid, Filter, Search, MoreVertical } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  user_id: string;
  projects?: { id: string; name: string; color: string }[];
}

export interface ProjectOption {
  id: string;
  name: string;
  client_id: string | null;
}

const Clients = () => {
  const { settings } = useWhiteLabel();
  usePageTitle(settings.label_clients || 'Clientes');
  const { session } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // UI States
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [clientFilter, setClientFilter] = useState<'ALL' | 'WITH_PROJECTS' | 'NO_PROJECTS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    company: '',
    selectedProjects: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const initData = async () => {
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'ADMIN') setIsAdmin(true);
      fetchClientsAndProjects();
    };
    initData();
  }, [session]);

  const fetchClientsAndProjects = async () => {
    setLoading(true);
    const [clientsRes, projectsRes] = await Promise.all([
      supabase.from('clients').select('*, projects(id, name, color)').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name, client_id').order('name')
    ]);
    if (!clientsRes.error && clientsRes.data) setClients(clientsRes.data);
    if (!projectsRes.error && projectsRes.data) setAvailableProjects(projectsRes.data);
    setLoading(false);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Filtro de búsqueda
      const matchesSearch = 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (client.company || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Filtro de situación
      if (clientFilter === 'WITH_PROJECTS') return (client.projects?.length || 0) > 0;
      if (clientFilter === 'NO_PROJECTS') return (client.projects?.length || 0) === 0;
      
      return true;
    });
  }, [clients, clientFilter, searchTerm]);

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        selectedProjects: client.projects?.map(p => p.id) || []
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', email: '', phone: '', company: '', selectedProjects: [] });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este cliente? Sus proyectos y tareas no se borrarán, pero perderán la asociación.')) return;

    try {
      await supabase.from('projects').update({ client_id: null }).eq('client_id', id);
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      setClients(clients.filter(c => c.id !== id));
      showSuccess('Cliente eliminado');
    } catch (err) {
      showError('Error al eliminar cliente');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !formData.name.trim()) return;
    setIsSubmitting(true);

    const clientData = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      company: formData.company || null,
    };

    try {
      let savedClient = null;

      if (editingClient) {
        const { data, error } = await supabase.from('clients').update(clientData).eq('id', editingClient.id).select().single();
        if (error) throw error;
        savedClient = data;
      } else {
        const { data, error } = await supabase.from('clients').insert({ ...clientData, user_id: session.user.id }).select().single();
        if (error) throw error;
        savedClient = data;
      }

      if (savedClient) {
        if (editingClient) {
          await supabase.from('projects').update({ client_id: null }).eq('client_id', savedClient.id);
        }
        
        if (formData.selectedProjects.length > 0) {
          await supabase.from('projects').update({ client_id: savedClient.id }).in('id', formData.selectedProjects);
        }

        showSuccess(editingClient ? 'Cliente actualizado' : 'Cliente registrado exitosamente');
        setIsModalOpen(false);
        await fetchClientsAndProjects();
      }
    } catch (err) {
      showError('Error al guardar el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPermission = (userId: string) => isAdmin || session?.user.id === userId;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-indigo-500" /> {settings.label_clients || 'Clientes'}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">{settings.clients_desc}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Controles de Vista y Filtro */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
             <Filter className="w-3.5 h-3.5 text-slate-400" />
             <select 
               value={clientFilter} 
               onChange={(e) => setClientFilter(e.target.value as any)}
               className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600 dark:text-slate-300 cursor-pointer w-full"
             >
               <option value="ALL">Todos los clientes</option>
               <option value="WITH_PROJECTS">Con Proyectos Activos</option>
               <option value="NO_PROJECTS">Sin Proyectos</option>
             </select>
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button 
              onClick={() => setViewMode('list')} 
              className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-400")}
              title="Vista Lista"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-400")}
              title="Vista Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => openModal()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold text-sm shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95">
            <Plus className="w-5 h-5" /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar cliente o empresa..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-20 px-4 bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron clientes</p>
          <button onClick={() => {setSearchTerm(''); setClientFilter('ALL');}} className="text-indigo-500 hover:text-indigo-600 font-bold text-sm mt-2">Limpiar filtros</button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Cliente / Empresa</th>
                <th className="px-6 py-4">Contacto</th>
                <th className="px-6 py-4">Proyectos</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">{client.name[0]}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{client.name}</p>
                        {client.company && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{client.company}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      {client.email && <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"><Mail className="w-3 h-3" /> {client.email}</div>}
                      {client.phone && <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"><Phone className="w-3 h-3" /> {client.phone}</div>}
                      {!client.email && !client.phone && <span className="text-xs text-slate-300 italic">Sin datos</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase", (client.projects?.length || 0) > 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400")}>
                        {client.projects?.length || 0} Proyectos
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {hasPermission(client.user_id) && (
                        <>
                          <button onClick={() => openModal(client)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil className="w-4 h-4" /></button>
                          <button onClick={(e) => handleDelete(client.id, e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative border-b-4 border-b-slate-100 dark:border-b-slate-800 hover:border-b-indigo-500 flex flex-col min-w-0">
              {hasPermission(client.user_id) && (
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => { e.stopPropagation(); openModal(client); }} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDelete(client.id, e)} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-red-500 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-6 pr-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shrink-0 border border-indigo-100 dark:border-indigo-800/50">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-800 dark:text-white leading-tight truncate" title={client.name}>{client.name}</h3>
                  {client.company && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1 mt-1 truncate">
                      <User className="w-3 h-3" /> {client.company}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-auto pt-6 border-t border-slate-50 dark:border-slate-800 flex flex-col gap-1">
                {client.email ? (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                    <span className="truncate" title={client.email}>{client.email}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-300 italic">Sin correo</div>
                )}
                {client.phone ? (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                    <span className="truncate">{client.phone}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-300 italic">Sin teléfono</div>
                )}
              </div>

              {client.projects && client.projects.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <FolderKanban className="w-3 h-3 text-indigo-400" /> Proyectos ({client.projects.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {client.projects.map(p => (
                      <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold truncate max-w-[120px]" style={{ backgroundColor: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Empresa / Cliente *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ej. Constructora Delta" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold" autoFocus required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Persona de Contacto (Opcional)</label>
                <input type="text" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} placeholder="Ej. Ing. Juan Pérez" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+1 234..." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Asignar Proyectos</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl p-2 space-y-1 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
                  {availableProjects.length === 0 ? (
                    <p className="text-[10px] text-slate-500 p-2 italic">No hay proyectos disponibles.</p>
                  ) : (
                    availableProjects.map(proj => (
                      <label key={proj.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-900 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                        <input 
                          type="checkbox" 
                          checked={formData.selectedProjects.includes(proj.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              selectedProjects: checked 
                                ? [...prev.selectedProjects, proj.id] 
                                : prev.selectedProjects.filter(id => id !== proj.id)
                            }));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:border-slate-700" 
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{proj.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 pb-2">
                <button type="submit" disabled={isSubmitting || !formData.name.trim()} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingClient ? 'Guardar Cambios' : 'Registrar Cliente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;