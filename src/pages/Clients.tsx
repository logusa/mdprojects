import React, { useState, useEffect } from 'react';
import { Plus, Briefcase, X, Loader2, Pencil, Trash2, Mail, Phone, Building, FolderKanban } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { useWhiteLabel } from '../components/providers/WhiteLabelProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';

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
  usePageTitle('Clientes');
  const { session } = useAuth();
  const { settings } = useWhiteLabel();
  const [clients, setClients] = useState<Client[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" /> CRM / Clientes
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">{settings.clients_desc}</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm shadow-indigo-600/20 active:scale-95">
          <Plus className="w-5 h-5" /> Nuevo Cliente
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay clientes registrados</p>
          <button onClick={() => openModal()} className="text-indigo-500 hover:text-indigo-600 font-medium text-sm mt-2">Registrar el primero</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map(client => (
            <div key={client.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 hover:-translate-y-1 hover:shadow-md transition-all group relative">
              {hasPermission(client.user_id) && (
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openModal(client); }} className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 rounded-md transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDelete(client.id, e)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              
              <div className="flex items-center gap-3 pr-14">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shrink-0 border border-indigo-200 dark:border-indigo-800">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{client.name}</h3>
                  {client.company && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3" /> {client.company}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                {client.email ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">Sin correo</div>
                )}
                {client.phone ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>{client.phone}</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">Sin teléfono</div>
                )}
              </div>

              {client.projects && client.projects.length > 0 && (
                <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5" /> Proyectos ({client.projects.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {client.projects.map(p => (
                      <span key={p.id} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium" style={{ backgroundColor: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }}>
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Cliente *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Nombre completo" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" autoFocus required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Empresa (Opcional)</label>
                <input type="text" value={formData.company} onChange={(e) => setFormData({...formData, company: e.target.value})} placeholder="Nombre de la compañía" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Teléfono</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+1 234..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Asignar Proyectos</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 bg-slate-50 dark:bg-slate-950">
                  {availableProjects.length === 0 ? (
                    <p className="text-xs text-slate-500 p-2 italic">No hay proyectos disponibles en el área.</p>
                  ) : (
                    availableProjects.map(proj => (
                      <label key={proj.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-900/50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
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
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{proj.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 pb-2">
                <button type="submit" disabled={isSubmitting || !formData.name.trim()} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
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