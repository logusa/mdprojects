import React from 'react';
import { RichEditor } from '@/components/docs/RichEditor';
import { Book, Share2, History } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

const Docs = () => {
  usePageTitle('Documentos');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
            <Book className="w-5 h-5" />
            <span className="font-medium">Knowledge Base</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Especificaciones del Proyecto</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors">
            <History className="w-4 h-4" /> Historial
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            <Share2 className="w-4 h-4" /> Compartir
          </button>
        </div>
      </div>

      <RichEditor />
    </div>
  );
};

export default Docs;