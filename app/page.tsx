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
  Calculator
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
  
  // สถานะการย่อ/ขยายกล่อง
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(true);
  const [isTargetCollapsed, setIsTargetCollapsed] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false); // ค่าเริ่มต้นพับฟอร์มไว้เพื่อให้เห็นการ์ดงานทันที
  const [showCalcGuide, setShowCalcGuide] = useState(false);

  // เป้าหมายรายได้ของเดือนนี้ (Net Target)
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

  // Cutoff Billing Date State
  const [cutoffDate, setCutoffDate] = useState<string>('2026-10-31');

  // Custom Modal
  const [modalMessage, setModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // โหลดค่าเป้าหมายและสถานะย่อขยายจาก localStorage
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
    if (savedNotesCol !== null) setIsNotesCollapsed(savedNotesCol === 'true');
    const savedTargetCol = localStorage.getItem('mix_target_collapsed');
    if (savedTargetCol !== null) setIsTargetCollapsed(savedTargetCol === 'true');
  }, []);

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

  // ดึงข้อมูลทั้งหมดจาก Supabase
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
            {part} <ExternalLink size={11} className="inline shrink-0" />
          </a>
        );
      }
      return part;
    });
  };

  const handleAddWorkspace = async () => {
    const name = prompt('ใส่ชื่อทีมใหม่:');
    if (name && name.trim() && !workspaces.includes(name.trim())) {
      const trimmed = name.trim();
      await supabase.from('workspaces').insert([{ name: trimmed }]);
      setWorkspaces([...workspaces, trimmed]);
      setSelectedWs(trimmed);
    }
  };

  const handleRenameWorkspace = async () => {
    const newName = prompt(`เปลี่ยนชื่อทีม "${selectedWs}" เป็น:`, selectedWs);
    if (newName && newName.trim() && newName.trim() !== selectedWs) {
      const trimmed = newName.trim();
      await supabase.from('workspaces').update({ name: trimmed }).eq('name', selectedWs);
      await supabase.from('jobs').update({ workspace: trimmed }).eq('workspace', selectedWs);
      await supabase.from('notes').update({ workspace: trimmed }).eq('workspace', selectedWs);
      await supabase.from('billing_cycles').update({ workspace: trimmed }).eq('workspace', selectedWs);
      setWorkspaces(workspaces.map(w => w === selectedWs ? trimmed : w));
      setSelectedWs(trimmed);
      fetchData();
    }
  };

  const handleDeleteWorkspace = async () => {
    if (workspaces.length <= 1) {
      setModalMessage({ title: 'ไม่สามารถลบได้', desc: 'ต้องมีอย่างน้อย 1 ทีมในระบบ' });
      return;
    }
    if (confirm(`ต้องการลบทีม "${selectedWs}" และข้อมูลทั้งหมดในทีมนี้หรือไม่?`)) {
      await supabase.from('workspaces').delete().eq('name', selectedWs);
      await supabase.from('jobs').delete().eq('workspace', selectedWs);
      await supabase.from('notes').delete().eq('workspace', selectedWs);
      await supabase.from('billing_cycles').delete().eq('workspace', selectedWs);
      const remaining = workspaces.filter(w => w !== selectedWs);
      setWorkspaces(remaining);
      setSelectedWs(remaining[0]);
      fetchData();
    }
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

    if (isDateString(finalTitle)) finalTitle = 'งานใหม่';

    if (!finalTitle) {
      setModalMessage({ title: 'ข้อมูลไม่ครบถ้วน', desc: 'กรุณากรอกรหัสเรื่อง หรือวางข้อมูลตาราง' });
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
      setIsAddJobOpen(false); // บันทึกเสร็จแล้วพับฟอร์มเก็บทันที
      fetchData();
      setModalMessage({ title: 'บันทึกสำเร็จ', desc: `บันทึก ${finalTitle} ขึ้น Supabase เรียบร้อยแล้ว` });
    } else {
      setModalMessage({ title: 'เกิดข้อผิดพลาด', desc: error.message });
    }
  };

  const handleSaveEditJob = async () => {
    if (!editingJob) return;
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
    }
  };

  const toggleJobBilling = async (job: JobItem) => {
    const nextVal = !job.isIncludedInBilling;
    setJobs(jobs.map(j => j.id === job.id ? { ...j, isIncludedInBilling: nextVal } : j));
    await supabase.from('jobs').update({ is_included_in_billing: nextVal }).eq('id', job.id);
  };

  const handleDeleteJob = async (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
    await supabase.from('jobs').delete().eq('id', id);
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

  const handleDeleteNote = async (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    await supabase.from('notes').delete().eq('id', id);
  };

  // ข้อมูลที่กรองตามทีม
  const filteredJobs = useMemo(() => jobs.filter(j => j.workspace === selectedWs), [jobs, selectedWs]);
  const filteredNotes = useMemo(() => notes.filter(n => n.workspace === selectedWs), [notes, selectedWs]);
  const filteredCycles = useMemo(() => billingCycles.filter(b => b.workspace === selectedWs), [billingCycles, selectedWs]);

  const pendingJobs = useMemo(() => filteredJobs.filter(j => j.status === 'pending'), [filteredJobs]);
  const activeBilledJobs = useMemo(() => pendingJobs.filter(j => j.isIncludedInBilling), [pendingJobs]);

  const currentTotalMins = useMemo(() => activeBilledJobs.reduce((acc, cur) => acc + (Number(cur.minutes) || 0), 0), [activeBilledJobs]);
  const currentGross = currentTotalMins * 15;
  const currentTax = currentGross * 0.03;
  const currentNet = currentGross - currentTax;

  // คำนวณเป้าหมายรายได้
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

  // คำนวณกราฟและสถิติ
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
    const mostWorkedType = gsMins >= dwMins ? 'GS (มีทำซับ)' : 'DW (ไม่มีซับ)';

    const maxPeriodMins = Math.max(periodEarly, periodMid, periodLate);
    let mostActivePeriodName = 'ยังไม่มีข้อมูล';
    if (maxPeriodMins > 0) {
      if (maxPeriodMins === periodEarly) mostActivePeriodName = 'ช่วงต้นเดือน (วันที่ 1–10)';
      else if (maxPeriodMins === periodMid) mostActivePeriodName = 'ช่วงกลางเดือน (วันที่ 11–20)';
      else mostActivePeriodName = 'ช่วงปลายเดือน (วันที่ 21–31)';
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

  const handleCloseBillingCycle = async () => {
    if (activeBilledJobs.length === 0) {
      setModalMessage({ title: 'ไม่มีงานที่เลือก', desc: 'ไม่มีงานที่ติ๊ก "คิดเงินรอบนี้" เพื่อตัดรอบบิล' });
      return;
    }

    const cycleId = Date.now().toString();
    const cycleTitle = `รอบบิลวันที่ ${formatToDisplayDate(cutoffDate)}`;

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
      job_ids: activeBilledJobs.map(j => j.id)
    };

    await supabase.from('billing_cycles').insert([newCycle]);
    
    const targetIds = activeBilledJobs.map(j => j.id);
    await supabase.from('jobs').update({
      status: 'billed',
      billing_cycle_id: cycleId
    }).in('id', targetIds);

    fetchData();
    setModalMessage({
      title: 'ปิดรอบบิลสำเร็จ!',
      desc: `บันทึก ${cycleTitle} ขึ้น Supabase เรียบร้อย รวม ${currentTotalMins} นาที ได้รับสุทธิ ฿${currentNet.toLocaleString()}`
    });
  };

  const handleRollbackCycle = async (cycle: BillingCycle) => {
    if (confirm(`ต้องการยกเลิกการปิด "${cycle.title}" เพื่อนำงานทั้ง ${cycle.jobCount} เรื่องกลับมาคำนวณใหม่หรือไม่?`)) {
      await supabase.from('jobs').update({
        status: 'pending',
        billing_cycle_id: null
      }).in('id', cycle.jobIds);

      await supabase.from('billing_cycles').delete().eq('id', cycle.id);
      fetchData();
      setModalMessage({ title: 'ยกเลิกสำเร็จ', desc: 'ดึงรายการงานกลับเข้าสู่รอบปัจจุบันเรียบร้อยแล้ว' });
    }
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-[#f0f2f5] pb-24 font-sans select-none">
      
      {/* 1. Bar ด้านบน: ปรับขนาดให้แบน กระชับ ไม่ล้น[cite: 36, 37] */}
      <header className="sticky top-0 z-30 bg-[#12141a]/95 backdrop-blur border-b border-[#22252e] px-3.5 py-2">
        <div className="flex justify-between items-center max-w-xl md:max-w-2xl mx-auto">
          {/* ชื่อทีมและป้ายสถานะ[cite: 36, 37] */}
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <select 
              value={selectedWs} 
              onChange={(e) => setSelectedWs(e.target.value)}
              className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer truncate max-w-[160px] sm:max-w-[240px]"
            >
              {workspaces.map(ws => <option key={ws} value={ws} className="bg-[#12141a] text-white">{ws}</option>)}
            </select>
          </div>

          {/* ปุ่มเครื่องมือขนาดกะทัดรัด สบายตา[cite: 36, 37] */}
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={fetchData} 
              title="รีเฟรชข้อมูล" 
              className="p-1.5 bg-[#181a22] hover:bg-[#20232d] text-[#8e94a4] hover:text-white border border-[#262933] rounded-lg transition"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-red-500' : ''} />
            </button>
            <button 
              onClick={handleRenameWorkspace} 
              title="แก้ไขชื่อทีม" 
              className="p-1.5 bg-[#181a22] hover:bg-[#20232d] text-[#8e94a4] hover:text-white border border-[#262933] rounded-lg transition"
            >
              <Edit3 size={12} />
            </button>
            <button 
              onClick={handleDeleteWorkspace} 
              title="ลบทีม" 
              className="p-1.5 bg-[#181a22] hover:bg-red-950/40 text-[#8e94a4] hover:text-red-400 border border-[#262933] rounded-lg transition"
            >
              <Trash2 size={12} />
            </button>
            <button 
              onClick={handleAddWorkspace} 
              className="text-[11px] bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-1.5 rounded-lg transition flex items-center gap-0.5 shadow-sm ml-0.5"
            >
              <Plus size={12} /> <span>เพิ่มทีม</span>[cite: 36, 37]
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-xl md:max-w-2xl mx-auto px-3.5 pt-2.5 space-y-2">

        {/* 2. กล่องโน้ต & ลิงก์เดดไลน์: ปรับให้บางลง ไม่กินพื้นที่[cite: 36, 38] */}
        <section className="bg-[#12141a] border border-[#22252e] rounded-xl p-2.5 transition-all space-y-1.5">
          <div className="flex items-center justify-between">
            <button 
              onClick={toggleNotesCollapse}
              className="text-[11px] font-bold text-red-400 flex items-center gap-1.5 hover:text-red-300 transition"
            >
              <FileText size={13} /> บันทึกข้อความ & ลิงก์
              <span className="text-[9px] bg-[#1a1d26] text-[#8e94a4] px-1 py-0.2 rounded font-mono">
                {filteredNotes.length}
              </span>
            </button>

            <button 
              onClick={toggleNotesCollapse}
              className="p-1 text-[#8e94a4] hover:text-white rounded-md transition"
              title={isNotesCollapsed ? 'ขยายกล่องโน้ต' : 'ย่อกล่องโน้ต'}
            >
              {isNotesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* เมื่อย่อ: แถบชิปลิงก์แนวนอน แตะใช้งานได้ทันที[cite: 36] */}
          {isNotesCollapsed && (
            <div className="pt-1 border-t border-[#1a1d26]">
              {filteredNotes.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {filteredNotes.map(n => {
                    const urlMatch = n.content.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                      return (
                        <a
                          key={n.id}
                          href={urlMatch[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-[10px] bg-red-950/30 hover:bg-red-900/50 text-red-300 border border-red-900/40 px-2 py-0.5 rounded-lg transition"
                          title={n.content}
                        >
                          <ExternalLink size={10} /> {n.title}
                        </a>
                      );
                    }
                    return (
                      <span key={n.id} className="shrink-0 text-[10px] bg-[#181a22] text-[#8e94a4] px-2 py-0.5 rounded-lg border border-[#22252e]">
                        {n.title}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-[#555a66]">ไม่มีบันทึกลิงก์ (แตะลูกศรเพื่อเพิ่ม)</p>
              )}
            </div>
          )}

          {/* เมื่อขยาย: ฟอร์มกรอกและรายการบันทึก[cite: 38] */}
          {!isNotesCollapsed && (
            <div className="pt-1.5 border-t border-[#1a1d26] space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <input 
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2 py-1.5 text-xs text-white focus:border-red-500 focus:outline-none"
                />
                <input 
                  type="text" 
                  placeholder="หัวข้อ..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="col-span-2 bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2 py-1.5 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5">
                <input 
                  type="text" 
                  placeholder="รายละเอียด หรือวางลิงก์ เช่น https://docs.google.com/..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="flex-1 bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                />
                <button onClick={handleAddNote} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
                  เพิ่ม
                </button>
              </div>

              {filteredNotes.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {filteredNotes.map(n => (
                    <div key={n.id} className="bg-[#181a22] border border-[#22252e] p-2 rounded-lg flex justify-between items-start text-xs">
                      <div className="space-y-0.5 pr-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-red-300 text-[11px]">{n.title}</span>
                          <span className="text-[9px] text-[#6b7280] font-mono">{n.date}</span>
                        </div>
                        <div className="text-[#a6adbb] text-[11px] leading-relaxed">
                          {renderTextWithLinks(n.content)}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteNote(n.id)} className="text-[#555a66] hover:text-red-400 p-0.5">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. กล่องสรุปรายได้ประจำรอบบิล (ขนาดบางลง ไม่กินพื้นที่)[cite: 36, 38] */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-2.5">
            <span className="text-[10px] text-[#8e94a4] flex items-center gap-1 font-medium">
              <Clock size={11} /> นาทีในรอบนี้[cite: 36]
            </span>
            <p className="text-xl font-black text-white mt-0.5">{currentTotalMins} <span className="text-[10px] font-normal text-[#8e94a4]">นาที</span>[cite: 36]</p>
            <p className="text-[10px] text-red-400 mt-0.2">{activeBilledJobs.length} เรื่องรอนับยอด[cite: 36]</p>
          </div>

          <div className="bg-[#12141a] border border-red-950/40 rounded-xl p-2.5 relative overflow-hidden">
            <span className="text-[10px] text-[#8e94a4] flex items-center gap-1 font-medium">
              <DollarSign size={11} className="text-red-500" /> ยอดสุทธิ (หัก 3%)[cite: 36]
            </span>
            <p className="text-xl font-black text-red-500 mt-0.5">
              ฿{currentNet.toLocaleString('th-TH', { maximumFractionDigits: 0 })}[cite: 36]
            </p>
            <p className="text-[9px] text-[#717682] mt-0.2">ยอดรวม ฿{currentGross.toLocaleString()}[cite: 36]</p>
          </div>
        </div>

        {/* 4. กล่องเป้าหมาย: ปรับหัวข้อให้สั้นกระชับ จัดปุ่มชิดขวา ไม่ทับซ้อน[cite: 36, 38] */}
        <section className="bg-[#12141a] border border-[#22252e] rounded-xl p-2.5 transition-all space-y-1.5">
          <div className="flex justify-between items-center">
            <button 
              onClick={toggleTargetCollapse}
              className="text-[11px] font-bold text-white flex items-center gap-1.5 hover:text-red-400 transition"
            >
              <Target size={13} className="text-red-500" /> เป้าหมายเดือนนี้[cite: 36]
            </button>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowCalcGuide(!showCalcGuide)}
                className="text-[10px] text-[#8e94a4] hover:text-white flex items-center gap-0.5 bg-[#181a22] border border-[#22252e] px-1.5 py-0.5 rounded-md transition"
                title="ดูวิธีคิดคำนวณ"
              >
                <HelpCircle size={10} className="text-red-400" /> วิธีคิด[cite: 36]
              </button>
              
              <button 
                onClick={() => setIsEditingTarget(!isEditingTarget)}
                className="text-[10px] text-red-400 hover:text-red-300 bg-[#181a22] border border-[#22252e] px-1.5 py-0.5 rounded-md transition"
              >
                {isEditingTarget ? 'ปิด' : 'ตั้งเป้า'}[cite: 36]
              </button>

              <button 
                onClick={toggleTargetCollapse}
                className="p-1 text-[#8e94a4] hover:text-white rounded-md transition"
                title={isTargetCollapsed ? 'ขยายกล่องเป้าหมาย' : 'ย่อกล่องเป้าหมาย'}
              >
                {isTargetCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {/* เมื่อย่อ: แถบข้อความบรรทัดเดียว เรียบหรู[cite: 38] */}
          {isTargetCollapsed && (
            <div className="pt-1 border-t border-[#1a1d26] flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-white text-[11px]">฿{monthlyTarget.toLocaleString()}</span>[cite: 38]
                <span className="text-[9px] font-bold text-red-400 bg-red-950/40 px-1.5 py-0.2 rounded">
                  {targetPercent}%[cite: 38]
                </span>
              </div>
              <span className="text-[#8e94a4] text-[10px]">
                {remainingMinsNeeded > 0 ? `ขาดอีก ${remainingMinsNeeded} นาที (฿${remainingMoneyNeeded.toLocaleString()})` : 'ครบเป้าแล้ว 🎉'}[cite: 38]
              </span>
            </div>
          )}

          {/* เมื่อขยาย: หลอดบางลงและจัดเรียงตัวเลขสะอาดตา[cite: 36] */}
          {!isTargetCollapsed && (
            <>
              {isEditingTarget ? (
                <div className="flex gap-1.5 bg-[#0a0b0e] p-1.5 rounded-lg border border-[#22252e]">
                  <input 
                    type="number" 
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="ใส่ยอดสุทธิ..."
                    className="bg-transparent text-xs text-white flex-1 px-2 focus:outline-none font-mono"
                  />
                  <button 
                    onClick={saveTargetGoal}
                    className="bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-md transition"
                  >
                    บันทึก
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#8e94a4] text-[11px]">เป้าหมาย: <strong className="text-white font-mono">฿{monthlyTarget.toLocaleString()}</strong></span>[cite: 36]
                    <span className="text-red-400 font-bold text-[11px]">{targetPercent}% สำเร็จ</span>[cite: 36]
                  </div>

                  {/* Slim Progress Bar */}
                  <div className="w-full bg-[#181a22] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${targetPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-0.5 text-[#8e94a4]">
                    <div>
                      ต้องทำเพิ่ม: <span className="font-mono font-bold text-white">{remainingMinsNeeded > 0 ? `${remainingMinsNeeded} นาที` : 'ครบแล้ว'}</span>[cite: 36]
                      {remainingMoneyNeeded > 0 && <span className="text-[10px] text-red-400 ml-1">(ขาด ฿{remainingMoneyNeeded.toLocaleString()})</span>}[cite: 36]
                    </div>
                    <div className="text-right">
                      {remainingMinsNeeded > 0 ? `อีก ~${remainingMoviesEst} เรื่อง` : '🎉'}[cite: 36]
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* การ์ดวิธีคิดคำนวณ */}
          {showCalcGuide && (
            <div className="pt-2 border-t border-[#22252e] space-y-1.5 bg-[#0a0b0e] p-2.5 rounded-lg text-xs">
              <div className="flex justify-between items-center text-red-400 font-bold text-[11px]">
                <span className="flex items-center gap-1">
                  <Calculator size={12} /> สูตรคำนวณเป้าหมาย (หักภาษี 3%)
                </span>
                <button onClick={() => setShowCalcGuide(false)} className="text-[#8e94a4] hover:text-white">
                  <X size={12} />
                </button>
              </div>

              <div className="space-y-1 text-[#a6adbb] text-[11px] leading-relaxed">
                <p>• <strong>สุทธิต่อ 1 นาที:</strong> เรท 15 บ. หัก 3% (0.45 บ.) = <span className="text-red-400 font-bold">14.55 บ./นาที</span></p>
                <p>• <strong>สูตร:</strong> ยอดเงินที่ยังขาด ÷ 14.55 = <span className="text-white font-mono">นาทีที่ต้องทำเพิ่ม</span></p>
                <p className="text-[10px] text-red-300 bg-red-950/20 p-1.5 rounded border border-red-900/30">
                  💡 ยอดนาทีนี้คิดแบบหักภาษี 3% ให้เรียบร้อยแล้ว ทำครบจะได้รับยอดเต็มเป้าพอดี
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ======================= TAB 1: คิวงาน: การ์ดโปร่ง สบายตา ไม่กินที่[cite: 36, 37] ======================= */}
        {activeTab === 'queue' && (
          <div className="space-y-2 pt-0.5">
            
            {/* ฟอร์มบันทึกงานใหม่: ทำเป็น Accordion ซ่อนไว้เพื่อเปิดพื้นที่ให้เห็นคิวงานทันที[cite: 36] */}
            <div className="bg-[#12141a] border border-[#22252e] rounded-xl overflow-hidden transition-all">
              <button 
                onClick={() => setIsAddJobOpen(!isAddJobOpen)}
                className="w-full px-3 py-2 flex justify-between items-center text-xs font-bold text-red-400 hover:text-red-300 transition"
              >
                <span className="flex items-center gap-1.5">
                  <Plus size={13} className={`transition-transform duration-200 ${isAddJobOpen ? 'rotate-45' : ''}`} /> 
                  {isAddJobOpen ? 'ปิดฟอร์มกรอกงาน' : '+ บันทึกงานใหม่เข้าคิว'}
                </span>
                <span className="text-[10px] text-[#717682] font-normal">
                  {isAddJobOpen ? 'ซ่อน' : 'แตะเพื่อเปิด'}
                </span>
              </button>

              {isAddJobOpen && (
                <div className="p-3 pt-1 space-y-2 border-t border-[#1a1d26]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#8e94a4] block mb-0.5">1. ข้อความด่วน (ชื่อ_ตอน_นาที)[cite: 36]</label>
                      <input 
                        type="text" 
                        placeholder="เช่น GS273_55_76 หรือ DW_12_90"
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#8e94a4] block mb-0.5">2. ลิงก์ Google Drive (วางจากดิส)</label>
                      <input 
                        type="text" 
                        placeholder="https://drive.google.com/..."
                        value={driveUrlInput}
                        onChange={(e) => setDriveUrlInput(e.target.value)}
                        className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8e94a4] block mb-0.5">3. วางแถวจาก Sheet (ตัดคำอัตโนมัติ)</label>
                    <textarea 
                      rows={2}
                      placeholder="วางแถวเช่น: GS273 29-10-26 30-10-26 31-10-26 1-11-26 2-11-26"
                      value={sheetPaste}
                      onChange={(e) => setSheetPaste(e.target.value)}
                      className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none"
                    />
                  </div>

                  <button 
                    onClick={handleAddJob}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs transition shadow-sm"
                  >
                    บันทึกเข้าตารางงาน
                  </button>
                </div>
              )}
            </div>

            {/* รายการคิวงาน: การ์ดกะทัดรัด โปร่งสบายตา[cite: 37] */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-[#8e94a4] uppercase tracking-wider">
                  คิวงาน ({pendingJobs.length})
                </span>
                <span className="text-[10px] text-red-400 font-medium">วันมิกซ์เด่นพิเศษ</span>
              </div>

              {pendingJobs.length === 0 ? (
                <div className="text-center py-8 text-[#555a66] text-xs bg-[#12141a]/40 rounded-xl border border-dashed border-[#22252e]">
                  {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่มีงานค้างในรอบนี้ แตะ "+ บันทึกงานใหม่" ได้เลย'}
                </div>
              ) : (
                pendingJobs.map((job) => {
                  const isDW = job.title.toUpperCase().startsWith('DW');

                  return (
                    <div 
                      key={job.id} 
                      className={`bg-[#12141a] border rounded-xl p-2.5 transition-all ${
                        job.isIncludedInBilling ? 'border-[#22252e]' : 'border-zinc-800/60 opacity-50'
                      }`}
                    >
                      {/* แถวบน: รหัสเรื่อง + ตอน + ปุ่มการทำงานฝั่งขวาในบรรทัดเดียว[cite: 37] */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shrink-0 ${
                            isDW ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                          }`}>
                            {isDW ? 'DW' : 'GS'}[cite: 37]
                          </span>
                          <span className="font-extrabold text-white text-sm truncate">{job.title}</span>[cite: 37]
                          {job.episode && <span className="text-[10px] text-[#8e94a4] shrink-0">ตอน {job.episode}</span>}[cite: 37]
                        </div>

                        {/* ปุ่มคิดเงิน + แก้ไข + ลบ[cite: 37] */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => toggleJobBilling(job)}
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${
                              job.isIncludedInBilling 
                                ? 'border-red-500/40 text-red-400 bg-red-950/30' 
                                : 'border-[#262933] text-[#555a66] bg-[#181a22]'
                            }`}
                          >
                            {job.isIncludedInBilling ? 'คิดเงินรอบนี้' : 'ยกยอดไป'}[cite: 37]
                          </button>
                          <button onClick={() => setEditingJob(job)} className="p-1 text-[#8e94a4] hover:text-white" title="แก้ไข">
                            <Edit3 size={12} />[cite: 37]
                          </button>
                          <button onClick={() => handleDeleteJob(job.id)} className="p-1 text-[#555a66] hover:text-red-400">
                            <Trash2 size={12} />[cite: 37]
                          </button>
                        </div>
                      </div>

                      {/* แถวกลาง: นาที + ลิงก์ Drive แนบข้างกัน[cite: 37] */}
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-400 text-xs font-mono">{job.minutes} นาที</span>[cite: 37]
                          <span className="text-[10px] text-[#717682]">(฿{(job.minutes * 15).toLocaleString()})</span>[cite: 37]
                        </div>

                        {job.drive_url && (
                          <a 
                            href={job.drive_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-red-300 hover:text-white bg-[#181a22] border border-[#262933] px-2 py-0.5 rounded-md transition"
                          >
                            <FolderOpen size={10} /> เปิด Drive[cite: 37]
                          </a>
                        )}
                      </div>

                      {/* แถวล่าง: วันทำงานทั้ง 5 ขั้นตอน ปรับความสูงกระชับ[cite: 37] */}
                      <div className="grid grid-cols-5 gap-1 mt-2 pt-1.5 border-t border-[#1a1d26] text-center">
                        <div className="text-[#6b7280]">
                          <div className="text-[9px]">เกลา</div>[cite: 37]
                          <div className="text-[10px] font-mono mt-0.2">{formatToDisplayDate(job.date_glao)}</div>[cite: 37]
                        </div>
                        <div className="text-[#6b7280]">
                          <div className="text-[9px]">พากย์</div>[cite: 37]
                          <div className="text-[10px] font-mono mt-0.2">{formatToDisplayDate(job.date_pak)}</div>[cite: 37]
                        </div>
                        
                        {/* วันมิกซ์เด่นพิเศษ[cite: 37] */}
                        <div className="bg-red-950/40 border border-red-500/70 rounded-md py-0.5 text-red-200">
                          <div className="text-[9px] font-bold text-red-400">มิกซ์</div>[cite: 37]
                          <div className="text-[10px] font-black font-mono mt-0.2">{formatToDisplayDate(job.date_mix)}</div>[cite: 37]
                        </div>

                        <div className="text-[#6b7280]">
                          <div className="text-[9px]">ซับ</div>[cite: 37]
                          <div className="text-[10px] font-mono mt-0.2">{formatToDisplayDate(job.date_sub || '')}</div>[cite: 37]
                        </div>
                        <div className="text-amber-400/90 font-medium">
                          <div className="text-[9px]">เดดไลน์</div>[cite: 37]
                          <div className="text-[10px] font-mono mt-0.2">{formatToDisplayDate(job.date_deadline)}</div>[cite: 37]
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================= TAB 2: ปฏิทิน (คงเดิม)[cite: 35, 36] ======================= */}
        {activeTab === 'calendar' && (
          <div className="bg-[#12141a] border border-[#22252e] rounded-2xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-white">{monthNames[month]} {year}</h3>
                <p className="text-[10px] text-red-400 mt-0.5">แถบสียาวคลุมเดดไลน์ • วงกลมแดงสดไฮไลต์วันมิกซ์</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 bg-[#181a22] hover:bg-[#20232d] text-white rounded-lg">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 bg-[#181a22] hover:bg-[#20232d] text-white rounded-lg">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[#8e94a4]">
              <span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10" />
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

                return (
                  <div key={dayNum} onClick={() => setSelectedCalDate(dStr)} className="h-10 flex flex-col items-center justify-center relative cursor-pointer">
                    {isInRange && (
                      <div className="absolute inset-x-0 h-6 bg-red-950/40 border-y border-red-900/30 -z-0" />
                    )}
                    <div className={`z-10 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition ${
                      isMixDay ? 'bg-red-600 text-white font-black shadow-md ring-2 ring-red-400 scale-105' : 
                      isDeadlineDay ? 'border-2 border-amber-400 text-amber-300 font-bold bg-[#181a22]' : 
                      isSelected ? 'border-2 border-white text-white' : 
                      isInRange ? 'text-red-200 font-bold' : 'text-[#8e94a4] hover:text-white'
                    }`}>
                      {dayNum}
                    </div>
                    {mixJobsToday.length > 0 && (
                      <span className="text-[8px] text-red-400 font-black leading-none mt-0.5 truncate max-w-[42px]">
                        {mixJobsToday[0].title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedCalDate && (
              <div className="pt-3 border-t border-[#22252e] text-xs">
                <span className="text-[#8e94a4] font-medium">รายการในวันที่ {formatToDisplayDate(selectedCalDate)}:</span>
                <div className="mt-1.5 space-y-1.5">
                  {filteredJobs.filter(j => {
                    const start = j.date_glao || j.date_mix;
                    const end = j.date_deadline || j.date_mix;
                    return dStrActive(selectedCalDate, start, end);
                  }).map(j => (
                    <div key={j.id} className="bg-[#181a22] p-2.5 rounded-lg flex justify-between items-center border border-[#22252e]">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{j.title}</span>
                          {j.episode && <span className="text-[10px] text-[#8e94a4]">ตอน {j.episode}</span>}
                          {j.drive_url && (
                            <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 ml-1">
                              <FolderOpen size={11} />
                            </a>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {j.date_mix === selectedCalDate && <span className="text-red-400 font-bold">★ ถึงคิวมิกซ์วันนี้</span>}
                          {j.date_deadline === selectedCalDate && <span className="text-amber-400 font-bold">⚠️ เดดไลน์ส่งงานวันนี้</span>}
                          {j.date_glao === selectedCalDate && <span className="text-[#8e94a4]">เริ่มเกลา</span>}
                          {j.date_pak === selectedCalDate && <span className="text-[#8e94a4]">เริ่มพากย์</span>}
                          {j.date_sub === selectedCalDate && <span className="text-[#8e94a4]">เริ่มซับ</span>}
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

        {/* ======================= TAB 3: ตาราง & กราฟ (คงเดิม)[cite: 35, 36] ======================= */}
        {activeTab === 'table' && (
          <div className="space-y-3">
            <div className="flex bg-[#12141a] p-1 rounded-xl border border-[#22252e]">
              <button 
                onClick={() => setTableSubView('table')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'table' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <TableIcon size={13} /> ตารางข้อมูล ({filteredJobs.length})
              </button>
              <button 
                onClick={() => setTableSubView('analytics')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'analytics' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <BarChart3 size={13} /> กราฟสรุปผลงาน
              </button>
            </div>

            {tableSubView === 'table' && (
              <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-3 space-y-2.5">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">ตารางงานทั้งหมด ({filteredJobs.length} เรื่อง)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[#22252e] text-red-400 font-bold bg-[#181a22]">
                        <th className="p-2">รหัส</th>
                        <th className="p-2">เรื่อง</th>
                        <th className="p-2">นาที</th>
                        <th className="p-2">Drive</th>
                        <th className="p-2">เกลา</th>
                        <th className="p-2">พากย์</th>
                        <th className="p-2 text-white bg-red-950/60 font-black">มิกซ์</th>
                        <th className="p-2">ซับ</th>
                        <th className="p-2 text-amber-400">เดดไลน์</th>
                        <th className="p-2 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1f28]">
                      {filteredJobs.map((j) => {
                        const isDW = j.title.toUpperCase().startsWith('DW');
                        return (
                          <tr key={j.id} className="hover:bg-[#181a22]/60">
                            <td className="p-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isDW ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                {isDW ? 'DW' : 'GS'}
                              </span>
                            </td>
                            <td className="p-2 font-bold text-white">{j.title} {j.episode ? `(${j.episode})` : ''}</td>
                            <td className="p-2 text-red-400 font-mono font-bold">{j.minutes}</td>
                            <td className="p-2">
                              {j.drive_url ? (
                                <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-white inline-flex items-center gap-1">
                                  <FolderOpen size={12} /> ลิงก์
                                </a>
                              ) : '-'}
                            </td>
                            <td className="p-2 text-[#6b7280]">{formatToDisplayDate(j.date_glao)}</td>
                            <td className="p-2 text-[#6b7280]">{formatToDisplayDate(j.date_pak)}</td>
                            <td className="p-2 font-bold text-white bg-red-950/40">{formatToDisplayDate(j.date_mix)}</td>
                            <td className="p-2 text-[#6b7280]">{formatToDisplayDate(j.date_sub || '')}</td>
                            <td className="p-2 text-amber-300 font-mono">{formatToDisplayDate(j.date_deadline)}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setEditingJob(j)} className="text-[#8e94a4] hover:text-white p-0.5">
                                  <Edit3 size={12} />
                                </button>
                                <button onClick={() => handleDeleteJob(j.id)} className="text-[#555a66] hover:text-red-400 p-0.5">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredJobs.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-4 text-center text-[#555a66]">ยังไม่มีข้อมูลในตาราง</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tableSubView === 'analytics' && (
              <div className="space-y-3">
                <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-3 space-y-2">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={13} /> สรุปผลงานทั้งหมดที่ทำมา
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#181a22] border border-[#22252e] rounded-lg p-2.5">
                      <span className="text-[10px] text-[#8e94a4]">ทำอะไรมากที่สุด:</span>
                      <p className="text-sm font-black text-white mt-0.5">{analyticsData.mostWorkedType}</p>
                    </div>
                    <div className="bg-[#181a22] border border-[#22252e] rounded-lg p-2.5">
                      <span className="text-[10px] text-[#8e94a4]">ทำช่วงไหนมากที่สุด:</span>
                      <p className="text-xs font-black text-red-400 mt-0.5 leading-tight">{analyticsData.mostActivePeriodName}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-bold text-white">สัดส่วนประเภทงาน (GS vs DW)</span>
                  {analyticsData.totalAllMins > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-cyan-400 font-bold">GS: {analyticsData.gsMins} นาที</span>
                        <span className="text-amber-400 font-bold">DW: {analyticsData.dwMins} นาที</span>
                      </div>
                      <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden flex">
                        <div className="bg-cyan-500 transition-all duration-500" style={{ width: `${(analyticsData.gsMins / analyticsData.totalAllMins) * 100}%` }} />
                        <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(analyticsData.dwMins / analyticsData.totalAllMins) * 100}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ยังไม่มีข้อมูลเพื่อสร้างกราฟ</p>
                  )}
                </div>

                <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-3 space-y-2">
                  <span className="text-xs font-bold text-white">ปริมาณงานมิกซ์ตามช่วงเวลาของเดือน</span>
                  {analyticsData.maxPeriodMins > 0 ? (
                    <div className="space-y-2 pt-0.5 text-xs">
                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-0.5 text-[11px]">
                          <span>ช่วงต้นเดือน (1–10):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodEarly} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2 rounded-full overflow-hidden">
                          <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${(analyticsData.periodEarly / analyticsData.maxPeriodMins) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-0.5 text-[11px]">
                          <span>ช่วงกลางเดือน (11–20):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodMid} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2 rounded-full overflow-hidden">
                          <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${(analyticsData.periodMid / analyticsData.maxPeriodMins) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[#8e94a4] mb-0.5 text-[11px]">
                          <span>ช่วงปลายเดือน (21–31):</span>
                          <span className="text-white font-mono font-bold">{analyticsData.periodLate} นาที</span>
                        </div>
                        <div className="w-full bg-[#1c1f28] h-2 rounded-full overflow-hidden">
                          <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${(analyticsData.periodLate / analyticsData.maxPeriodMins) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ยังไม่มีข้อมูลวันที่เพื่อคำนวณช่วงเวลา</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB 4: ปิดยอด (คงเดิม)[cite: 35, 36] ======================= */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-[#22252e] pb-2.5">
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Lock size={15} className="text-red-500" /> ปิดยอด
                </h3>
                <span className="text-[10px] bg-red-950/40 text-red-400 px-2 py-0.5 rounded border border-red-900/40">
                  รอนับยอด {activeBilledJobs.length} เรื่อง
                </span>
              </div>

              <div>
                <label className="text-[11px] text-[#8e94a4] block mb-1">
                  เลือกวันตัดรอบบิล (เช่น วันที่ 31):
                </label>
                <input 
                  type="date"
                  value={cutoffDate}
                  onChange={(e) => setCutoffDate(e.target.value)}
                  className="bg-[#0a0b0e] border border-[#22252e] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="bg-[#181a22] border border-[#22252e] rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#8e94a4]">
                  <span>รวมนาทีงานรอบนี้:</span>
                  <span className="font-mono text-white font-bold">{currentTotalMins} นาที</span>
                </div>
                <div className="flex justify-between text-[#8e94a4]">
                  <span>ยอดเต็มก่อนหักภาษี (15 บ./นาที):</span>
                  <span className="font-mono text-white">฿{currentGross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>หักภาษี ณ ที่จ่ายบริษัท 3%:</span>
                  <span className="font-mono">-฿{currentTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1.5 border-t border-[#22252e]">
                  <span className="text-white">ยอดสุทธิที่ได้รับจริง:</span>
                  <span className="text-red-500">฿{currentNet.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={handleCloseBillingCycle}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={14} /> ยืนยันปิดยอดรอบนี้
              </button>
            </div>

            {/* ประวัติรอบบิล */}
            <div className="bg-[#12141a] border border-[#22252e] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} /> ประวัติรอบบิลที่ปิดยอดแล้ว ({filteredCycles.length} รอบ)
              </h3>

              <div className="space-y-2">
                {filteredCycles.map(cycle => (
                  <div key={cycle.id} className="bg-[#181a22] border border-[#22252e] rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white text-xs">{cycle.title}</h4>
                        <div className="text-[10px] text-[#8e94a4] mt-0.5">
                          ปิดยอดเมื่อ {new Date(cycle.createdAt).toLocaleDateString('th-TH')} • รวม {cycle.jobCount} เรื่อง
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRollbackCycle(cycle)}
                        className="text-[10px] text-[#8e94a4] hover:text-red-400 flex items-center gap-0.5 bg-[#12141a] border border-[#22252e] px-1.5 py-0.5 rounded transition"
                        title="ดึงงานรอบนี้กลับมาแก้ไข"
                      >
                        <RotateCcw size={11} /> ดึงกลับ
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#22252e] text-center text-xs">
                      <div>
                        <div className="text-[9px] text-[#8e94a4]">นาทีรวม</div>
                        <div className="font-mono text-white font-bold">{cycle.totalMinutes}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#8e94a4]">ภาษี 3%</div>
                        <div className="font-mono text-red-400">-฿{cycle.taxAmount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-[#8e94a4]">ยอดรับสุทธิ</div>
                        <div className="font-mono text-red-500 font-extrabold">฿{cycle.netIncome.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredCycles.length === 0 && (
                  <p className="text-xs text-[#555a66] text-center py-4">ยังไม่มีประวัติการตัดรอบบิล</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/50 rounded-xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#22252e] pb-2">
              <h4 className="text-xs font-bold text-white">แก้ไขเรื่อง {editingJob.title}</h4>
              <button onClick={() => setEditingJob(null)} className="text-[#8e94a4] hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[#8e94a4] block mb-0.5 text-[10px]">ชื่อเรื่อง</label>
                <input 
                  type="text" 
                  value={editingJob.title}
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[#8e94a4] block mb-0.5 text-[10px]">ลิงก์ Google Drive</label>
                <input 
                  type="text" 
                  value={editingJob.drive_url || ''}
                  onChange={(e) => setEditingJob({ ...editingJob, drive_url: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg p-1.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[#8e94a4] block mb-0.5 text-[10px]">ตอน</label>
                  <input 
                    type="text" 
                    value={editingJob.episode}
                    onChange={(e) => setEditingJob({ ...editingJob, episode: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[#8e94a4] block mb-0.5 text-[10px]">จำนวนนาที</label>
                  <input 
                    type="number" 
                    value={editingJob.minutes}
                    onChange={(e) => setEditingJob({ ...editingJob, minutes: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg p-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[#8e94a4] block mb-0.5 text-[10px]">วันมิกซ์</label>
                  <input 
                    type="date" 
                    value={editingJob.date_mix}
                    onChange={(e) => setEditingJob({ ...editingJob, date_mix: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-red-500/50 rounded-lg p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[#8e94a4] block mb-0.5 text-[10px]">วันเดดไลน์</label>
                  <input 
                    type="date" 
                    value={editingJob.date_deadline}
                    onChange={(e) => setEditingJob({ ...editingJob, date_deadline: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#22252e] rounded-lg p-1.5 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingJob(null)} className="flex-1 bg-[#181a22] hover:bg-[#20232d] text-[#8e94a4] font-bold py-1.5 rounded-lg text-xs transition">
                ยกเลิก
              </button>
              <button onClick={handleSaveEditJob} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 rounded-lg text-xs transition">
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {modalMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/50 rounded-xl p-4 max-w-xs w-full text-center space-y-2.5 shadow-2xl">
            <h4 className="text-sm font-bold text-white">{modalMessage.title}</h4>
            <p className="text-xs text-[#a0a6b5] leading-relaxed">{modalMessage.desc}</p>
            <button onClick={() => setModalMessage(null)} className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded-lg transition shadow-sm">
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* 5. Bottom Nav Bar 4 ปุ่ม (คงเดิม)[cite: 36, 37] */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#12141a]/95 border-t border-[#22252e] px-4 py-2 z-40 backdrop-blur">
        <div className="grid grid-cols-4 max-w-xl md:max-w-2xl mx-auto">
          <button 
            onClick={() => setActiveTab('queue')} 
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-bold transition ${
              activeTab === 'queue' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <ListFilter size={18} />
            <span>คิวงาน</span>[cite: 36]
          </button>

          <button 
            onClick={() => setActiveTab('calendar')} 
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-bold transition ${
              activeTab === 'calendar' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <CalIcon size={18} />
            <span>ปฏิทิน</span>[cite: 36]
          </button>

          <button 
            onClick={() => setActiveTab('table')} 
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-bold transition ${
              activeTab === 'table' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <TableIcon size={18} />
            <span>ตาราง & กราฟ</span>[cite: 36]
          </button>

          <button 
            onClick={() => setActiveTab('billing')} 
            className={`flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-bold transition ${
              activeTab === 'billing' ? 'text-red-500' : 'text-[#6b7280] hover:text-[#a0a6b5]'
            }`}
          >
            <DollarSign size={18} />
            <span>ปิดยอด</span>[cite: 36]
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