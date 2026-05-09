import React from 'react';
import { UploadCloud, File, Folder, Lock } from 'lucide-react';

const Files = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Drive Enterprise</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
          <UploadCloud className="w-4 h-4" /> Subir Archivo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Mock Folders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
          <Folder className="w-8 h-8 text-blue-400" fill="currentColor" opacity={0.2} />
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Diseños UI</p>
            <p className="text-xs text-slate-400">12 archivos • Equipo</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
          <div className="relative">
            <Folder className="w-8 h-8 text-slate-400" fill="currentColor" opacity={0.2} />
            <Lock className="w-3 h-3 text-slate-500 absolute bottom-0 right-0" />
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Facturación</p>
            <p className="text-xs text-slate-400">3 archivos • Privado</p>
          </div>
        </div>
        
        {/* Mock File */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3 cursor-pointer hover:border-indigo-300 transition-colors">
          <div className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
            <File className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate">Reporte_Q3.pdf</p>
            <p className="text-xs text-slate-400">2.4 MB • Global</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Files;