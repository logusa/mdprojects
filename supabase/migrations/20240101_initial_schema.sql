-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Tareas
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'TODO', -- TODO, IN_PROGRESS, REVIEW, DONE
    priority TEXT DEFAULT 'MEDIUM',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Tabla de Documentos (Knowledge Base)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT,
    shared_with TEXT DEFAULT 'PRIVATE', -- PRIVATE, TEAM, GLOBAL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Políticas para Tareas: Solo el dueño puede ver y modificar sus tareas (en un futuro se puede expandir a equipos)
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Políticas para Documentos
CREATE POLICY "Users can view docs they own or are global/team" ON public.documents 
FOR SELECT USING (auth.uid() = author_id OR shared_with = 'GLOBAL' OR shared_with = 'TEAM');

CREATE POLICY "Users can insert docs" ON public.documents 
FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own docs" ON public.documents 
FOR UPDATE USING (auth.uid() = author_id);