import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2 } from 'lucide-react';

interface RichEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export const RichEditor = ({ initialContent, onChange, editable = true }: RichEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base dark:prose-invert prose-indigo max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm flex flex-col h-full">
      {/* Barra de herramientas (Solo visible si es editable) */}
      {editable && (
        <div className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 p-2 flex items-center gap-1 overflow-x-auto hide-scrollbar touch-pan-x">
          <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={<Heading1 className="w-4 h-4" />} />
          <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={<Heading2 className="w-4 h-4" />} />
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
          <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={<Bold className="w-4 h-4" />} />
          <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={<Italic className="w-4 h-4" />} />
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />
          <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={<List className="w-4 h-4" />} />
          <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} icon={<ListOrdered className="w-4 h-4" />} />
          <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={<Quote className="w-4 h-4" />} />
        </div>
      )}
      
      <div className={`p-4 sm:p-6 flex-1 overflow-y-auto bg-white dark:bg-slate-900 ${!editable ? 'opacity-90' : ''}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

const MenuButton = ({ onClick, isActive, icon }: { onClick: () => void, isActive: boolean, icon: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-2.5 rounded-lg transition-colors shrink-0 ${
      isActive 
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' 
        : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
    }`}
  >
    {icon}
  </button>
);