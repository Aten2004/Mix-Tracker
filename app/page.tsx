'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Calendar as CalIcon, 
  ListFilter, 
  Table as TableIcon, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit3,
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  FileText, 
  Clock, 
  Layers, 
  ExternalLink, 
  FolderOpen, 
  Lock, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  RefreshCw,
  Target,
  BarChart3,
  TrendingUp,
  HelpCircle,
  Calculator,
  Copy,
  Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  JobItem, 
  BillingCycle,
  parseQuickCode, 
  parseSheetRow, 
  formatToDisplayDate, 
  isDateString 
} from '@/lib/parser';

interface NoteItem {
  id: string;
  workspace: string;
  date: string;
  title: string;
  content: string;
}

interface CustomDialog {
  type: 'alert' | 'confirm' | 'prompt';
  title: string;
  desc?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onSubmit?: (val: string) => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'queue' | 'calendar' | 'table' | 'billing'>('queue');
  const [tableSubView, setTableSubView] = useState<'table' | 'analytics'>('table');
  const [loading, setLoading] = useState(true);

  // Workspaces
  const [workspaces, setWorkspaces] = useState<string[]>(['ทีมซีรีส์จีน (GS/DW)', 'ทีมสำรอง']);
  const [selectedWs, setSelectedWs] = useState<string>('ทีมซีรีส์จีน (GS/DW)');

  // Main Datasets จาก Supabase
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);

  // State ยุบ/ขยาย กล่องโน้ต และเป้าหมาย
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const [isTargetCollapsed, setIsTargetCollapsed] = useState(false);
  const [showCalcGuide, setShowCalcGuide] = useState(false);

  // เป้าหมายรายได้สุทธิ (Net Target)
  const [monthlyTarget, setMonthlyTarget] = useState<number>(14700);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('14700');

  // Form Inputs
  const [quickInput, setQuickInput] = useState('');
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [sheetPaste, setSheetPaste] = useState('');

  // Note Inputs
  const [noteDate, setNoteDate] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Editing Job Modal
  const [editingJob, setEditingJob] = useState<JobItem | null>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 9, 1));
  const [selectedCalDate, setSelectedCalDate] = useState<string>('');
  const [todayStr, setTodayStr] = useState<string>('');
  const [todayDisplay, setTodayDisplay] = useState<string>('');

  // Cutoff Billing Date State
  const [cutoffDate, setCutoffDate] = useState<string>('2026-10-31');

  // Custom Unified Dialog State
  const [dialogState, setDialogState] = useState<CustomDialog | null>(null);
  const [promptInputValue, setPromptInputValue] = useState('');

  // สถานะบอกว่าเพิ่งคัดลอกงาน id ไหนไป (เพื่อแสดง feedback ทันทีโดยไม่ต้องเปิด popup)
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const thaiDays = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

  // โหลดค่า LocalStorage และวันที่ Client-side ปลอดภัยต่อ Prerender
  useEffect(() => {
    const savedTarget = localStorage.getItem('mix_monthly_target');
    if (savedTarget) {
      const val = parseFloat(savedTarget);
      if (!isNaN(val)) {
        setMonthlyTarget(val);
        setTargetInput(val.toString());
      }
    }

    const savedNotesCol = localStorage.getItem('mix_notes_collapsed');
    if (savedNotesCol) setIsNotesCollapsed(savedNotesCol === 'true');

    const savedTargetCol = localStorage.getItem('mix_target_collapsed');
    if (savedTargetCol) setIsTargetCollapsed(savedTargetCol === 'true');

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const dayName = thaiDays[now.getDay()];
    setTodayStr(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setTodayDisplay(`${dayName}ที่ ${d} ${monthNames[m]} ${y}`);
  }, []);

  useEffect(() => {
    if (dialogState?.type === 'prompt') {
      setPromptInputValue(dialogState.inputValue || '');
    }
  }, [dialogState]);

  const toggleNotesCollapse = () => {
    const nextVal = !isNotesCollapsed;
    setIsNotesCollapsed(nextVal);
    localStorage.setItem('mix_notes_collapsed', String(nextVal));
  };

  const toggleTargetCollapse = () => {
    const nextVal = !isTargetCollapsed;
    setIsTargetCollapsed(nextVal);
    localStorage.setItem('mix_target_collapsed', String(nextVal));
  };

  const saveTargetGoal = () => {
    const val = parseFloat(targetInput);
    if (!isNaN(val) && val >= 0) {
      setMonthlyTarget(val);
      localStorage.setItem('mix_monthly_target', val.toString());
      setIsEditingTarget(false);
    }
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // ดึงข้อมูลจริงจาก Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: wsData } = await supabase.from('workspaces').select('name').order('created_at', { ascending: true });
      if (wsData && wsData.length > 0) {
        const names = wsData.map(w => w.name);
        setWorkspaces(names);
        if (!names.includes(selectedWs)) {
          setSelectedWs(names[0]);
        }
      }

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobsData) {
        setJobs(jobsData.map(row => ({
          id: row.id,
          workspace: row.workspace,
          title: row.title,
          episode: row.episode || '',
          minutes: Number(row.minutes) || 0,
          drive_url: row.drive_url || '',
          date_glao: row.date_glao || '',
          date_pak: row.date_pak || '',
          date_mix: row.date_mix || '',
          date_sub: row.date_sub || '',
          date_deadline: row.date_deadline || '',
          isIncludedInBilling: row.is_included_in_billing ?? true,
          status: row.status || 'pending',
          billingCycleId: row.billing_cycle_id || undefined
        })));
      }

      const { data: notesData } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
      if (notesData) {
        setNotes(notesData.map(n => ({
          id: n.id,
          workspace: n.workspace,
          date: n.date || '',
          title: n.title,
          content: n.content || ''
        })));
      }

      const { data: cycleData } = await supabase.from('billing_cycles').select('*').order('created_at', { ascending: false });
      if (cycleData) {
        setBillingCycles(cycleData.map(c => ({
          id: c.id,
          workspace: c.workspace,
          title: c.title,
          cutoffDate: c.cutoff_date,
          totalMinutes: Number(c.total_minutes) || 0,
          grossIncome: Number(c.gross_income) || 0,
          taxAmount: Number(c.tax_amount) || 0,
          netIncome: Number(c.net_income) || 0,
          jobCount: Number(c.job_count) || 0,
          jobIds: Array.isArray(c.job_ids) ? c.job_ids : [],
          createdAt: c.created_at
        })));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 underline hover:text-red-300 break-all inline-flex items-center gap-1 font-mono font-medium"
          >
            {part} <ExternalLink size={12} className="inline shrink-0" />
          </a>
        );
      }
      return part;
    });
  };

  // จัดการ Workspace ผ่าน Custom Dialog
  const handleAddWorkspace = () => {
    setDialogState({
      type: 'prompt',
      title: 'เพิ่มทีมใหม่',
      desc: 'กรุณากรอกชื่อทีม / Workspace:',
      inputPlaceholder: 'เช่น ทีมซีรีส์เกาหลี',
      confirmText: 'บันทึก',
      onSubmit: async (name) => {
        if (name && name.trim() && !workspaces.includes(name.trim())) {
          const trimmed = name.trim();
          await supabase.from('workspaces').insert([{ name: trimmed }]);
          setWorkspaces(prev => [...prev, trimmed]);
          setSelectedWs(trimmed);
        }
      }
    });
  };

  const handleRenameWorkspace = () => {
    setDialogState({
      type: 'prompt',
      title: 'เปลี่ยนชื่อทีม',
      desc: `เปลี่ยนชื่อทีม "${selectedWs}" เป็น:`,
      inputValue: selectedWs,
      inputPlaceholder: 'ชื่อทีมใหม่',
      confirmText: 'เปลี่ยนชื่อ',
      onSubmit: async (newName) => {
        if (newName && newName.trim() && newName.trim() !== selectedWs) {
          const trimmed = newName.trim();
          await supabase.from('workspaces').update({ name: trimmed }).eq('name', selectedWs);
          await supabase.from('jobs').update({ workspace: trimmed }).eq('workspace', selectedWs);
          await supabase.from('notes').update({ workspace: trimmed }).eq('workspace', selectedWs);
          await supabase.from('billing_cycles').update({ workspace: trimmed }).eq('workspace', selectedWs);
          setWorkspaces(prev => prev.map(w => w === selectedWs ? trimmed : w));
          setSelectedWs(trimmed);
          fetchData();
        }
      }
    });
  };

  const handleDeleteWorkspace = () => {
    if (workspaces.length <= 1) {
      setDialogState({ title: 'ไม่สามารถลบได้', desc: 'ต้องมี Workspace อย่างน้อย 1 ทีม', type: 'alert' });
      return;
    }
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการลบทีม',
      desc: `ยืนยันการลบทีม "${selectedWs}" พร้อมข้อมูลทั้งหมดหรือไม่? (ข้อมูลจะไม่สามารถกู้คืนได้)`,
      confirmText: 'ยืนยันการลบ',
      onConfirm: async () => {
        await supabase.from('workspaces').delete().eq('name', selectedWs);
        await supabase.from('jobs').delete().eq('workspace', selectedWs);
        await supabase.from('notes').delete().eq('workspace', selectedWs);
        await supabase.from('billing_cycles').delete().eq('workspace', selectedWs);
        const remaining = workspaces.filter(w => w !== selectedWs);
        setWorkspaces(remaining);
        setSelectedWs(remaining[0]);
        fetchData();
      }
    });
  };

  const handleAddJob = async () => {
    let finalTitle = '';
    let finalEpisode = '';
    let finalMinutes = 0;
    let finalDriveUrl = driveUrlInput.trim();
    let dates = {
      date_glao: '',
      date_pak: '',
      date_mix: '',
      date_sub: '',
      date_deadline: ''
    };

    if (quickInput.trim()) {
      const q = parseQuickCode(quickInput);
      finalTitle = q.title;
      finalEpisode = q.episode;
      finalMinutes = q.minutes;
      if (!finalDriveUrl && q.drive_url) finalDriveUrl = q.drive_url;
    }

    if (sheetPaste.trim()) {
      const s = parseSheetRow(sheetPaste);
      if (s) {
        if (!finalTitle && s.title) finalTitle = s.title;
        dates = {
          date_glao: s.date_glao || '',
          date_pak: s.date_pak || '',
          date_mix: s.date_mix || '',
          date_sub: s.date_sub || '',
          date_deadline: s.date_deadline || ''
        };
      }
    }

    if (isDateString(finalTitle)) finalTitle = 'งานไม่มีชื่อ';

    if (!finalTitle) {
      setDialogState({ title: 'ข้อมูลไม่ครบ', desc: 'กรุณากรอกรหัสงานหรือข้อมูลจากชีท', type: 'alert' });
      return;
    }

    const payload = {
      id: Date.now().toString(),
      workspace: selectedWs,
      title: finalTitle,
      episode: finalEpisode,
      minutes: finalMinutes,
      drive_url: finalDriveUrl,
      ...dates,
      is_included_in_billing: true,
      status: 'pending'
    };

    const { error } = await supabase.from('jobs').insert([payload]);

    if (!error) {
      setQuickInput('');
      setDriveUrlInput('');
      setSheetPaste('');
      fetchData();
      setDialogState({ title: 'สำเร็จ', desc: `เพิ่มงาน ${finalTitle} เข้าสู่ระบบแล้ว`, type: 'alert' });
    } else {
      setDialogState({ title: 'เกิดข้อผิดพลาด', desc: error.message, type: 'alert' });
    }
  };

  const handleSaveEditJob = () => {
    if (!editingJob) return;
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการแก้ไขข้อมูล',
      desc: `ต้องการบันทึกการแก้ไขของงาน "${editingJob.title}" ใช่หรือไม่?`,
      confirmText: 'บันทึก',
      onConfirm: async () => {
        const { error } = await supabase.from('jobs').update({
          title: editingJob.title,
          episode: editingJob.episode,
          minutes: editingJob.minutes,
          drive_url: editingJob.drive_url || '',
          date_mix: editingJob.date_mix,
          date_deadline: editingJob.date_deadline
        }).eq('id', editingJob.id);

        if (!error) {
          setEditingJob(null);
          fetchData();
        } else {
          setDialogState({ title: 'เกิดข้อผิดพลาด', desc: error.message, type: 'alert' });
        }
      }
    });
  };

  const toggleJobBilling = async (job: JobItem) => {
    const nextVal = !job.isIncludedInBilling;
    setJobs(jobs.map(j => j.id === job.id ? { ...j, isIncludedInBilling: nextVal } : j));
    await supabase.from('jobs').update({ is_included_in_billing: nextVal }).eq('id', job.id);
  };

  const handleDeleteJob = (id: string, title?: string) => {
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการลบงาน',
      desc: `คุณแน่ใจหรือไม่ว่าต้องการลบงาน "${title || 'รายการนี้'}" ออกจากระบบ?`,
      confirmText: 'ลบงาน',
      onConfirm: async () => {
        setJobs(prev => prev.filter(j => j.id !== id));
        await supabase.from('jobs').delete().eq('id', id);
      }
    });
  };

  const handleAddNote = async () => {
    if (!noteTitle.trim()) return;
    const newNote = {
      id: Date.now().toString(),
      workspace: selectedWs,
      date: noteDate || new Date().toISOString().split('T')[0],
      title: noteTitle,
      content: noteContent
    };

    const { error } = await supabase.from('notes').insert([newNote]);
    if (!error) {
      setNoteTitle('');
      setNoteContent('');
      fetchData();
    }
  };

  const handleDeleteNote = (id: string, title?: string) => {
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการลบบันทึก',
      desc: `คุณแน่ใจหรือไม่ว่าต้องการลบบันทึก "${title || 'รายการนี้'}" ?`,
      confirmText: 'ลบบันทึก',
      onConfirm: async () => {
        setNotes(prev => prev.filter(n => n.id !== id));
        await supabase.from('notes').delete().eq('id', id);
      }
    });
  };

  // คัดลอกรหัสงานรายเรื่อง (ชื่อ_ตอน_นาที) แบบกดแล้วก็อปได้ทันที ไม่ต้องมีป๊อปอัปยืนยัน
  const handleCopyJob = (job: JobItem) => {
    const code = job.episode ? `${job.title}_${job.episode}_${job.minutes}` : `${job.title}_${job.minutes}`;
    navigator.clipboard.writeText(code);
    setCopiedJobId(job.id);
    setTimeout(() => {
      setCopiedJobId(null);
    }, 1500);
  };

  // สรุปยอด
  const filteredJobs = useMemo(() => jobs.filter(j => j.workspace === selectedWs), [jobs, selectedWs]);
  const filteredNotes = useMemo(() => notes.filter(n => n.workspace === selectedWs), [notes, selectedWs]);
  const filteredCycles = useMemo(() => billingCycles.filter(b => b.workspace === selectedWs), [billingCycles, selectedWs]);

  const pendingJobs = useMemo(() => filteredJobs.filter(j => j.status === 'pending'), [filteredJobs]);
  const activeBilledJobs = useMemo(() => pendingJobs.filter(j => j.isIncludedInBilling), [pendingJobs]);

  const currentTotalMins = useMemo(() => activeBilledJobs.reduce((acc, cur) => acc + (Number(cur.minutes) || 0), 0), [activeBilledJobs]);
  const currentGross = currentTotalMins * 15;
  const currentTax = currentGross * 0.03;
  const currentNet = currentGross - currentTax;

  // คัดลอกข้อมูลหนังทั้งหมดในหน้าตาราง (ตัดบรรทัดหักภาษีออก เหลือเฉพาะยอดเต็มและยอดสุทธิ)
  const handleCopyAllJobs = () => {
    if (filteredJobs.length === 0) {
      setDialogState({
        type: 'alert',
        title: 'ไม่มีข้อมูล',
        desc: 'ไม่มีรายการงานในตารางให้คัดลอก'
      });
      return;
    }
    const lines = filteredJobs.map(j => j.episode ? `${j.title}_${j.episode}_${j.minutes}` : `${j.title}_${j.minutes}`);
    const minValues = filteredJobs.map(j => Number(j.minutes) || 0);
    const sumTotal = minValues.reduce((a, b) => a + b, 0);
    const sumString = minValues.length > 0 ? `${minValues.join(' + ')} = ${sumTotal} นาที` : '0 นาที';
    
    // คำนวณยอดเต็มและยอดสุทธิ (หัก 3%)
    const totalGross = sumTotal * 15;
    const totalNet = totalGross * 0.97;

    const output = `${lines.join('\n')}\n\nผลรวมนาที: ${sumString}\nยอดเต็ม: ฿${totalGross.toLocaleString()}\nยอดสุทธิ: ฿${totalNet.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท`;
    
    navigator.clipboard.writeText(output);
    setDialogState({
      type: 'alert',
      title: 'คัดลอกสรุปรายการทั้งหมดแล้ว',
      desc: output
    });
  };

  // คำนวณเป้าหมาย (Net Target)
  const netRatePerMin = 15 * 0.97;
  const totalMinsNeeded = Math.ceil(monthlyTarget / netRatePerMin);
  const remainingMinsNeeded = Math.max(0, totalMinsNeeded - currentTotalMins);
  const remainingMoneyNeeded = Math.max(0, monthlyTarget - currentNet);
  const targetPercent = monthlyTarget > 0 ? Math.min(100, Math.round((currentNet / monthlyTarget) * 100)) : 100;

  const avgMovieLength = useMemo(() => {
    const validJobs = filteredJobs.filter(j => j.minutes > 0);
    if (validJobs.length === 0) return 80;
    const sum = validJobs.reduce((acc, c) => acc + c.minutes, 0);
    return Math.round(sum / validJobs.length) || 80;
  }, [filteredJobs]);

  const remainingMoviesEst = Math.ceil(remainingMinsNeeded / avgMovieLength);

  // สถิติ (Analytics)
  const analyticsData = useMemo(() => {
    let gsMins = 0;
    let gsCount = 0;
    let dwMins = 0;
    let dwCount = 0;
    let periodEarly = 0;
    let periodMid = 0;
    let periodLate = 0;

    filteredJobs.forEach(j => {
      const isDW = j.title.toUpperCase().startsWith('DW');
      const m = Number(j.minutes) || 0;
      if (isDW) {
        dwMins += m;
        dwCount += 1;
      } else {
        gsMins += m;
        gsCount += 1;
      }

      const dateRef = j.date_mix || j.date_deadline || j.date_glao;
      if (dateRef) {
        const parts = dateRef.split('-');
        const day = parseInt(parts[2], 10);
        if (day >= 1 && day <= 10) periodEarly += m;
        else if (day >= 11 && day <= 20) periodMid += m;
        else if (day >= 21) periodLate += m;
      }
    });

    const totalAllMins = gsMins + dwMins;
    const mostWorkedType = gsMins >= dwMins ? 'GS (ซีรีส์ทั่วไป)' : 'DW (ซีรีส์พรีเมียม)';
    const maxPeriodMins = Math.max(periodEarly, periodMid, periodLate);
    let mostActivePeriodName = 'ยังไม่มีข้อมูล';
    if (maxPeriodMins > 0) {
      if (maxPeriodMins === periodEarly) mostActivePeriodName = 'ต้นเดือน (1-10)';
      else if (maxPeriodMins === periodMid) mostActivePeriodName = 'กลางเดือน (11-20)';
      else mostActivePeriodName = 'ปลายเดือน (21-31)';
    }

    return {
      gsMins,
      gsCount,
      dwMins,
      dwCount,
      totalAllMins,
      mostWorkedType,
      periodEarly,
      periodMid,
      periodLate,
      maxPeriodMins,
      mostActivePeriodName
    };
  }, [filteredJobs]);

  const handleCloseBillingCycle = () => {
    if (activeBilledJobs.length === 0) {
      setDialogState({ title: 'ไม่สามารถปิดยอดได้', desc: 'ไม่มีรายการงานที่เลือกคิดเงิน', type: 'alert' });
      return;
    }
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการปิดรอบคำนวณเงิน',
      desc: `ยืนยันการปิดรอบคำนวณเงิน ${activeBilledJobs.length} เรื่อง รวม ${currentTotalMins} นาที\nยอดสุทธิ ฿${currentNet.toLocaleString()} หรือไม่?`,
      confirmText: 'ปิดรอบทันที',
      onConfirm: async () => {
        const cycleId = Date.now().toString();
        const cycleTitle = `รอบตัดยอด ${formatToDisplayDate(cutoffDate)}`;
        const newCycle = {
          id: cycleId,
          workspace: selectedWs,
          title: cycleTitle,
          cutoff_date: cutoffDate,
          total_minutes: currentTotalMins,
          gross_income: currentGross,
          tax_amount: currentTax,
          net_income: currentNet,
          job_count: activeBilledJobs.length,
          jobIds: activeBilledJobs.map(j => j.id)
        };

        await supabase.from('billing_cycles').insert([newCycle]);
        
        const targetIds = activeBilledJobs.map(j => j.id);
        await supabase.from('jobs').update({
          status: 'billed',
          billing_cycle_id: cycleId
        }).in('id', targetIds);

        fetchData();
        setDialogState({
          type: 'alert',
          title: 'ปิดรอบสำเร็จ',
          desc: `บันทึกรอบ "${cycleTitle}" รวม ${currentTotalMins} นาที ยอดสุทธิ ฿${currentNet.toLocaleString()}`
        });
      }
    });
  };

  const handleRollbackCycle = (cycle: BillingCycle) => {
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการยกเลิกรอบ',
      desc: `ต้องการยกเลิกรอบ "${cycle.title}" เพื่อนำงานทั้ง ${cycle.jobCount} เรื่องกลับมาคำนวณใหม่หรือไม่?`,
      confirmText: 'ยกเลิกรอบนี้',
      onConfirm: async () => {
        await supabase.from('jobs').update({
          status: 'pending',
          billing_cycle_id: null
        }).in('id', cycle.jobIds);

        await supabase.from('billing_cycles').delete().eq('id', cycle.id);
        fetchData();
        setDialogState({ title: 'สำเร็จ', desc: 'ยกเลิกรอบคิดเงินเรียบร้อยแล้ว', type: 'alert' });
      }
    });
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-[#f0f2f5] pb-28 font-sans select-none">
      
      {/* 1. Top Bar */}
      <header className="sticky top-0 z-30 bg-[#12141a]/95 backdrop-blur border-b border-[#262933] px-3 sm:px-4 py-2.5 sm:py-3.5">
        <div className="flex justify-between items-center max-w-xl md:max-w-2xl mx-auto gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <select 
                value={selectedWs} 
                onChange={(e) => setSelectedWs(e.target.value)}
                className="bg-transparent text-white font-black text-lg sm:text-xl focus:outline-none cursor-pointer max-w-[200px] xs:max-w-[260px] sm:max-w-md truncate"
              >
                {workspaces.map(ws => <option key={ws} value={ws} className="bg-[#12141a] text-white">{ws}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button onClick={fetchData} title="รีเฟรช Cloud" className="p-1.5 sm:p-2 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] rounded-xl transition">
              <RefreshCw size={14} className={loading ? 'animate-spin text-red-500' : ''} />
            </button>
            <button onClick={handleRenameWorkspace} title="เปลี่ยนชื่อทีม" className="p-1.5 sm:p-2 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] rounded-xl transition">
              <Edit3 size={14} />
            </button>
            <button onClick={handleDeleteWorkspace} title="ลบทีม" className="p-1.5 sm:p-2 bg-[#1c1f28] hover:bg-red-950/50 text-[#8e94a4] hover:text-red-400 border border-[#262933] rounded-xl transition">
              <Trash2 size={14} />
            </button>
            <button onClick={handleAddWorkspace} className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition flex items-center gap-1 shadow-md whitespace-nowrap">
              <Plus size={14} />
              <span className="inline">เพิ่มทีม</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-xl md:max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-5 space-y-3.5 sm:space-y-4">

        {/* 1. ยอดรวมนาที & รายได้สุทธิ */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 shadow-sm">
            <span className="text-xs text-[#8e94a4] flex items-center gap-1.5 font-medium">
              <Clock size={14} /> นาทีในรอบนี้
            </span>
            <p className="text-2xl sm:text-3xl font-black text-white mt-1.5">{currentTotalMins} <span className="text-xs font-normal text-[#8e94a4]">นาที</span></p>
            <p className="text-[11px] sm:text-xs text-red-400 font-semibold mt-0.5">{activeBilledJobs.length} เรื่องที่รอนับยอด</p>
          </div>

          <div className="bg-[#12141a] border border-red-900/40 rounded-2xl p-3.5 sm:p-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-xs text-[#8e94a4] flex items-center gap-1 font-medium truncate">
              <DollarSign size={14} className="text-red-500 shrink-0" /> ยอดสุทธิ (หัก 3%)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-red-500 mt-1.5">
              ฿{currentNet.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] sm:text-[11px] text-[#8e94a4] mt-0.5 truncate">รวม ฿{currentGross.toLocaleString()} | ภาษี ฿{currentTax.toLocaleString()}</p>
          </div>
        </div>

        {/* 2. ช่องเป้าหมายเดือนนี้ */}
        <section className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 transition-all duration-300 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <button 
                onClick={toggleTargetCollapse}
                className="text-xs font-bold text-white flex items-center gap-1.5 hover:text-red-400 transition min-w-0 text-left"
              >
                <Target size={15} className="text-red-500 shrink-0" /> 
                <span className="truncate">เป้าหมายเดือนนี้ <span className="text-[10px] text-[#8e94a4] font-normal hidden xs:inline">(สุทธิ 3%)</span></span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => setShowCalcGuide(!showCalcGuide)}
                className="text-[10px] sm:text-[11px] text-[#8e94a4] hover:text-white flex items-center gap-1 bg-[#181a22] border border-[#262933] px-2 py-1 rounded-lg transition whitespace-nowrap shrink-0"
                title="ดูสูตรคิด"
              >
                <HelpCircle size={12} className="text-red-400 shrink-0" />
                <span>วิธีคิด</span>
              </button>
              
              <button 
                onClick={() => setIsEditingTarget(!isEditingTarget)}
                className="text-[10px] sm:text-[11px] text-red-400 hover:text-red-300 font-medium bg-[#181a22] border border-[#262933] px-2 py-1 rounded-lg transition whitespace-nowrap shrink-0"
              >
                {isEditingTarget ? 'ปิด' : 'ตั้งเป้า'}
              </button>

              <button 
                onClick={toggleTargetCollapse}
                className="p-1 sm:p-1.5 text-[#8e94a4] hover:text-white rounded-lg bg-[#181a22] border border-[#262933] transition shrink-0"
                title={isTargetCollapsed ? 'กางออก' : 'พับเก็บ'}
              >
                {isTargetCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {/* พับเก็บ: Slim Bar */}
          {isTargetCollapsed && (
            <div className="pt-2 border-t border-[#1c1f28] flex justify-between items-center text-xs gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono font-bold text-white text-[11px] sm:text-xs">฿{monthlyTarget.toLocaleString()}</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-900/40 px-1.5 py-0.5 rounded-md">
                  {targetPercent}%
                </span>
              </div>
              <div className="text-right min-w-0">
                <span className="text-[#8e94a4] text-[10px] sm:text-[11px] truncate block">
                  {remainingMinsNeeded > 0 ? `ขาดอีก ${remainingMinsNeeded} น. (฿${remainingMoneyNeeded.toLocaleString()})` : 'บรรลุเป้าหมายแล้ว! 🎉'}
                </span>
              </div>
            </div>
          )}

          {/* กางออก: รายละเอียดเป้าหมาย */}
          {!isTargetCollapsed && (
            <>
              {isEditingTarget ? (
                <div className="flex gap-2 bg-[#0a0b0e] p-2 rounded-xl border border-[#262933]">
                  <input 
                    type="number" 
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="เป้าหมายเงินสุทธิ..."
                    className="bg-transparent text-sm text-white min-w-0 flex-1 px-2 focus:outline-none font-mono"
                  />
                  <button 
                    onClick={saveTargetGoal}
                    className="shrink-0 whitespace-nowrap bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    บันทึก
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-[#8e94a4]">เป้าหมาย:</span>
                      <span className="text-sm sm:text-base font-black text-white ml-1.5">฿{monthlyTarget.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-red-400 font-bold">{targetPercent}%</span>
                      <span className="text-[10px] text-[#8e94a4] ml-1">สำเร็จแล้ว</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#262933]">
                    <div 
                      className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${targetPercent}%` }}
                    />
                  </div>

                  {/* กล่องสรุปนาทีที่เหลือ */}
                  <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3 grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-[#8e94a4] block text-[11px]">นาทีที่ต้องทำเพิ่ม:</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {remainingMinsNeeded > 0 ? `${remainingMinsNeeded} นาที` : 'ครบแล้ว! 🎉'}
                      </span>
                      {remainingMoneyNeeded > 0 && (
                        <span className="text-[10px] text-red-400 block mt-0.5">(ยังขาดอีก ฿{remainingMoneyNeeded.toLocaleString()})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#8e94a4] block text-[11px]">ประมาณจำนวนเรื่อง:</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {remainingMinsNeeded > 0 ? `อีกประมาณ ${remainingMoviesEst} เรื่อง` : 'ครบแล้ว! 🎉'}
                      </span>
                      <span className="text-[10px] text-[#6b7280] block mt-0.5">(เฉลี่ยเรื่องละ {avgMovieLength} นาที)</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* สูตรคำนวณ */}
          {showCalcGuide && (
            <div className="pt-3 border-t border-[#262933] space-y-3 bg-[#0a0b0e] p-3 rounded-xl border border-red-900/40 text-xs">
              <div className="flex justify-between items-center text-red-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Calculator size={14} /> สูตรคำนวณเป้าหมาย (หัก 3%)
                </span>
                <button onClick={() => setShowCalcGuide(false)} className="text-[#8e94a4] hover:text-white">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-[#a6adbb] leading-relaxed">
                <div>
                  <span className="font-bold text-white block">1. อัตราสุทธิต่อนาที:</span>
                  <p className="text-[11px] font-mono text-[#8e94a4] mt-0.5">
                    15 บาท หัก 3% (0.45 บ.) = <span className="text-red-400 font-bold">14.55 บาท/นาที</span>
                  </p>
                </div>
                <div>
                  <span className="font-bold text-white block">2. หานาทีที่ต้องทำ:</span>
                  <div className="bg-[#12141a] p-2 rounded-lg font-mono text-[11px] text-red-300 border border-[#262933] my-1">
                    ยอดเงินที่ยังขาด ÷ 14.55
                  </div>
                </div>
                <div>
                  <span className="font-bold text-white block">3. ตัวอย่างการคิดจริง:</span>
                  <ul className="list-disc list-inside text-[11px] space-y-1 text-[#8e94a4] mt-1">
                    <li>เป้าหมาย: <strong className="text-white">14,700 บาท</strong></li>
                    <li>ทำไปแล้ว: 23% (สุทธิ 3,419.25 บาท)</li>
                    <li>ยอดที่ขาด: 14,700 - 3,419.25 = <strong className="text-red-400">11,280.75 บาท</strong></li>
                    <li>นาทีที่ต้องทำเพิ่ม: 11,280.75 ÷ 14.55 = <strong className="text-white">775.31 นาที</strong> (ปัดเป็น <strong className="text-red-400">776 นาที</strong>)</li>
                    <li>คิดเป็นเรื่องเฉลี่ย 78 นาที: 776 ÷ 78 ≈ <strong className="text-white">10 เรื่อง</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. ช่องโน้ต & ลิงก์เดดไลน์ */}
        <section className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 transition-all duration-300 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button 
              onClick={toggleNotesCollapse}
              className="min-w-0 text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider hover:text-red-300 transition text-left"
            >
              <FileText size={15} className="shrink-0" /> 
              <span className="truncate">บันทึกข้อความ & ลิงก์เดดไลน์</span>
              <span className="text-[10px] bg-[#1c1f28] text-[#8e94a4] px-1.5 py-0.2 rounded border border-[#262933] font-mono shrink-0">
                {filteredNotes.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[#6b7280] hidden sm:inline">
                {isNotesCollapsed ? 'กางออก' : 'พับเก็บ'}
              </span>
              <button 
                onClick={toggleNotesCollapse}
                className="p-1.5 text-[#8e94a4] hover:text-white rounded-lg bg-[#181a22] border border-[#262933] transition"
                title={isNotesCollapsed ? 'กางออก' : 'พับเก็บ'}
              >
                {isNotesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {/* พับเก็บ: Quick links */}
          {isNotesCollapsed && (
            <div className="pt-2 border-t border-[#1c1f28]">
              {filteredNotes.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] text-[#6b7280] shrink-0 font-medium">ลิงก์ด่วน:</span>
                  {filteredNotes.map(n => {
                    const urlMatch = n.content.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                      return (
                        <a
                          key={n.id}
                          href={urlMatch[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-[11px] bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/50 px-2.5 py-1 rounded-xl transition font-medium"
                          title={n.content}
                        >
                          <ExternalLink size={11} /> {n.title}
                        </a>
                      );
                    }
                    return (
                      <span key={n.id} className="shrink-0 text-[11px] bg-[#181a22] text-[#8e94a4] px-2.5 py-1 rounded-xl border border-[#262933]">
                        {n.title}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#555a66]">(ไม่มีบันทึก)</p>
              )}
            </div>
          )}

          {/* กางออก: ฟอร์มโน้ต */}
          {!isNotesCollapsed && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                <input 
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-2.5 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                />
                <input 
                  type="text" 
                  placeholder="หัวข้อบันทึก..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full sm:col-span-2 bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="รายละเอียด หรือวางลิงก์ เช่น https://docs.google.com/..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="min-w-0 flex-1 bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                />
                <button onClick={handleAddNote} className="shrink-0 whitespace-nowrap bg-red-600 hover:bg-red-500 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition shadow-md">
                  เพิ่มโน้ต
                </button>
              </div>

              {filteredNotes.length > 0 && (
                <div className="space-y-2 pt-1 max-h-40 overflow-y-auto pr-1">
                  {filteredNotes.map(n => (
                    <div key={n.id} className="bg-[#181a22] border border-[#262933] p-2.5 rounded-xl flex justify-between items-start text-xs gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-red-300">{n.title}</span>
                          <span className="text-[10px] text-[#6b7280] font-mono">{n.date}</span>
                        </div>
                        <div className="text-[#a6adbb] text-[12px] leading-relaxed break-words">
                          {renderTextWithLinks(n.content)}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteNote(n.id, n.title)} className="shrink-0 text-[#555a66] hover:text-red-400 p-1" title="ลบบันทึก">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ======================= TAB 1: คิวงาน (Queue View) ======================= */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* กล่องบันทึกงานใหม่ */}
            <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-5 space-y-3.5">
              <h2 className="text-xs font-bold text-red-400 tracking-wider uppercase">บันทึกงานใหม่ (Cloud Storage)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#8e94a4] block mb-1">1. ข้อความด่วน (ชื่อ_ตอน_นาที)</label>
                  <input 
                    type="text" 
                    placeholder="เช่น GS273_55_76 หรือ DW_12_90"
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#454954] focus:border-red-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8e94a4] block mb-1">2. ลิงก์ Google Drive (ถ้ามี)</label>
                  <input 
                    type="text" 
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#454954] focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8e94a4] block mb-1">3. หรือวางแถวจาก Sheet (ก๊อปปี้ทั้งแถว)</label>
                <textarea 
                  rows={2}
                  placeholder="ตัวอย่าง: GS273  29-10-26  30-10-26  31-10-26  1-11-26  2-11-26"
                  value={sheetPaste}
                  onChange={(e) => setSheetPaste(e.target.value)}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none font-mono"
                />
              </div>

              <button 
                onClick={handleAddJob}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-red-950/50"
              >
                บันทึกงานลงระบบ
              </button>
            </div>

            {/* รายการคิวงาน */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-[#8e94a4] uppercase">คิวงานปัจจุบัน ({pendingJobs.length})</span>
                <span className="text-[11px] text-red-400 font-semibold">งานพร้อมคิดเงิน</span>
              </div>

              {pendingJobs.length === 0 ? (
                <div className="text-center py-12 text-[#555a66] text-xs bg-[#12141a]/50 rounded-2xl border border-dashed border-[#262933]">
                  {loading ? 'กำลังโหลดข้อมูลจาก Supabase...' : 'ไม่มีงานค้างในคิว'}
                </div>
              ) : (
                pendingJobs.map((job) => {
                  const isDW = job.title.toUpperCase().startsWith('DW');
                  const isCopied = copiedJobId === job.id;
                  return (
                    <div 
                      key={job.id} 
                      className={`rounded-2xl p-3.5 sm:p-4 transition border shadow-sm ${
                        isDW 
                          ? 'bg-gradient-to-b from-[#1b1510] to-[#14110e] border-amber-500/35 hover:border-amber-500/60' 
                          : 'bg-gradient-to-b from-[#0e1620] to-[#0c1219] border-cyan-500/35 hover:border-cyan-500/60'
                      } ${!job.isIncludedInBilling && 'opacity-60'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 tracking-wider ${
                              isDW 
                                ? 'bg-amber-400/15 text-amber-300 border-amber-400/40' 
                                : 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40'
                            }`}>
                              {isDW ? 'DW' : 'GS'}
                            </span>

                            <span className="font-extrabold text-white text-base sm:text-lg tracking-wide truncate">
                              {job.title}
                            </span>

                            {job.episode && (
                              <span className="text-[11px] bg-[#1c1f28] text-[#a0a6b5] px-2 py-0.5 rounded-md border border-[#262933] font-medium">
                                ตอน {job.episode}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs font-bold text-red-400">
                              {job.minutes} นาที <span className="text-[#8e94a4] font-normal">(฿{(job.minutes * 15).toLocaleString()})</span>
                            </span>

                            {job.drive_url && (
                              <a 
                                href={job.drive_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] bg-[#1c1f28] hover:bg-[#262a36] text-red-300 border border-[#262933] px-2.5 py-0.5 rounded-lg transition font-medium"
                              >
                                <FolderOpen size={12} className="text-amber-400" /> Google Drive
                              </a>
                            )}
                          </div>
                        </div>

                        {/* เมนูด้านขวา (ปุ่ม Copy กดแล้วก๊อปทันที ไม่มี Alert) */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          <button 
                            onClick={() => handleCopyJob(job)} 
                            className={`p-1.5 rounded-lg border transition ${
                              isCopied 
                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400' 
                                : 'bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border-[#262933]'
                            }`}
                            title="คัดลอก (ชื่อ_ตอน_นาที)"
                          >
                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <button onClick={() => setEditingJob(job)} className="p-1.5 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white rounded-lg border border-[#262933] transition" title="แก้ไขงาน">
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => toggleJobBilling(job)}
                            className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border font-semibold whitespace-nowrap transition ${
                              job.isIncludedInBilling 
                                ? 'border-red-500/50 text-red-400 bg-red-950/40 hover:bg-red-950/60' 
                                : 'border-[#262933] text-[#555a66] bg-[#181a22] hover:bg-[#262a36]'
                            }`}
                          >
                            {job.isIncludedInBilling ? 'คิดเงินรอบนี้' : 'ยังไม่คิดเงิน'}
                          </button>
                          <button onClick={() => handleDeleteJob(job.id, job.title)} className="p-1.5 text-[#555a66] hover:text-red-400 transition" title="ลบงาน">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Mini-table 5 วันที่ขั้นตอนทำงาน */}
                      <div className="mt-3 pt-2.5 border-t border-[#262933]">
                        <div className="grid grid-cols-5 text-center text-[10px] uppercase font-bold text-[#6b7280] pb-1">
                          <div>เกลา</div>
                          <div>พากย์</div>
                          <div className="text-red-400 font-extrabold">มิกซ์</div>
                          <div>ซับ</div>
                          <div className="text-amber-400 font-extrabold">เดดไลน์</div>
                        </div>
                        <div className="grid grid-cols-5 text-center text-xs font-mono bg-[#0a0b0e]/90 rounded-xl py-1.5 border border-[#262933]">
                          <div className="text-[#8e94a4]">{formatToDisplayDate(job.date_glao)}</div>
                          <div className="text-[#8e94a4]">{formatToDisplayDate(job.date_pak)}</div>
                          <div className="text-red-200 font-bold bg-red-950/70 border border-red-500/60 rounded-lg mx-0.5 py-0.5">
                            {formatToDisplayDate(job.date_mix)}
                          </div>
                          <div className="text-[#8e94a4]">{formatToDisplayDate(job.date_sub || '')}</div>
                          <div className="text-amber-300 font-bold">{formatToDisplayDate(job.date_deadline)}</div>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB 2: ปฏิทิน (Calendar View) ======================= */}
        {activeTab === 'calendar' && (
          <div className="bg-[#12141a] border border-[#262933] rounded-3xl p-4 md:p-5 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">{monthNames[month]} {year}</h3>
                  <button 
                    onClick={handleGoToCurrentMonth}
                    className="text-[10px] bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] px-2 py-0.5 rounded-md font-bold transition"
                  >
                    กลับมาเดือนนี้
                  </button>
                </div>
                {todayDisplay && (
                  <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>วันนี้: <strong className="text-white font-bold">{todayDisplay}</strong></span>
                  </p>
                )}
              </div>

              <div className="flex gap-1.5 self-end sm:self-auto">
                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 bg-[#1c1f28] hover:bg-[#262a36] text-white rounded-xl">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 bg-[#1c1f28] hover:bg-[#262a36] text-white rounded-xl">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-bold text-[#8e94a4]">
              <span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span>
            </div>

            <div className="grid grid-cols-7 gap-y-2.5 text-center text-xs">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                
                const jobsInPipeline = filteredJobs.filter(j => {
                  const start = j.date_glao || j.date_mix;
                  const end = j.date_deadline || j.date_mix;
                  if (!start || !end) return false;
                  return dStr >= start && dStr <= end;
                });

                const mixJobsToday = filteredJobs.filter(j => j.date_mix === dStr);
                const deadlineJobsToday = filteredJobs.filter(j => j.date_deadline === dStr);

                const isInRange = jobsInPipeline.length > 0;
                const isMixDay = mixJobsToday.length > 0;
                const isDeadlineDay = deadlineJobsToday.length > 0;
                const isSelected = selectedCalDate === dStr;
                const isToday = todayStr ? dStr === todayStr : false;

                return (
                  <div key={dayNum} onClick={() => setSelectedCalDate(dStr)} className="h-12 flex flex-col items-center justify-center relative cursor-pointer">
                    {isInRange && (
                      <div className="absolute inset-x-0 h-7 bg-red-950/40 border-y border-red-900/30 -z-0" />
                    )}

                    <div className="relative flex items-center justify-center">
                      {isToday && (
                        <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] pointer-events-none" />
                      )}
                      <div className={`z-10 w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition ${
                        isMixDay ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/60 ring-2 ring-red-400 scale-105' : 
                        isDeadlineDay ? 'border-2 border-amber-400 text-amber-300 font-bold bg-[#181a22]' : 
                        isSelected ? 'border-2 border-white text-white' : 
                        isInRange ? 'text-red-200 font-bold' : 'text-[#8e94a4] hover:text-white'
                      }`}>
                        {dayNum}
                      </div>
                    </div>

                    {mixJobsToday.length > 0 ? (
                      <span className="text-[9px] text-red-400 font-black leading-none mt-0.5 truncate max-w-[48px]">
                        {mixJobsToday[0].title}
                      </span>
                    ) : isToday ? (
                      <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1" />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {selectedCalDate && (
              <div className="pt-4 border-t border-[#262933] text-xs">
                <span className="text-[#8e94a4] font-medium">งานวันที่ {formatToDisplayDate(selectedCalDate)}:</span>
                <div className="mt-2 space-y-2">
                  {filteredJobs.filter(j => {
                    const start = j.date_glao || j.date_mix;
                    const end = j.date_deadline || j.date_mix;
                    return dStrActive(selectedCalDate, start, end);
                  }).map(j => (
                    <div key={j.id} className="bg-[#181a22] p-3 rounded-xl flex justify-between items-center border border-[#262933]">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">{j.title}</span>
                          {j.episode && <span className="text-[10px] text-[#8e94a4]">ตอน {j.episode}</span>}
                          {j.drive_url && (
                            <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 ml-1">
                              <FolderOpen size={12} />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          {j.date_mix === selectedCalDate && <span className="text-red-400 font-bold">วันมิกซ์ </span>}
                          {j.date_deadline === selectedCalDate && <span className="text-amber-400 font-bold">เดดไลน์ส่ง </span>}
                          {j.date_glao === selectedCalDate && <span className="text-[#8e94a4]">วันเกลา </span>}
                          {j.date_pak === selectedCalDate && <span className="text-[#8e94a4]">วันพากย์ </span>}
                          {j.date_sub === selectedCalDate && <span className="text-[#8e94a4]">วันซับ </span>}
                        </div>
                      </div>
                      <span className="font-mono text-white font-bold">{j.minutes} นาที</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 3: ตาราง & กราฟ ======================= */}
        {activeTab === 'table' && (
          <div className="space-y-4">
            <div className="flex bg-[#12141a] p-1.5 rounded-2xl border border-[#262933]">
              <button 
                onClick={() => setTableSubView('table')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'table' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <TableIcon size={14} /> ตารางงาน ({filteredJobs.length})
              </button>
              <button 
                onClick={() => setTableSubView('analytics')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'analytics' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <BarChart3 size={14} /> วิเคราะห์สถิติ
              </button>
            </div>

            {tableSubView === 'table' && (
              <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3.5">
                
                {/* ส่วนหัวตาราง + ปุ่มคัดลอกสรุปทั้งหมด */}
                <div className="flex justify-between items-center gap-2">
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                    รายการงานทั้งหมด ({filteredJobs.length} เรื่อง)
                  </h3>
                  <button 
                    onClick={handleCopyAllJobs}
                    className="text-xs bg-[#1c1f28] hover:bg-[#262a36] text-white font-bold px-3 py-1.5 rounded-xl border border-[#262933] transition flex items-center gap-1.5 shadow-sm"
                    title="คัดลอก ชื่อ_ตอน_นาที พร้อมผลรวมนาทีทั้งหมด"
                  >
                    <Copy size={13} className="text-red-400" />
                    <span>คัดลอกสรุปทั้งหมด</span>
                  </button>
                </div>

                {/* ตารางงานปรับสัดส่วนใหม่ ขยับช่องว่างชื่อเรื่องกับตอนให้กระชับเข้าหากัน */}
                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[#262933] text-red-400 font-bold bg-[#181a22]">
                        <th className="py-2.5 px-2 text-center w-12">รหัส</th>
                        <th className="py-2.5 pl-2 pr-1 text-left w-36">ชื่อเรื่อง</th>
                        <th className="py-2.5 pl-1 pr-2 text-center w-14">ตอน</th>
                        <th className="py-2.5 px-2 text-center w-16">นาที</th>
                        <th className="py-2.5 px-2 text-center w-12">Drive</th>
                        <th className="py-2.5 px-2 text-center w-20">เกลา</th>
                        <th className="py-2.5 px-2 text-center w-20">พากย์</th>
                        <th className="py-2.5 px-2 text-center w-24 text-white bg-red-950/70 border-x border-red-500/30 font-black">มิกซ์</th>
                        <th className="py-2.5 px-2 text-center w-20">ซับ</th>
                        <th className="py-2.5 px-2 text-center w-24 text-amber-400 font-bold">เดดไลน์</th>
                        <th className="py-2.5 px-3 text-center w-24">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1f28]/60">
                      {filteredJobs.map((j, idx) => {
                        const isDW = j.title.toUpperCase().startsWith('DW');
                        const isCopied = copiedJobId === j.id;
                        const rowBg = isDW 
                          ? (idx % 2 === 0 ? 'bg-amber-950/15 hover:bg-amber-900/25' : 'bg-amber-950/25 hover:bg-amber-900/35')
                          : (idx % 2 === 0 ? 'bg-cyan-950/10 hover:bg-cyan-900/20' : 'bg-cyan-950/20 hover:bg-cyan-900/30');

                        return (
                          <tr key={j.id} className={`${rowBg} transition`}>
                            {/* 1. รหัส */}
                            <td className="py-2.5 px-2 text-center">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                isDW 
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              }`}>
                                {isDW ? 'DW' : 'GS'}
                              </span>
                            </td>

                            {/* 2. ชื่อเรื่อง (ขยับชิดตอนมากขึ้น) */}
                            <td className="py-2.5 pl-2 pr-1 font-bold text-white whitespace-nowrap w-36">
                              {j.title}
                            </td>

                            {/* 3. ตอน (อยู่ชิดชื่อเรื่อง ไม่เว้นช่องว่างเกินไป) */}
                            <td className="py-2.5 pl-1 pr-2 text-center whitespace-nowrap w-14">
                              {j.episode ? (
                                <span className="text-[11px] bg-[#1c1f28] text-[#a0a6b5] px-2 py-0.5 rounded-md font-mono border border-[#262933]">
                                  {j.episode}
                                </span>
                              ) : '-'}
                            </td>

                            {/* 4. นาที */}
                            <td className="py-2.5 px-2 text-center text-red-400 font-mono font-bold whitespace-nowrap">
                              {j.minutes}
                            </td>

                            {/* 5. Drive */}
                            <td className="py-2.5 px-2 text-center">
                              {j.drive_url ? (
                                <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-white inline-flex items-center justify-center p-1">
                                  <FolderOpen size={13} />
                                </a>
                              ) : '-'}
                            </td>

                            {/* 6. เกลา */}
                            <td className="py-2.5 px-2 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_glao)}
                            </td>

                            {/* 7. พากย์ */}
                            <td className="py-2.5 px-2 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_pak)}
                            </td>

                            {/* 8. มิกซ์ */}
                            <td className="py-2.5 px-2 text-center font-bold text-white bg-red-950/50 border-x border-red-500/20 font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_mix)}
                            </td>

                            {/* 9. ซับ */}
                            <td className="py-2.5 px-2 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_sub || '')}
                            </td>

                            {/* 10. เดดไลน์ */}
                            <td className="py-2.5 px-2 text-center text-amber-300 font-mono font-bold whitespace-nowrap">
                              {formatToDisplayDate(j.date_deadline)}
                            </td>

                            {/* 11. จัดการ */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => handleCopyJob(j)} 
                                  className={`p-1 rounded transition ${
                                    isCopied ? 'text-emerald-400' : 'text-[#8e94a4] hover:text-white'
                                  }`} 
                                  title="คัดลอก (ชื่อ_ตอน_นาที)"
                                >
                                  {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                                <button onClick={() => setEditingJob(j)} className="text-[#8e94a4] hover:text-white p-1" title="แก้ไขงาน">
                                  <Edit3 size={13} />
                                </button>
                                <button onClick={() => handleDeleteJob(j.id, j.title)} className="text-[#555a66] hover:text-red-400 p-1" title="ลบงาน">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredJobs.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-6 text-center text-[#555a66]">ไม่มีข้อมูล</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tableSubView === 'analytics' && (
              <div className="space-y-4">
                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={15} /> สรุปประเภทงานที่ทำมากที่สุด
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3">
                      <span className="text-[11px] text-[#8e94a4]">ประเภทหลัก:</span>
                      <p className="text-base font-black text-white mt-1">{analyticsData.mostWorkedType}</p>
                    </div>
                    <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3">
                      <span className="text-[11px] text-[#8e94a4]">ช่วงวันที่มิกซ์หนักสุด:</span>
                      <p className="text-xs font-black text-red-400 mt-1 leading-tight">{analyticsData.mostActivePeriodName}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-bold text-white">สัดส่วนนาทีงาน (GS vs DW)</span>
                  {analyticsData.totalAllMins > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-cyan-400 font-bold">GS: {analyticsData.gsMins} นาที ({analyticsData.gsCount} เรื่อง)</span>
                        <span className="text-amber-400 font-bold">DW: {analyticsData.dwMins} นาที ({analyticsData.dwCount} เรื่อง)</span>
                      </div>
                      <div className="w-full bg-[#1c1f28] h-3.5 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-cyan-500 transition-all duration-500" 
                          style={{ width: `${(analyticsData.gsMins / analyticsData.totalAllMins) * 100}%` }} 
                        />
                        <div 
                          className="bg-amber-500 transition-all duration-500" 
                          style={{ width: `${(analyticsData.dwMins / analyticsData.totalAllMins) * 100}%` }} 
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ไม่มีข้อมูล</p>
                  )}
                </div>

                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-bold text-white">กระจายงานรายปักษ์</span>
                  {analyticsData.maxPeriodMins > 0 ? (
                    <div className="space-y-2.5 pt-1 text-xs">
                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-1">
                          <span>ต้นเดือน (1-10):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodEarly} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${(analyticsData.periodEarly / analyticsData.maxPeriodMins) * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-1">
                          <span>กลางเดือน (11-20):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodMid} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${(analyticsData.periodMid / analyticsData.maxPeriodMins) * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-1">
                          <span>ปลายเดือน (21-31):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodLate} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-600 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${(analyticsData.periodLate / analyticsData.maxPeriodMins) * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ไม่มีข้อมูล</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: ปิดยอด (Billing View) ======================= */}
        {activeTab === 'billing' && (
          <div className="space-y-5">
            <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[#262933] pb-3">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Lock size={17} className="text-red-500" /> ปิดรอบคำนวณเงิน
                </h3>
                <span className="text-xs bg-red-950/50 text-red-400 px-2.5 py-1 rounded-lg border border-red-900/40">
                  รวม {activeBilledJobs.length} เรื่อง
                </span>
              </div>

              <div>
                <label className="text-xs text-[#8e94a4] block mb-1.5 font-medium">
                  วันที่ตัดยอดรอบนี้ (เช่น 31):
                </label>
                <input 
                  type="date"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  className="bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="bg-[#181a22] border border-[#262933] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-[#8e94a4]">
                  <span>รวมนาทีทั้งหมด:</span>
                  <span className="font-mono text-white font-bold">{currentTotalMins} นาที</span>
                </div>
                <div className="flex justify-between text-[#8e94a4]">
                  <span>ยอดเต็ม (15 บ./นาที):</span>
                  <span className="font-mono text-white">฿{currentGross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>หัก ณ ที่จ่าย 3%:</span>
                  <span className="font-mono">-฿{currentTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-2 border-t border-[#262933]">
                  <span className="text-white">รับสุทธิ:</span>
                  <span className="text-red-500">฿{currentNet.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handleCloseBillingCycle}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> ยืนยันปิดรอบและบันทึกประวัติ
              </button>
            </div>

            {/* ประวัติรอบคิดเงิน */}
            <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={15} /> ประวัติการปิดรอบ ({filteredCycles.length} รอบ)
              </h3>
              <div className="space-y-3">
                {filteredCycles.map(cycle => (
                  <div key={cycle.id} className="bg-[#181a22] border border-[#262933] rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-sm">{cycle.title}</h4>
                        <div className="text-[11px] text-[#8e94a4] mt-0.5">
                          ปิดเมื่อ {new Date(cycle.createdAt).toLocaleDateString('th-TH')} • รวม {cycle.jobCount} เรื่อง
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleRollbackCycle(cycle)}
                        className="text-[11px] text-[#8e94a4] hover:text-red-400 flex items-center gap-1 bg-[#12141a] border border-[#262933] px-2 py-1 rounded-lg transition"
                        title="ยกเลิกรอบนี้"
                      >
                        <RotateCcw size={12} /> ย้อนกลับ
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#262933] text-center text-xs">
                      <div>
                        <div className="text-[10px] text-[#8e94a4]">นาทีรวม</div>
                        <div className="font-mono text-white font-bold">{cycle.totalMinutes}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#8e94a4]">ภาษี 3%</div>
                        <div className="font-mono text-red-400">-฿{cycle.taxAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#8e94a4]">รับสุทธิ</div>
                        <div className="font-mono text-red-500 font-extrabold">฿{cycle.netIncome.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCycles.length === 0 && (
                  <p className="text-xs text-[#555a66] text-center py-6">ยังไม่มีประวัติการปิดรอบในระบบ</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262933] pb-2">
              <h4 className="text-sm font-bold text-white">แก้ไขงาน {editingJob.title}</h4>
              <button onClick={() => setEditingJob(null)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[#8e94a4] block mb-1">ชื่อเรื่อง</label>
                <input 
                  type="text" 
                  value={editingJob.title}
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-[#8e94a4] block mb-1">ลิงก์ Google Drive</label>
                <input 
                  type="text" 
                  value={editingJob.drive_url || ''}
                  onChange={(e) => setEditingJob({ ...editingJob, drive_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#8e94a4] block mb-1">ตอน</label>
                  <input 
                    type="text" 
                    value={editingJob.episode}
                    onChange={(e) => setEditingJob({ ...editingJob, episode: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-[#8e94a4] block mb-1">นาที</label>
                  <input 
                    type="number" 
                    value={editingJob.minutes}
                    onChange={(e) => setEditingJob({ ...editingJob, minutes: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#8e94a4] block mb-1">วันมิกซ์</label>
                  <input 
                    type="date" 
                    value={editingJob.date_mix}
                    onChange={(e) => setEditingJob({ ...editingJob, date_mix: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-red-500/50 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-[#8e94a4] block mb-1">วันเดดไลน์</label>
                  <input 
                    type="date" 
                    value={editingJob.date_deadline}
                    onChange={(e) => setEditingJob({ ...editingJob, date_deadline: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingJob(null)} className="flex-1 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] font-bold py-2 rounded-xl text-xs transition">
                ยกเลิก
              </button>
              <button onClick={handleSaveEditJob} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs transition">
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Custom Modal */}
      {dialogState && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-start gap-2 border-b border-[#262933] pb-2.5">
              <h4 className="text-sm font-bold text-white leading-snug">{dialogState.title}</h4>
              <button onClick={() => setDialogState(null)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>

            {dialogState.desc && (
              <div className="text-xs text-[#a0a6b5] leading-relaxed whitespace-pre-line bg-[#0a0b0e]/70 p-3 rounded-xl border border-[#262933] font-mono">
                {dialogState.desc}
              </div>
            )}

            {dialogState.type === 'prompt' && (
              <div>
                <input
                  type="text"
                  value={promptInputValue}
                  onChange={(e) => setPromptInputValue(e.target.value)}
                  placeholder={dialogState.inputPlaceholder || 'กรอกข้อมูล...'}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-red-500 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      dialogState.onSubmit?.(promptInputValue);
                      setDialogState(null);
                    }
                  }}
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {dialogState.type !== 'alert' && (
                <button
                  onClick={() => setDialogState(null)}
                  className="flex-1 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {dialogState.cancelText || 'ยกเลิก'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialogState.type === 'prompt') {
                    dialogState.onSubmit?.(promptInputValue);
                  } else if (dialogState.type === 'confirm') {
                    dialogState.onConfirm?.();
                  }
                  setDialogState(null);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md"
              >
                {dialogState.confirmText || (dialogState.type === 'alert' ? 'ตกลง' : 'ยืนยัน')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Bottom Nav Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#12141a]/95 border-t border-[#262933] px-4 py-3 z-40 backdrop-blur">
        <div className="grid grid-cols-4 max-w-xl md:max-w-2xl mx-auto">
          <button 
            onClick={() => setActiveTab('queue')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 text-xs font-bold transition ${
              activeTab === 'queue' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <ListFilter size={20} />
            <span>คิวงาน</span>
          </button>
          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 text-xs font-bold transition ${
              activeTab === 'calendar' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <CalIcon size={20} />
            <span>ปฏิทิน</span>
          </button>
          <button 
            onClick={() => setActiveTab('table')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 text-xs font-bold transition ${
              activeTab === 'table' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <TableIcon size={20} />
            <span>ตาราง & กราฟ</span>
          </button>
          <button 
            onClick={() => setActiveTab('billing')} 
            className={`flex flex-col items-center justify-center gap-1 py-1 text-xs font-bold transition ${
              activeTab === 'billing' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <DollarSign size={20} />
            <span>ปิดยอด</span>
          </button>
        </div>
      </nav>

    </main>
  );
}

function dStrActive(target: string, start: string, end: string): boolean {
  if (!start && !end) return false;
  const s = start || end;
  const e = end || start;
  return target >= s && target <= e;
}