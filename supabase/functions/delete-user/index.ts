// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar pre-flight de CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }
  
  try {
    // Inicializar cliente con Service Role (Bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 1. Validar quien hace la petición
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) throw new Error('Invalid token');

    // 2. Verificar que sea Administrador
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') throw new Error('Acceso denegado: Solo administradores pueden eliminar usuarios');

    // 3. Obtener el ID del usuario a eliminar
    const { target_user_id } = await req.json();
    if (!target_user_id) throw new Error('El ID de usuario es requerido');
    if (target_user_id === user.id) throw new Error('No puedes eliminarte a ti mismo');

    // 4. Eliminar el usuario desde Auth (Esto dispara el CASCADE a sus perfiles/datos)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
    if (deleteErr) throw deleteErr;

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})