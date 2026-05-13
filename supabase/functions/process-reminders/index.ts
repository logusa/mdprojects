// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Envío de correos usando la API de Resend
async function sendEmail(to: string, subject: string, body: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev'; // Cambia esto por tu dominio verificado

  if (!resendApiKey) {
    console.error('[Error] No se encontró la variable RESEND_API_KEY configurada.');
    return;
  }

  try {
    console.log(`[Enviando EMAIL a ${to}] Asunto: ${subject}`);
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', 
      headers: { 
        'Authorization': `Bearer ${resendApiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        from: fromEmail, 
        to: [to], 
        subject: subject, 
        html: body 
      })
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error(`[Error enviando email con Resend]:`, errorData);
    } else {
      console.log(`[Email enviado con éxito a ${to}]`);
    }
  } catch (err) {
    console.error(`[Excepción al enviar correo a ${to}]:`, err);
  }
}

// Este CRON se ejecutará cada 5 minutos automáticamente en la nube de Supabase
Deno.cron("Process Reminders", "*/5 * * * *", async () => {
  console.log("Iniciando revisión de recordatorios...");
  const now = new Date();

  // 1. REVISAR TAREAS
  const { data: reminders } = await supabase
    .from('task_reminders')
    .select('*, tasks(*, profiles!tasks_user_id_fkey(email))')
    .eq('is_sent', false);

  if (reminders) {
    for (const reminder of reminders) {
      if (!reminder.tasks?.due_date) continue;
      
      const dueDate = new Date(reminder.tasks.due_date);
      const reminderTime = new Date(dueDate.getTime() - (reminder.minutes_before * 60000));
      
      // Si la hora actual ya superó la hora programada del recordatorio
      if (now >= reminderTime) {
        // A) Enviar Notificación In-App
        await supabase.from('notifications').insert({
          user_id: reminder.tasks.user_id,
          title: 'Recordatorio de Tarea',
          message: `La tarea "${reminder.tasks.title}" vence pronto.`
        });

        // B) Enviar Correo Electrónico
        const userEmail = reminder.tasks.profiles?.email;
        if (userEmail) {
          await sendEmail(
            userEmail, 
            `Recordatorio: ${reminder.tasks.title}`, 
            `<p>Hola,</p><p>Te recordamos que tu tarea <strong>"${reminder.tasks.title}"</strong> vence el ${dueDate.toLocaleString()}.</p>`
          );
        }

        // C) Marcar como enviado
        await supabase.from('task_reminders').update({ is_sent: true }).eq('id', reminder.id);
      }
    }
  }

  // 2. REVISAR PROYECTOS (Avisar 1 día antes del vencimiento)
  const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const { data: projects } = await supabase
    .from('projects')
    .select('*, profiles!projects_user_id_fkey(email)')
    .not('due_date', 'is', null);

  if (projects) {
    for (const project of projects) {
      const pDate = new Date(project.due_date);
      // Si vence mañana (margen de 5 mins)
      if (pDate.getDate() === tomorrow.getDate() && pDate.getMonth() === tomorrow.getMonth() && pDate.getFullYear() === tomorrow.getFullYear()) {
        await supabase.from('notifications').insert({
          user_id: project.user_id,
          title: 'Proyecto por vencer',
          message: `El proyecto "${project.name}" vence mañana.`
        });
        
        if (project.profiles?.email) {
          await sendEmail(
            project.profiles.email, 
            `Proyecto por vencer: ${project.name}`, 
            `<p>Hola,</p><p>El proyecto <strong>"${project.name}"</strong> está programado para vencer mañana.</p>`
          );
        }
      }
    }
  }
});

serve(async (req) => {
  return new Response(JSON.stringify({ status: 'Cron Worker Active' }), { headers: { 'Content-Type': 'application/json' } })
});