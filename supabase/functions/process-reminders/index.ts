// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Función simulada de envío de correos (AQUÍ DEBES CONECTAR RESEND, SENDGRID, AWS SES, ETC)
async function sendEmail(to: string, subject: string, body: string) {
  console.log(`[EMAIL ENVIADO a ${to}] Asunto: ${subject}`);
  // Implementación real de ejemplo con Resend:
  // await fetch('https://api.resend.com/emails', {
  //   method: 'POST', headers: { 'Authorization': `Bearer TU_API_KEY`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ from: 'no-reply@tuapp.com', to, subject, html: body })
  // });
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
          await sendEmail(userEmail, `Recordatorio: ${reminder.tasks.title}`, `Hola, te recordamos que tu tarea "${reminder.tasks.title}" vence el ${dueDate.toLocaleString()}`);
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
          await sendEmail(project.profiles.email, `Proyecto por vencer: ${project.name}`, `El proyecto vence mañana.`);
        }
      }
    }
  }
});

serve(async (req) => {
  return new Response(JSON.stringify({ status: 'Cron Worker Active' }), { headers: { 'Content-Type': 'application/json' } })
});