import React, { useState, useEffect } from 'react';
import { RichEditor } from '@/components/docs/RichEditor';
import { Book, Plus, Save, Loader2, FileText, Trash2, Clock, ChevronLeft, User, Calendar } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
}

const Docs = () => {
  usePageTitle('Procesos');
  const { session } = useAuth();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initData = async () => {
      if (session) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data?.role === 'ADMIN') setIsAdmin(true);
      }
      fetchDocuments();
    };
    initData();
  }, [session]);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*, profiles(first_name, last_name)')
      .order('updated_at', { ascending: false });
      
    if (error) {
      showError('Error al cargar procesos');
    } else {
      setDocuments(data || []);
      if (data && data.length > 0 && !selectedDoc && window.innerWidth >= 768) {
        handleSelectDoc(data[0]);
      }
    }
    setLoading(false);
  };

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc);
    setEditedTitle(doc.title);
    setEditedContent(doc.content || '');
  };

  const createNewDoc = async () => {
    if (!session) return;
    setIsSaving(true);
    const newDoc = {
      title: 'Nuevo Proceso',
      content: '<h1>Nuevo Proceso</h1><p>Escribe aquí...</p>',
      author_id: session.user.id
    };

    const { data, error } = await supabase
      .from('documents')
      .insert(newDoc)
      .select('*, profiles(first_name, last_name)')
      .single();

    if (error) {
      showError('No se pudo crear el proceso');
    } else if (data) {
      setDocuments([data, ...documents]);
      handleSelectDoc(data);
      showSuccess('Proceso creado');
    }
    setIsSaving(false);
  };

  const saveDocument = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('documents')
      .update({
        title: editedTitle,
        content: editedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedDoc.id);

    if (error) {
      showError('Error al guardar. Verifica que tienes permisos.');
    } else {
      showSuccess('Proceso guardado');
      setDocuments(documents.map(d => 
        d.id === selectedDoc.id 
          ? { ...d, title: editedTitle, content: editedContent, updated_at: new Date().toISOString() } 
          : d
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    }
    setIsSaving(false);
  };

  const deleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar este proceso? Esta acción no se puede deshacer.')) return;
    
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      showError('Error al eliminar. Solo el autor o un administrador pueden borrarlo.');
    } else {
      showSuccess('Proceso eliminado');
      const filteredDocs = documents.filter(d => d.id !== id);
      setDocuments(filteredDocs);
      if (selectedDoc?.id === id) {
        if (filteredDocs.length > 0 && window.innerWidth >= 768) {
          handleSelectDoc(filteredDocs[0]);
        } else {
          setSelectedDoc(null);
          setEditedTitle('');
          setEditedContent('');
        }
      }
    }
  };

  const canEditSelectedDoc = isAdmin || (session?.user.id === selectedDoc?.author_id);

  return (
    <div className="flex w-full gap-0 md:gap-6 h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      
      {/* Sidebar de Procesos */}
      <div className={cn(
        "w-full md:w-72 lg:w-80 flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm shrink-0 overflow-hidden",
        selectedDoc ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
            <Book className="w-5 h-5" /> Base de Conocimiento
          </div>
          <button 
            onClick={createNewDoc} 
            disabled={isSaving}
            className="p-1.5 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 rounded-md transition-colors"
            title="Nuevo Proceso"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No hay procesos aún.</p>
            </div>
          ) : (
            documents.map(doc => {
              const canDeleteDoc = isAdmin || session?.user.id === doc.author_id;
              
              return (
                <div 
                  key={doc.id} 
                  onClick={() => handleSelectDoc(doc)}
                  className={cn(
                    "p-3 rounded-xl cursor-pointer transition-all group relative flex flex-col gap-1 border",
                    selectedDoc?.id === doc.id 
                      ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50" 
                      : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex justify-between items-start pr-6 mb-1">
                    <span className={cn(
                      "font-medium text-sm line-clamp-2",
                      selectedDoc?.id === doc.id ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {doc.title}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <User className="w-3 h-3" />
                    <span className="truncate">{doc.profiles?.first_name || 'Usuario'} {doc.profiles?.last_name || ''}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                  </div>
                  
                  {canDeleteDoc && (
                    <button 
                      onClick={(e) => deleteDocument(doc.id, e)}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 opacity-0 md:group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Área Principal de Edición */}
      <div className={cn(
        "flex-1 flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden",
        !selectedDoc ? "hidden md:flex" : "flex"
      )}>
        {selectedDoc ? (
          <>
            <div className="p-3 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4 bg-slate-50/30 dark:bg-slate-950/30">
              
              <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                <button 
                  onClick={() => setSelectedDoc(null)}
                  className="md:hidden mt-0.5 p-1.5 shrink-0 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <div className="flex flex-col gap-1 w-full">
                  <textarea 
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Título del proceso..."
                    rows={2}
                    readOnly={!canEditSelectedDoc}
                    className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 w-full resize-none leading-tight p-0 m-0"
                  />
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {selectedDoc.profiles?.first_name || 'Usuario'} {selectedDoc.profiles?.last_name || ''}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(selectedDoc.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </div>
                  </div>
                </div>
              </div>

              {canEditSelectedDoc && (
                <button 
                  onClick={saveDocument}
                  disabled={isSaving}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm shrink-0 shadow-sm shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-70 mt-2 md:mt-0"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-hidden p-0 sm:p-4 bg-slate-50/50 dark:bg-slate-950/50">
              <RichEditor 
                key={selectedDoc.id}
                initialContent={editedContent} 
                onChange={(html) => setEditedContent(html)} 
                editable={canEditSelectedDoc}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <Book className="w-16 h-16 text-slate-200 dark:text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Base de Conocimiento</h2>
            <p className="max-w-sm text-sm">Selecciona un proceso de la lista lateral o crea uno nuevo para empezar a redactar.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Docs;