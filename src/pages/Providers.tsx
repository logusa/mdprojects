import React, { useState, useEffect } from 'react';
import { Plus, Truck, X, Loader2, Pencil, Trash2, Mail, Phone, Building, Tag } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError } from '@/utils/toast';

export interface Provider {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  category: string | null;
  user_id: string;
}

const Providers = () => {
  usePageTitle('Proveedores');
  const { session } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    company: '',
    category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const initData = async () => {
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'ADMIN') setIsAdmin(true);
      fetchProviders();
    };
    initData();
  }, [session]);

  const fetchProviders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) setProviders(data);
    setLoading(false);
  };

  const openModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        email: provider.email || '',
        phone: provider.phone || '',
        company: provider.company || '',
        category: provider.category || ''
      });
    } else {
      setEditingProvider(null);
      setFormData({ name: '', email: '', phone: '', company: '', category: '' });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase.from('providers').delete().eq('id', id);
      if (error) throw error;
      setProviders(providers.filter(p => p.id !== id));
      showSuccess('Proveedor eliminado');
    } catch (err) {
      showError('Error al eliminar proveedor');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !formData.name.trim()) return;
    setIsSubmitting(true);

    const providerData = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      company: formData.company || null,
      category: formData.category || null,
    };

    try {
      if (editingProvider) {
        const { data, error } = await supabase.from('providers').update(providerData).eq('id', editingProvider.id).select().single();
        if (error) throw error;
        setProviders(providers.map(p => p.id === data.id ? data : p));
        showSuccess('Proveedor actualizado');
      } else {
        const { data, error } = await supabase.from('providers').insert({ ...providerData, user_id: session.user.id }).select().single();
        if (error) throw error;
        setProviders([data, ...providers]);
        showSuccess('Proveedor registrado exitosamente');
      }
      setIsModalOpen(false);
    } catch (err) {
      showError('Error al guardar el proveedor');
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
            <Truck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" /> Directorio de Proveedores
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona tu red de suministros y servicios externos.</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm w-full sm:w-auto shadow-sm shadow-indigo-600/20 active:scale-95">
          <Plus className="w-5 h-5" /> Nuevo Proveedor
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : providers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Truck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay proveedores registrados</p>
          <button onClick={() => openModal()} className="text-indigo-500 hover:text-indigo-600 font-medium text-sm mt-2">Registrar el primero</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {providers.map(provider => (
            <div key={provider.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col gap-4 hover:-translate-y-1 hover:shadow-md transition-all group relative">
              {hasPermission(provider.user_id) && (
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openModal(provider); }} className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 rounded-md transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={(e) => handleDelete(provider.id, e)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              
              <div className="flex items-center gap-3 pr-14">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg shrink-0 border border-orange-200 dark:border-orange-800">
                  {provider.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{provider.name}</h3>
                  {provider.company && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3" /> {provider.company}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex-grow">
                {provider.email ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{provider.email}</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">Sin correo</div>
                )}
                {provider.phone ? (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>{provider.phone}</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">Sin teléfono</div>
                )}
              </div>

              {provider.category && (
                <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    <Tag className="w-3 h-3" /> {provider.category}
                  </span>
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
              <h3 className="font-bold text-xl text-slate-800 dark:text-white">{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre del Proveedor / Contacto *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Nombre" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" autoFocus required />
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
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Categoría o Servicio (Opcional)</label>
                <input type="text" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="Ej. Materiales, Logística, Software..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>

              <div className="pt-4 pb-2">
                <button type="submit" disabled={isSubmitting || !formData.name.trim()} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingProvider ? 'Guardar Cambios' : 'Registrar Proveedor')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Providers;