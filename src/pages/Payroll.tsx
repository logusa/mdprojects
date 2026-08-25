"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Banknote, Users, History, Save, Plus, Loader2, DollarSign, Calendar, ChevronRight, User, FolderKanban, CheckCircle2, AlertCircle, X, FileUp, Download, Info } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../components/auth/AuthProvider';
import { usePageTitle } from '../hooks/usePageTitle';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import Papa from 'papaparse';

interface StaffProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  salary?: {
    amount: number;
    period: string;
  };
}

const Payroll = () => {
  usePageTitle('Nómina y Salarios');
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>('staff');
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal Pago Individual
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    project_id: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  // Modal Masivo
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [isProcessingBulk, setIsBulkProcessing] = useState(false);

  // Modal Sueldo
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ amount: 0, period: 'MONTHLY' });

  useEffect(() => {
    const init = async () => {
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role === 'ADMIN') setIsAdmin(true);
      fetchData();
    };
    init();
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, salariesRes, projectsRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, role').order('first_name'),
      supabase.from('salaries').select('*'),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('payroll_payments').select('*, projects(name), profiles(first_name, last_name)').order('payment_date', { ascending: false })
    ]);

    if (profilesRes.data) {
      const mergedStaff = profilesRes.data.map(p => ({
        ...p,
        salary: salariesRes.data?.find(s => s.user_id === p.id)
      }));
      setStaff(mergedStaff);
    }
    if (projectsRes.data) setProjects(projectsRes.data);
    if (historyRes.data) setHistory(historyRes.data);
    setLoading(false);
  };

  const handleUpdateSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    const { error } = await supabase.from('salaries').upsert({
      user_id: selectedStaff.id,
      amount: salaryForm.amount,
      period: salaryForm.period,
      updated_at: new Date().toISOString()
    });
    if (!error) { showSuccess('Sueldo actualizado'); setIsSalaryModalOpen(false); fetchData(); }
    else showError('Error al actualizar sueldo');
  };

  const processPaymentRecord = async (p: { user_id: string, project_id?: string | null, amount: number, date: string, description: string }) => {
    const { data: payment, error } = await supabase.from('payroll_payments').insert({
      user_id: p.user_id,
      project_id: p.project_id || null,
      amount: p.amount,
      payment_date: p.date,
      description: p.description
    }).select().single();

    if (error) throw error;

    if (p.project_id) {
      const profile = staff.find(s => s.id === p.user_id);
      await supabase.from('project_transactions').insert({
        project_id: p.project_id,
        type: 'EXPENSE',
        category: 'Mano de Obra',
        description: `Nómina: ${profile?.first_name} ${profile?.last_name} (${p.description || 'S/D'})`,
        amount: p.amount,
        date: p.date,
        user_id: session?.user.id
      });
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    const tid = showLoading('Procesando pago...');
    try {
      await processPaymentRecord({
        user_id: selectedStaff.id,
        project_id: paymentData.project_id,
        amount: paymentData.amount,
        date: paymentData.date,
        description: paymentData.description || `Pago de nómina - ${selectedStaff.first_name}`
      });
      showSuccess('Pago registrado correctamente');
      setIsPayModalOpen(false);
      fetchData();
    } catch (err) { showError('No se pudo procesar el pago'); }
    finally { dismissToast(tid); }
  };

  // --- Lógica de Carga Masiva ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const matchedData = rows.map(row => {
          // Normalización de encabezados
          const findVal = (keys: string[]) => {
            const key = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return key ? row[key] : null;
          };

          const empName = findVal(['empleado', 'trabajador', 'nombre', 'staff']);
          const monto = parseFloat(findVal(['monto', 'pago', 'cantidad', 'total', 'salario'])?.replace(/[^0-9.]/g, '') || '0');
          const projName = findVal(['proyecto', 'obra', 'cost center']);
          const fechaStr = findVal(['fecha', 'date', 'periodo']);
          const concepto = findVal(['concepto', 'descripcion', 'description', 'nota']);

          // Buscar empleado
          const matchedStaff = staff.find(s => 
            `${s.first_name} ${s.last_name}`.toLowerCase().includes(empName?.toLowerCase() || '') ||
            empName?.toLowerCase().includes(s.first_name.toLowerCase())
          );

          // Buscar proyecto
          const matchedProj = projects.find(p => p.name.toLowerCase() === projName?.toLowerCase());

          // Formatear fecha
          let finalDate = format(new Date(), 'yyyy-MM-dd');
          if (fechaStr) {
             try {
               const parsedDate = fechaStr.includes('/') 
                ? parse(fechaStr, 'dd/MM/yyyy', new Date()) 
                : new Date(fechaStr);
               if (!isNaN(parsedDate.getTime())) finalDate = format(parsedDate, 'yyyy-MM-dd');
             } catch(e) {}
          }

          return {
            row,
            staff: matchedStaff,
            project: matchedProj,
            amount: monto,
            date: finalDate,
            description: concepto || `Carga masiva - ${empName}`,
            empInput: empName,
            projInput: projName,
            status: matchedStaff ? (monto > 0 ? 'valid' : 'no_amount') : 'not_found'
          };
        });

        setBulkData(matchedData);
        setIsBulkModalOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const confirmBulkPayment = async () => {
    const validRows = bulkData.filter(d => d.status === 'valid');
    if (validRows.length === 0) return;

    setIsBulkProcessing(true);
    const tid = showLoading(`Procesando ${validRows.length} pagos...`);
    
    try {
      for (const row of validRows) {
        await processPaymentRecord({
          user_id: row.staff.id,
          project_id: row.project?.id,
          amount: row.amount,
          date: row.date,
          description: row.description
        });
      }
      showSuccess('Carga masiva completada con éxito');
      setIsBulkModalOpen(false);
      fetchData();
    } catch (err) {
      showError('Ocurrió un error en uno de los registros. Algunos pagos podrían no haberse guardado.');
    } finally {
      setIsBulkProcessing(false);
      dismissToast(tid);
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([{
      Empleado: 'Nombre del Trabajador',
      Monto: '1000.00',
      Proyecto: 'Nombre del Proyecto Exacto (Opcional)',
      Fecha: '2024-03-15',
      Concepto: 'Pago quincenal'
    }]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'plantilla_nomina.csv');
    link.click();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Acceso Restringido</h2>
        <p className="text-slate-500 max-w-xs mt-2">Solo los administradores pueden gestionar la nómina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Banknote className="w-8 h-8 text-indigo-500" /> Nómina y Control de Sueldos
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestiona compensaciones e importaciones masivas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button onClick={() => setActiveTab('staff')} className={cn("flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all", activeTab === 'staff' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}><Users className="w-4 h-4" /> Personal</button>
            <button onClick={() => setActiveTab('history')} className={cn("flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all", activeTab === 'history' ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500")}><History className="w-4 h-4" /> Historial</button>
          </div>

          <div className="flex gap-2">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                <FileUp className="w-4 h-4 text-indigo-500" /> Carga Masiva
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>
      ) : activeTab === 'staff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((member) => (
            <div key={member.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group border-b-4 border-b-slate-100 dark:border-b-slate-800 hover:border-b-indigo-500">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-500">{member.first_name[0]}</div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estatus</span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", member.salary ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600")}>{member.salary ? 'Sueldo Definido' : 'Sin Configurar'}</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{member.first_name} {member.last_name}</h3>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">{member.role}</p>
              <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sueldo Base</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">${member.salary?.amount.toLocaleString() || '0'}<span className="text-xs text-slate-400 font-bold ml-1">/ {member.salary?.period === 'MONTHLY' ? 'Mes' : member.salary?.period === 'WEEKLY' ? 'Sem' : 'Quinc'}</span></p>
                </div>
                <button onClick={() => { setSelectedStaff(member); setSalaryForm({ amount: member.salary?.amount || 0, period: member.salary?.period || 'MONTHLY' }); setIsSalaryModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Save className="w-5 h-5" /></button>
              </div>
              <button onClick={() => { setSelectedStaff(member); setPaymentData({ ...paymentData, amount: member.salary?.amount || 0 }); setIsPayModalOpen(true); }} className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Registrar Pago</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr><th className="px-8 py-5">Fecha</th><th className="px-8 py-5">Empleado</th><th className="px-8 py-5">Proyecto Asociado</th><th className="px-8 py-5">Concepto</th><th className="px-8 py-5 text-right">Monto Pagado</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {history.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-bold text-slate-500">{format(new Date(pay.payment_date), 'dd MMM, yyyy', { locale: es })}</td>
                  <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600">{pay.profiles?.first_name[0]}</div><span className="text-sm font-bold text-slate-800 dark:text-slate-100">{pay.profiles?.first_name} {pay.profiles?.last_name}</span></div></td>
                  <td className="px-8 py-5">{pay.projects ? <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400"><FolderKanban className="w-3.5 h-3.5 text-indigo-400" /> {pay.projects.name}</div> : <span className="text-[10px] font-black text-slate-300 uppercase">Gasto General</span>}</td>
                  <td className="px-8 py-5 text-sm text-slate-500 italic max-w-xs truncate">{pay.description}</td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 dark:text-white">${pay.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Masivo */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div><h3 className="font-bold text-xl text-slate-900 dark:text-white">Previsualización de Carga</h3><p className="text-xs text-slate-500">Revisa los datos antes de confirmar los registros en la contabilidad.</p></div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
               <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">Solo los registros marcados con <CheckCircle2 className="w-3 h-3 inline text-emerald-500" /> se procesarán. Asegúrate de que los nombres de los empleados y proyectos coincidan con los del sistema.</p>
               </div>
               
               <div className="space-y-3">
                  {bulkData.map((d, i) => (
                    <div key={i} className={cn("p-4 rounded-2xl border flex items-center justify-between", d.status === 'valid' ? "bg-white border-slate-100" : "bg-red-50/30 border-red-100 opacity-80")}>
                        <div className="flex items-center gap-4 flex-1">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", d.status === 'valid' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                                {d.status === 'valid' ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800">{d.empInput || 'Sin nombre'}</p>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                   <span className={cn(d.staff ? "text-indigo-500" : "text-red-500")}>{d.staff ? `${d.staff.first_name} matched` : 'Empleado no encontrado'}</span>
                                   {d.projInput && <span>•</span>}
                                   <span className={cn(d.project ? "text-emerald-500" : "text-slate-400")}>{d.project ? `Proyecto: ${d.project.name}` : d.projInput ? 'Proyecto no coincide' : ''}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-slate-900">${d.amount.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400">{d.date}</p>
                        </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
               <button onClick={downloadTemplate} className="flex items-center gap-2 text-indigo-600 text-sm font-bold hover:underline"><Download className="w-4 h-4" /> Descargar Plantilla Correcta</button>
               <div className="flex gap-2 w-full sm:w-auto">
                 <button onClick={() => setIsBulkModalOpen(false)} className="flex-1 sm:flex-none px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                 <button onClick={confirmBulkPayment} disabled={isProcessingBulk || bulkData.filter(d => d.status === 'valid').length === 0} className="flex-1 sm:flex-none px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50">Confirmar {bulkData.filter(d => d.status === 'valid').length} Pagos</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Individual */}
      {isPayModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div><h3 className="font-bold text-xl text-slate-900 dark:text-white">Procesar Pago de Nómina</h3><p className="text-xs text-slate-500 font-medium">Destinatario: {selectedStaff?.first_name} {selectedStaff?.last_name}</p></div>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleProcessPayment} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Monto a Pagar</label><div className="relative"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500" required /></div></div>
                <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Pago</label><div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="date" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" required /></div></div>
              </div>
              <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Asignar a Proyecto (Contabilidad)</label><div className="relative"><FolderKanban className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><select value={paymentData.project_id} onChange={e => setPaymentData({...paymentData, project_id: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none appearance-none"><option value="">Gasto General (Sin proyecto)</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
              <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Concepto</label><textarea value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Ej. Pago correspondiente a la segunda quincena de marzo" rows={2} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none resize-none" /></div>
              <div className="pt-4"><button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg">Confirmar y Registrar Pago</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sueldo */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div><h3 className="font-bold text-xl text-slate-900 dark:text-white">Configurar Sueldo</h3><p className="text-xs text-slate-500 font-medium">{selectedStaff?.first_name} {selectedStaff?.last_name}</p></div>
              <button onClick={() => setIsSalaryModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateSalary} className="p-8 space-y-6">
              <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Monto del Sueldo</label><div className="relative"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="number" value={salaryForm.amount} onChange={e => setSalaryForm({...salaryForm, amount: Number(e.target.value)})} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black outline-none focus:ring-2 focus:ring-indigo-500" required /></div></div>
              <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Periodo de Pago</label><select value={salaryForm.period} onChange={e => setSalaryForm({...salaryForm, period: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none"><option value="WEEKLY">Semanal</option><option value="BIWEEKLY">Quincenal</option><option value="MONTHLY">Mensual</option></select></div>
              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-black active:scale-95 transition-all">Guardar Configuración</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;