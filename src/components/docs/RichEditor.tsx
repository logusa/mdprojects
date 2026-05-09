import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2 } from 'lucide-react';

export const RichEditor = () => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: `
      <h1>Especificaciones del Proyecto</h1>
      <p>Bienvenido al editor de la base de conocimientos. Aquí puedes documentar procesos y reglas de negocio.</p>
      <ul>
        <li>Integración continua con Docker</li>
        <li>Base de datos en Supabase con RLS</li>
      </ul>
      <blockquote>"La buena documentación es como un mapa, te guía cuando estás perdido."</blockquote>
    `,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-indigo max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
      <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-2 flex flex-wrap gap-1">
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          isActive={editor.isActive('heading', { level: 1 })}
          icon={<Heading1 className="w-4 h-4" />} 
        />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          isActive={editor.isActive('heading', { level: 2 })}
          icon={<Heading2 className="w-4 h-4" />} 
        />
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          isActive={editor.isActive('bold')}
          icon={<Bold className="w-4 h-4" />} 
        />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          isActive={editor.isActive('italic')}
          icon={<Italic className="w-4 h-4" />} 
        />
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          isActive={editor.isActive('bulletList')}
          icon={<List className="w-4 h-4" />} 
        />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          isActive={editor.isActive('orderedList')}
          icon={<ListOrdered className="w-4 h-4" />} 
        />
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          isActive={editor.isActive('blockquote')}
          icon={<Quote className="w-4 h-4" />} 
        />
      </div>
      <div className="p-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const MenuButton = ({ onClick, isActive, icon }: { onClick: () => void, isActive: boolean, icon: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg transition-colors ${
      isActive 
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
        : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
    }`}
  >
    {icon}
  </button>
);