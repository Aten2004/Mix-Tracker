'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
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
  Check, 
  Archive, 
  ArrowUpRight, 
  Search,
  Settings,
  Tv,
  Tag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  JobItem, 
  BillingCycle, 
  formatToDisplayDate, 
  isDateString 
} from '@/lib/parser';

interface ExtendedJobItem extends JobItem {
  on_air_url?: string;
}

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

interface WorkspaceItem {
  name: string;
  monthly_target: number;
  target_stories?: number | null;
  category_labels?: Record<string, string>;
}

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  DW: 'DramaWave',
  GS: 'GoodShort'
};

interface CategoryStyle {
  badge: string;
  card: string;
  rowEven: string;
  rowOdd: string;
  bar: string;
  text: string;
}

const EXTRA_CATEGORY_STYLES: CategoryStyle[] = [
  {
    badge: 'bg-purple-400/15 text-purple-300 border-purple-400/40',
    card: 'bg-gradient-to-b from-[#171122] to-[#110d19] border-purple-500/35 hover:border-purple-500/60',
    rowEven: 'bg-purple-950/15 hover:bg-purple-900/25',
    rowOdd: 'bg-purple-950/25 hover:bg-purple-900/35',
    bar: 'bg-purple-500',
    text: 'text-purple-400'
  },
  {
    badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
    card: 'bg-gradient-to-b from-[#0e1c16] to-[#0b1511] border-emerald-500/35 hover:border-emerald-500/60',
    rowEven: 'bg-emerald-950/15 hover:bg-emerald-900/25',
    rowOdd: 'bg-emerald-950/25 hover:bg-emerald-900/35',
    bar: 'bg-emerald-500',
    text: 'text-emerald-400'
  },
  {
    badge: 'bg-pink-400/15 text-pink-300 border-pink-400/40',
    card: 'bg-gradient-to-b from-[#1f1018] to-[#170c12] border-pink-500/35 hover:border-pink-500/60',
    rowEven: 'bg-pink-950/15 hover:bg-pink-900/25',
    rowOdd: 'bg-pink-950/25 hover:bg-pink-900/35',
    bar: 'bg-pink-500',
    text: 'text-pink-400'
  },
  {
    badge: 'bg-orange-400/15 text-orange-300 border-orange-400/40',
    card: 'bg-gradient-to-b from-[#1e140e] to-[#160f0b] border-orange-500/35 hover:border-orange-500/60',
    rowEven: 'bg-orange-950/15 hover:bg-orange-900/25',
    rowOdd: 'bg-orange-950/25 hover:bg-orange-900/35',
    bar: 'bg-orange-500',
    text: 'text-orange-400'
  },
  {
    badge: 'bg-indigo-400/15 text-indigo-300 border-indigo-400/40',
    card: 'bg-gradient-to-b from-[#111324] to-[#0d0e1b] border-indigo-500/35 hover:border-indigo-500/60',
    rowEven: 'bg-indigo-950/15 hover:bg-indigo-900/25',
    rowOdd: 'bg-indigo-950/25 hover:bg-indigo-900/35',
    bar: 'bg-indigo-500',
    text: 'text-indigo-400'
  }
];

function extractJobCategory(title: string): string {
  if (!title) return 'ทั่วไป';
  const match = title.trim().match(/^([A-Za-z\u0E00-\u0E7F]+)/);
  return match ? match[1].toUpperCase() : 'ทั่วไป';
}

function getCategoryStyle(code: string): CategoryStyle {
  const upper = code.toUpperCase();
  if (upper === 'DW') {
    return {
      badge: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
      card: 'bg-gradient-to-b from-[#1b1510] to-[#14110e] border-amber-500/35 hover:border-amber-500/60',
      rowEven: 'bg-amber-950/15 hover:bg-amber-900/25',
      rowOdd: 'bg-amber-950/25 hover:bg-amber-900/35',
      bar: 'bg-amber-500',
      text: 'text-amber-400'
    };
  }
  if (upper === 'GS') {
    return {
      badge: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/40',
      card: 'bg-gradient-to-b from-[#0e1620] to-[#0c1219] border-cyan-500/35 hover:border-cyan-500/60',
      rowEven: 'bg-cyan-950/10 hover:bg-cyan-900/20',
      rowOdd: 'bg-cyan-950/20 hover:bg-cyan-900/30',
      bar: 'bg-cyan-500',
      text: 'text-cyan-400'
    };
  }
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = upper.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXTRA_CATEGORY_STYLES.length;
  return EXTRA_CATEGORY_STYLES[index];
}

function detectKnownPlatform(url: string): string {
  if (!url) return '';
  const lower = url.toLowerCase();
  if (lower.includes('dramawave')) return 'DramaWave';
  if (lower.includes('goodshort')) return 'GoodShort';
  if (lower.includes('reelshort')) return 'ReelShort';
  if (lower.includes('shortmax')) return 'ShortMax';
  if (lower.includes('flextv')) return 'FlexTV';
  if (lower.includes('kalos')) return 'KalosTV';
  if (lower.includes('moboreels')) return 'MoboReels';
  if (lower.includes('dramabox')) return 'DramaBox';
  return '';
}

function detectPlatformDisplay(url: string): string {
  if (!url) return '';
  const known = detectKnownPlatform(url);
  if (known) return known;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isDateLike(str: string): boolean {
  if (!str) return false;
  return /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str.trim());
}

function cleanDateToStandard(str: string): string {
  if (!str) return '';
  const clean = str.trim().replace(/\./g, '-').replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const fullY = y > 2400 ? y - 543 : y;
      return `${fullY}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parseInt(parts[2], 10);
      if (y > 2400) {
        y = y - 543;
      } else if (y < 100) {
        if (y >= 60 && y <= 99) {
          y = 2500 + y - 543;
        } else {
          y = 2000 + y;
        }
      }
      return `${y}-${m}-${d}`;
    }
  }
  return str;
}

function parseFlexibleJobInput(text1: string, text2: string) {
  const combined = `${text1}\n${text2}`.trim();
  let title = '';
  let episode = '';
  let minutes = 0;
  let drive_url = '';

  const urlMatches = combined.match(/(https?:\/\/[^\s]+)/g);
  if (urlMatches && urlMatches.length > 0) {
    drive_url = urlMatches[0];
  }

  const lines = combined.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleanLine = line.replace(/(https?:\/\/[^\s]+)/g, '').trim();
    if (!cleanLine) continue;

    const underMatch = cleanLine.match(/([A-Za-z0-9\u0E00-\u0E7F]+)_([0-9.]+)(?:_([0-9.]+))?/);
    if (underMatch && !isDateLike(underMatch[1])) {
      title = underMatch[1];
      if (underMatch[3] !== undefined) {
        episode = underMatch[2];
        minutes = parseFloat(underMatch[3]) || 0;
      } else {
        minutes = parseFloat(underMatch[2]) || 0;
      }
      break;
    }
  }

  if (!title) {
    for (const line of lines) {
      const cleanLine = line.replace(/(https?:\/\/[^\s]+)/g, '').trim();
      const tokens = cleanLine.split(/\t+|\s{2,}|\s+/).filter(Boolean);
      for (const tok of tokens) {
        if (!isDateLike(tok) && !tok.match(/^[0-9.]+$/)) {
          title = tok;
          break;
        }
      }
      if (title) break;
    }
  }

  const allTokens = combined
    .replace(/(https?:\/\/[^\s]+)/g, '')
    .split(/\t+|\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  const foundDates: string[] = [];
  for (const tok of allTokens) {
    if (isDateLike(tok)) {
      foundDates.push(cleanDateToStandard(tok));
    }
  }

  let date_glao = '';
  let date_pak = '';
  let date_mix = '';
  let date_sub = '';
  let date_deadline = '';

  if (foundDates.length >= 5) {
    date_glao = foundDates[0];
    date_pak = foundDates[1];
    date_mix = foundDates[2];
    date_sub = foundDates[3];
    date_deadline = foundDates[4];
  } else if (foundDates.length === 4) {
    date_glao = foundDates[0];
    date_pak = foundDates[1];
    date_mix = foundDates[2];
    date_deadline = foundDates[3];
  } else if (foundDates.length === 3) {
    date_pak = foundDates[0];
    date_mix = foundDates[1];
    date_deadline = foundDates[2];
  } else if (foundDates.length === 2) {
    date_mix = foundDates[0];
    date_deadline = foundDates[1];
  } else if (foundDates.length === 1) {
    date_deadline = foundDates[0];
    date_mix = foundDates[0];
  }

  return {
    title,
    episode,
    minutes,
    drive_url,
    date_glao,
    date_pak,
    date_mix,
    date_sub,
    date_deadline
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'queue' | 'calendar' | 'table' | 'billing'>('queue');
  const [tableSubView, setTableSubView] = useState<'current' | 'billed' | 'analytics'>('current');
  const [loading, setLoading] = useState(true);

  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableOnAirFilter, setTableOnAirFilter] = useState<'all' | 'on_air' | 'not_on_air'>('all');
  const [tableCategoryFilter, setTableCategoryFilter] = useState<string>('ALL');

  const [workspaceList, setWorkspaceList] = useState<WorkspaceItem[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>(['ทีมซีรีส์จีน (GS/DW)', 'ทีมสำรอง']);
  const [selectedWs, setSelectedWs] = useState<string>('ทีมซีรีส์จีน (GS/DW)');
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);

  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const [jobs, setJobs] = useState<ExtendedJobItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);

  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const [isTargetCollapsed, setIsTargetCollapsed] = useState(false);
  const [showCalcGuide, setShowCalcGuide] = useState(false);

  const [addJobTargetStatus, setAddJobTargetStatus] = useState<'pending' | 'billed'>('pending');

  const [monthlyTarget, setMonthlyTarget] = useState<number>(14700);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('14700');
  const [customMoviesCount, setCustomMoviesCount] = useState<number | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simMinutesInput, setSimMinutesInput] = useState('');
  const [simCustomMoviesCount, setSimCustomMoviesCount] = useState<number | null>(null);

  const [quickInput, setQuickInput] = useState('');
  const [sheetPaste, setSheetPaste] = useState('');

  const [noteDate, setNoteDate] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // State สำหรับจัดการ Note: คัดลอก และเปิดดู/แก้ไขแบบเต็ม
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  const [editingJob, setEditingJob] = useState<ExtendedJobItem | null>(null);
  const [onAirModalJob, setOnAirModalJob] = useState<ExtendedJobItem | null>(null);
  const [onAirUrlInput, setOnAirUrlInput] = useState('');

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 0, 1));
  const [selectedCalDate, setSelectedCalDate] = useState<string>('');
  const [todayStr, setTodayStr] = useState<string>('');
  const [todayDisplay, setTodayDisplay] = useState<string>('');

  const [cutoffDate, setCutoffDate] = useState<string>('2026-10-31');

  const [dialogState, setDialogState] = useState<CustomDialog | null>(null);
  const [promptInputValue, setPromptInputValue] = useState('');
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const thaiDays = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

  useEffect(() => {
    const savedNotesCol = localStorage.getItem('mix_notes_collapsed');
    if (savedNotesCol) setIsNotesCollapsed(savedNotesCol === 'true');

    const savedTargetCol = localStorage.getItem('mix_target_collapsed');
    if (savedTargetCol) setIsTargetCollapsed(savedTargetCol === 'true');

    const savedWs = localStorage.getItem('mix_selected_ws');
    if (savedWs) setSelectedWs(savedWs);

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const dayName = thaiDays[now.getDay()];
    setTodayStr(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setTodayDisplay(`${dayName}ที่ ${d} ${monthNames[m]} ${y}`);

    setCurrentMonth(new Date(y, m, 1));
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

  const saveTargetGoal = async () => {
    const val = parseFloat(targetInput);
    if (!isNaN(val) && val >= 0) {
      setMonthlyTarget(val);
      setIsEditingTarget(false);

      await supabase
        .from('workspaces')
        .update({ monthly_target: val })
        .eq('name', selectedWs);

      setWorkspaceList(prev => prev.map(w => w.name === selectedWs ? { ...w, monthly_target: val } : w));
    }
  };

  const handleUpdateTargetMovies = async (nextCount: number | null) => {
    setCustomMoviesCount(nextCount);
    setWorkspaceList(prev =>
      prev.map(w => (w.name === selectedWs ? { ...w, target_stories: nextCount } : w))
    );

    if (nextCount === null) {
      localStorage.removeItem(`mix_target_stories_${selectedWs}`);
    } else {
      localStorage.setItem(`mix_target_stories_${selectedWs}`, String(nextCount));
    }

    await supabase
      .from('workspaces')
      .update({ target_stories: nextCount })
      .eq('name', selectedWs);
  };

  const handleGoToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

      if (wsData && wsData.length > 0) {
        const wsItems: WorkspaceItem[] = wsData.map(w => ({
          name: w.name,
          monthly_target: Number(w.monthly_target) || 14700,
          target_stories: w.target_stories !== undefined && w.target_stories !== null ? Number(w.target_stories) : null,
          category_labels: (w.category_labels && typeof w.category_labels === 'object')
            ? { ...DEFAULT_CATEGORY_LABELS, ...w.category_labels }
            : { ...DEFAULT_CATEGORY_LABELS }
        }));
        setWorkspaceList(wsItems);
        const names = wsItems.map(w => w.name);
        setWorkspaces(names);

        const savedWs = localStorage.getItem('mix_selected_ws');
        const activeName = (savedWs && names.includes(savedWs)) ? savedWs : (names.includes(selectedWs) ? selectedWs : names[0]);
        setSelectedWs(activeName);

        const currentWs = wsItems.find(w => w.name === activeName);
        if (currentWs) {
          setMonthlyTarget(currentWs.monthly_target);
          setTargetInput(currentWs.monthly_target.toString());
          setCategoryLabels(currentWs.category_labels || DEFAULT_CATEGORY_LABELS);
          const localSaved = localStorage.getItem(`mix_target_stories_${activeName}`);
          const resolvedStories = currentWs.target_stories !== null && currentWs.target_stories !== undefined
            ? currentWs.target_stories
            : (localSaved ? Number(localSaved) : null);
          setCustomMoviesCount(resolvedStories);
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
          on_air_url: row.on_air_url || '',
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
          const defaultTarget = 14700;
          const initLabels = { ...DEFAULT_CATEGORY_LABELS };
          await supabase.from('workspaces').insert([{
            name: trimmed,
            monthly_target: defaultTarget,
            category_labels: initLabels
          }]);
          setWorkspaces(prev => [...prev, trimmed]);
          setWorkspaceList(prev => [...prev, {
            name: trimmed,
            monthly_target: defaultTarget,
            target_stories: null,
            category_labels: initLabels
          }]);
          setSelectedWs(trimmed);
          setMonthlyTarget(defaultTarget);
          setTargetInput(defaultTarget.toString());
          setCategoryLabels(initLabels);
          setCustomMoviesCount(null);
          setTableCategoryFilter('ALL');
          localStorage.setItem('mix_selected_ws', trimmed);
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
          setWorkspaceList(prev => prev.map(w => w.name === selectedWs ? { ...w, name: trimmed } : w));
          setSelectedWs(trimmed);
          localStorage.setItem('mix_selected_ws', trimmed);
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
        setTableCategoryFilter('ALL');
        localStorage.setItem('mix_selected_ws', remaining[0]);
        fetchData();
      }
    });
  };

  const handleSaveCategoryLabels = async (nextLabels: Record<string, string>) => {
    setCategoryLabels(nextLabels);
    setWorkspaceList(prev =>
      prev.map(w => (w.name === selectedWs ? { ...w, category_labels: nextLabels } : w))
    );
    await supabase
      .from('workspaces')
      .update({ category_labels: nextLabels })
      .eq('name', selectedWs);
  };

  const handleAddCategoryItem = async () => {
    const code = newCatCode.trim().toUpperCase();
    const label = newCatName.trim();
    if (!code || !label) return;
    const nextLabels = { ...categoryLabels, [code]: label };
    setNewCatCode('');
    setNewCatName('');
    await handleSaveCategoryLabels(nextLabels);
  };

  const handleRemoveCategoryItem = async (code: string) => {
    const nextLabels = { ...categoryLabels };
    delete nextLabels[code];
    await handleSaveCategoryLabels(nextLabels);
  };

  const handleOpenOnAirModal = (job: ExtendedJobItem) => {
    setOnAirModalJob(job);
    setOnAirUrlInput(job.on_air_url || '');
  };

  const handleSaveOnAirUrl = async () => {
    if (!onAirModalJob) return;
    const trimmed = onAirUrlInput.trim();
    const normalizedUrl = trimmed
      ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
      : '';

    const { error } = await supabase
      .from('jobs')
      .update({ on_air_url: normalizedUrl })
      .eq('id', onAirModalJob.id);

    if (!error) {
      setJobs(prev =>
        prev.map(j => (j.id === onAirModalJob.id ? { ...j, on_air_url: normalizedUrl } : j))
      );

      if (normalizedUrl) {
        const catCode = extractJobCategory(onAirModalJob.title);
        const knownPlatform = detectKnownPlatform(normalizedUrl);
        if (catCode !== 'ทั่วไป' && knownPlatform && !categoryLabels[catCode]) {
          await handleSaveCategoryLabels({ ...categoryLabels, [catCode]: knownPlatform });
        }
      }

      setOnAirModalJob(null);
      setOnAirUrlInput('');
    } else {
      setDialogState({ title: 'เกิดข้อผิดพลาด', desc: error.message, type: 'alert' });
    }
  };

  const handleAddJob = async () => {
    const parsed = parseFlexibleJobInput(quickInput, sheetPaste);
    let finalTitle = parsed.title;
    const finalEpisode = parsed.episode;
    const finalMinutes = parsed.minutes;
    const finalDriveUrl = parsed.drive_url;
    const dates = {
      date_glao: parsed.date_glao,
      date_pak: parsed.date_pak,
      date_mix: parsed.date_mix,
      date_sub: parsed.date_sub,
      date_deadline: parsed.date_deadline || parsed.date_mix || new Date().toISOString().split('T')[0]
    };

    if (isDateString(finalTitle)) finalTitle = 'งานไม่มีชื่อ';

    if (!finalTitle) {
      setDialogState({ 
        title: 'ข้อมูลไม่ครบ', 
        desc: 'กรุณากรอกรหัสงาน เช่น GS273_55_76 หรือวางข้อความที่มีชื่อเรื่อง', 
        type: 'alert' 
      });
      return;
    }

    const payload = {
      id: Date.now().toString(),
      workspace: selectedWs,
      title: finalTitle,
      episode: finalEpisode,
      minutes: finalMinutes,
      drive_url: finalDriveUrl,
      on_air_url: '',
      ...dates,
      is_included_in_billing: addJobTargetStatus === 'pending',
      status: addJobTargetStatus
    };

    const { error } = await supabase.from('jobs').insert([payload]);

    if (!error) {
      setQuickInput('');
      setSheetPaste('');
      fetchData();
      setDialogState({ 
        title: 'สำเร็จ', 
        desc: addJobTargetStatus === 'pending'
          ? `เพิ่มงาน ${finalTitle} เข้าสู่คิวเรียบร้อย`
          : `บันทึกงาน ${finalTitle} เป็นประวัติเก่าที่ปิดรอบแล้ว`, 
        type: 'alert' 
      });
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
        const trimmedOnAir = (editingJob.on_air_url || '').trim();
        const normalizedOnAir = trimmedOnAir
          ? (/^https?:\/\//i.test(trimmedOnAir) ? trimmedOnAir : `https://${trimmedOnAir}`)
          : '';

        const { error } = await supabase.from('jobs').update({
          title: editingJob.title,
          episode: editingJob.episode,
          minutes: editingJob.minutes,
          drive_url: editingJob.drive_url || '',
          on_air_url: normalizedOnAir,
          date_glao: editingJob.date_glao || '',
          date_pak: editingJob.date_pak || '',
          date_mix: editingJob.date_mix || '',
          date_sub: editingJob.date_sub || '',
          date_deadline: editingJob.date_deadline || ''
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

  const toggleJobBilling = async (job: ExtendedJobItem) => {
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

  const handleMarkJobAsBilled = (job: ExtendedJobItem) => {
    setDialogState({
      type: 'confirm',
      title: 'ย้ายไปงานปิดรอบแล้ว',
      desc: `ต้องการย้ายงาน "${job.title}" ออกจากคิวรอบปัจจุบันเพื่อไปเก็บในตารางประวัติปิดรอบแล้วใช่หรือไม่?`,
      confirmText: 'ย้ายไปประวัติ',
      onConfirm: async () => {
        await supabase.from('jobs').update({ status: 'billed' }).eq('id', job.id);
        fetchData();
      }
    });
  };

  const handleReopenJob = (job: ExtendedJobItem) => {
    setDialogState({
      type: 'confirm',
      title: 'ดึงกลับมารอบปัจจุบัน',
      desc: `ต้องการนำงาน "${job.title}" กลับมาในคิวรอบปัจจุบันเพื่อคำนวณเงินใหม่ใช่หรือไม่?`,
      confirmText: 'ดึงกลับมา',
      onConfirm: async () => {
        await supabase.from('jobs').update({ 
          status: 'pending', 
          billing_cycle_id: null,
          is_included_in_billing: true 
        }).eq('id', job.id);
        fetchData();
      }
    });
  };

  // คัดลอกข้อความโน้ต
  const handleCopyNote = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNoteId(id);
    setTimeout(() => {
      setCopiedNoteId(null);
    }, 1500);
  };

  // บันทึกการแก้ไขโน้ตลง Supabase
  const handleSaveEditNote = async () => {
    if (!editingNote) return;
    const { error } = await supabase
      .from('notes')
      .update({
        title: editingNote.title.trim() || 'บันทึกข้อความ',
        content: editingNote.content,
        date: editingNote.date
      })
      .eq('id', editingNote.id);

    if (!error) {
      setEditingNote(null);
      fetchData();
    } else {
      setDialogState({ title: 'เกิดข้อผิดพลาด', desc: error.message, type: 'alert' });
    }
  };

  // ฟังก์ชันเลื่อนตำแหน่งขึ้น-ลง และบันทึกลำดับลง Supabase เพื่อให้เห็นตรงกันทุกอุปกรณ์
  const moveNotePosition = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredNotes.length) return;

    const updated = [...filteredNotes];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);

    // อัปเดต State หน้าจอทันที
    setNotes(prev => {
      const otherWsNotes = prev.filter(n => n.workspace !== selectedWs);
      return [...updated, ...otherWsNotes];
    });

    // บันทึกลำดับลง Supabase โดยอัปเดต created_at ให้เรียงจากใหม่ไปเก่าตามลำดับที่จัด
    try {
      const baseTime = Date.now();
      await Promise.all(
        updated.map((item, i) =>
          supabase
            .from('notes')
            .update({ created_at: new Date(baseTime - i * 1000).toISOString() })
            .eq('id', item.id)
        )
      );
    } catch (err) {
      console.error('Error saving note order to Supabase:', err);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() && !noteTitle.trim()) return;
    const finalTitle = noteTitle.trim() || noteContent.trim().split('\n')[0].slice(0, 35) || 'บันทึกข้อความ';
    const newNote = {
      id: Date.now().toString(),
      workspace: selectedWs,
      date: noteDate || new Date().toISOString().split('T')[0],
      title: finalTitle,
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

  const handleCopyJob = (job: ExtendedJobItem) => {
    const code = job.episode ? `${job.title}_${job.episode}_${job.minutes}` : `${job.title}_${job.minutes}`;
    navigator.clipboard.writeText(code);
    setCopiedJobId(job.id);
    setTimeout(() => {
      setCopiedJobId(null);
    }, 1500);
  };

  const filteredJobs = useMemo(() => jobs.filter(j => j.workspace === selectedWs), [jobs, selectedWs]);
  const filteredNotes = useMemo(() => notes.filter(n => n.workspace === selectedWs), [notes, selectedWs]);
  const filteredCycles = useMemo(() => billingCycles.filter(b => b.workspace === selectedWs), [billingCycles, selectedWs]);

  const pendingJobs = useMemo(() => filteredJobs.filter(j => j.status === 'pending'), [filteredJobs]);
  const currentCyclePendingJobs = useMemo(() => pendingJobs, [pendingJobs]);
  const billedJobs = useMemo(() => filteredJobs.filter(j => j.status === 'billed'), [filteredJobs]);

  const tableCategoryOptions = useMemo(() => {
    const baseList = tableSubView === 'billed' ? billedJobs : currentCyclePendingJobs;
    const counts: Record<string, number> = {};
    baseList.forEach(j => {
      const code = extractJobCategory(j.title);
      counts[code] = (counts[code] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [tableSubView, billedJobs, currentCyclePendingJobs]);

  const searchedCurrentJobs = useMemo(() => {
    return currentCyclePendingJobs.filter(j => {
      const matchesOnAir =
        tableOnAirFilter === 'all'
          ? true
          : tableOnAirFilter === 'on_air'
            ? Boolean(j.on_air_url)
            : !j.on_air_url;
      if (!matchesOnAir) return false;

      const jobCat = extractJobCategory(j.title);
      if (tableCategoryFilter !== 'ALL' && jobCat !== tableCategoryFilter) {
        return false;
      }

      if (!tableSearchQuery.trim()) return true;
      const q = tableSearchQuery.trim().toLowerCase();
      const catCode = jobCat.toLowerCase();
      const catLabel = (categoryLabels[jobCat] || '').toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        j.episode.toLowerCase().includes(q) ||
        catCode.includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [currentCyclePendingJobs, tableSearchQuery, tableOnAirFilter, tableCategoryFilter, categoryLabels]);

  const searchedBilledJobs = useMemo(() => {
    return billedJobs.filter(j => {
      const matchesOnAir =
        tableOnAirFilter === 'all'
          ? true
          : tableOnAirFilter === 'on_air'
            ? Boolean(j.on_air_url)
            : !j.on_air_url;
      if (!matchesOnAir) return false;

      const jobCat = extractJobCategory(j.title);
      if (tableCategoryFilter !== 'ALL' && jobCat !== tableCategoryFilter) {
        return false;
      }

      if (!tableSearchQuery.trim()) return true;
      const q = tableSearchQuery.trim().toLowerCase();
      const catCode = jobCat.toLowerCase();
      const catLabel = (categoryLabels[jobCat] || '').toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        j.episode.toLowerCase().includes(q) ||
        catCode.includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [billedJobs, tableSearchQuery, tableOnAirFilter, tableCategoryFilter, categoryLabels]);

  const tableOnAirCounts = useMemo(() => {
    const baseList = (tableSubView === 'billed' ? billedJobs : currentCyclePendingJobs).filter(j =>
      tableCategoryFilter === 'ALL' ? true : extractJobCategory(j.title) === tableCategoryFilter
    );
    const onAir = baseList.filter(j => Boolean(j.on_air_url)).length;
    return {
      all: baseList.length,
      onAir,
      notOnAir: baseList.length - onAir
    };
  }, [tableSubView, billedJobs, currentCyclePendingJobs, tableCategoryFilter]);

  const activeBilledJobs = useMemo(() => currentCyclePendingJobs.filter(j => j.isIncludedInBilling), [currentCyclePendingJobs]);

  const currentTotalMins = useMemo(() => activeBilledJobs.reduce((acc, cur) => acc + (Number(cur.minutes) || 0), 0), [activeBilledJobs]);
  const currentGross = currentTotalMins * 15;
  const currentTax = currentGross * 0.03;
  const currentNet = currentGross - currentTax;

  const handleCopyAllJobs = () => {
    if (currentCyclePendingJobs.length === 0) {
      setDialogState({
        type: 'alert',
        title: 'ไม่มีข้อมูล',
        desc: 'ไม่มีรายการงานในรอบนี้ให้คัดลอก'
      });
      return;
    }
    const lines = currentCyclePendingJobs.map(j => j.episode ? `${j.title}_${j.episode}_${j.minutes}` : `${j.title}_${j.minutes}`);
    const minValues = currentCyclePendingJobs.map(j => Number(j.minutes) || 0);
    const sumTotal = minValues.reduce((a, b) => a + b, 0);
    const sumString = minValues.length > 0 ? `${minValues.join(' + ')} = ${sumTotal} นาที` : '0 นาที';
    
    const totalGrossVal = sumTotal * 15;
    const totalNetVal = totalGrossVal * 0.97;

    const output = `${lines.join('\n')}\n\nรวมนาที: ${sumString}\nยอดเต็ม: ฿${totalGrossVal.toLocaleString()}\nยอดสุทธิ: ฿${totalNetVal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
    
    navigator.clipboard.writeText(output);
    setDialogState({
      type: 'alert',
      title: 'คัดลอกสรุปรายการทั้งหมดแล้ว',
      desc: output
    });
  };

  const netRatePerMin = 15 * 0.97;
  const totalMinsNeeded = Math.ceil(monthlyTarget / netRatePerMin);
  const rawRemainingMins = Math.max(0, totalMinsNeeded - currentTotalMins);
  const targetPercent = monthlyTarget > 0 ? Math.min(100, Math.round((currentNet / monthlyTarget) * 100)) : 100;

  // คำนวณจำนวนเรื่องและนาทีเฉลี่ย
  const standardMovieLength = 80;
  const autoMoviesEst = rawRemainingMins > 0 
    ? Math.ceil(rawRemainingMins / standardMovieLength) 
    : 0;
  const remainingMoviesEst = rawRemainingMins > 0
    ? (customMoviesCount && customMoviesCount > 0 ? customMoviesCount : autoMoviesEst)
    : 0;
  const avgRemainingMinsPerMovie = remainingMoviesEst > 0 
    ? Math.ceil(rawRemainingMins / remainingMoviesEst) + 1
    : 0;

  const remainingMinsNeeded = remainingMoviesEst * avgRemainingMinsPerMovie;

  const remainingMoneyNeeded = Math.round(remainingMinsNeeded * netRatePerMin);

  const analyticsData = useMemo(() => {
    const shortMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const catMap: Record<string, { code: string; mins: number; count: number; onAirCount: number; netIncome: number }> = {};
    const monthMap: Record<string, { key: string; label: string; mins: number; count: number; netIncome: number }> = {};
    let periodEarly = 0;
    let periodEarlyCount = 0;
    let periodMid = 0;
    let periodMidCount = 0;
    let periodLate = 0;
    let periodLateCount = 0;
    let totalOnAirCount = 0;
    let billedMins = 0;

    filteredJobs.forEach(j => {
      const code = extractJobCategory(j.title);
      const m = Number(j.minutes) || 0;
      const net = m * 15 * 0.97;
      const isOnAir = Boolean(j.on_air_url);
      if (isOnAir) totalOnAirCount += 1;
      if (j.status === 'billed') billedMins += m;

      if (!catMap[code]) {
        catMap[code] = { code, mins: 0, count: 0, onAirCount: 0, netIncome: 0 };
      }
      catMap[code].mins += m;
      catMap[code].count += 1;
      catMap[code].netIncome += net;
      if (isOnAir) catMap[code].onAirCount += 1;

      const dateRef = j.date_mix || j.date_deadline || j.date_glao;
      if (dateRef) {
        const parts = dateRef.split('-');
        if (parts.length >= 2) {
          const yShort = parts[0].slice(-2);
          const mIdx = parseInt(parts[1], 10) - 1;
          const mKey = `${parts[0]}-${parts[1]}`;
          if (mIdx >= 0 && mIdx < 12) {
            if (!monthMap[mKey]) {
              monthMap[mKey] = {
                key: mKey,
                label: `${shortMonths[mIdx]} ${yShort}`,
                mins: 0,
                count: 0,
                netIncome: 0
              };
            }
            monthMap[mKey].mins += m;
            monthMap[mKey].count += 1;
            monthMap[mKey].netIncome += net;
          }
        }
        const day = parseInt(parts[2], 10);
        if (day >= 1 && day <= 10) {
          periodEarly += m;
          periodEarlyCount += 1;
        } else if (day >= 11 && day <= 20) {
          periodMid += m;
          periodMidCount += 1;
        } else if (day >= 21) {
          periodLate += m;
          periodLateCount += 1;
        }
      }
    });

    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.mins - a.mins);
    const totalAllMins = categoryBreakdown.reduce((acc, item) => acc + item.mins, 0);
    const totalAllNet = totalAllMins * 15 * 0.97;
    const totalJobsCount = filteredJobs.length;
    const avgMinsPerJob = totalJobsCount > 0 ? Math.round(totalAllMins / totalJobsCount) : 0;
    const avgNetPerJob = totalJobsCount > 0 ? Math.round(totalAllNet / totalJobsCount) : 0;
    const onAirPercent = totalJobsCount > 0 ? Math.round((totalOnAirCount / totalJobsCount) * 100) : 0;

    const monthlyTrend = Object.values(monthMap)
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 6);
    const maxMonthNet = Math.max(monthlyTarget, ...monthlyTrend.map(m => m.netIncome), 1);

    const topCat = categoryBreakdown[0];
    const mostWorkedType = topCat
      ? `${topCat.code}${categoryLabels[topCat.code] ? ` (${categoryLabels[topCat.code]})` : ''}`
      : 'ยังไม่มีข้อมูล';

    const maxPeriodMins = Math.max(periodEarly, periodMid, periodLate);
    let mostActivePeriodName = 'ยังไม่มีข้อมูล';
    if (maxPeriodMins > 0) {
      if (maxPeriodMins === periodEarly) mostActivePeriodName = 'ต้นเดือน (1-10)';
      else if (maxPeriodMins === periodMid) mostActivePeriodName = 'กลางเดือน (11-20)';
      else mostActivePeriodName = 'ปลายเดือน (21-31)';
    }

    return {
      categoryBreakdown,
      totalAllMins,
      totalAllNet,
      billedMins,
      totalJobsCount,
      avgMinsPerJob,
      avgNetPerJob,
      totalOnAirCount,
      onAirPercent,
      monthlyTrend,
      maxMonthNet,
      mostWorkedType,
      periodEarly,
      periodEarlyCount,
      periodMid,
      periodMidCount,
      periodLate,
      periodLateCount,
      maxPeriodMins,
      mostActivePeriodName
    };
  }, [filteredJobs, categoryLabels, monthlyTarget]);

  const handleCloseBillingCycle = () => {
    if (activeBilledJobs.length === 0) {
      setDialogState({ title: 'ไม่สามารถปิดยอดได้', desc: 'ไม่มีรายการงานที่เลือกคิดเงินในรอบนี้', type: 'alert' });
      return;
    }
    setDialogState({
      type: 'confirm',
      title: 'ยืนยันการปิดรอบคำนวณเงิน',
      desc: `ยืนยันการปิดรอบคำนวณเงิน ${activeBilledJobs.length} เรื่อง รวม ${currentTotalMins} นาที\nยอดจริง ฿${currentNet.toLocaleString()} หรือไม่?`,
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
          job_ids: activeBilledJobs.map(j => j.id)
        };

        const { error: cycleError } = await supabase.from('billing_cycles').insert([newCycle]);
        if (cycleError) {
          setDialogState({
            type: 'alert',
            title: 'บันทึกประวัติปิดรอบไม่สำเร็จ',
            desc: cycleError.message
          });
          return;
        }
        
        const targetIds = activeBilledJobs.map(j => j.id);
        const { error: jobError } = await supabase.from('jobs').update({
          status: 'billed',
          billing_cycle_id: cycleId
        }).in('id', targetIds);

        if (jobError) {
          setDialogState({
            type: 'alert',
            title: 'อัปเดตสถานะงานไม่สำเร็จ',
            desc: jobError.message
          });
          return;
        }

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
      <header className="sticky top-0 z-30 bg-[#12141a]/95 backdrop-blur border-b border-[#262933] px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex justify-between items-center max-w-xl md:max-w-2xl mx-auto gap-3">
          
          <div className="min-w-0 flex-1 relative">
            <button
              type="button"
              onClick={() => setIsWsDropdownOpen(!isWsDropdownOpen)}
              className="flex items-center gap-1.5 text-white font-black text-xl sm:text-2xl tracking-tight focus:outline-none cursor-pointer max-w-[210px] xs:max-w-[280px] sm:max-w-md truncate text-left"
            >
              <span className="truncate">{selectedWs}</span>
              <ChevronDown size={18} className={`text-[#8e94a4] transition-transform duration-200 shrink-0 ${isWsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsWsDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-2.5 z-50 min-w-[200px] max-w-[280px] bg-[#12141a] border border-[#262933] rounded-2xl shadow-2xl py-1.5 overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {workspaceList.map(ws => (
                      <button
                        key={ws.name}
                        type="button"
                        onClick={() => {
                          setSelectedWs(ws.name);
                          setMonthlyTarget(ws.monthly_target);
                          setTargetInput(ws.monthly_target.toString());
                          setCategoryLabels(ws.category_labels || DEFAULT_CATEGORY_LABELS);
                          const localSaved = localStorage.getItem(`mix_target_stories_${ws.name}`);
                          const resolvedStories = ws.target_stories !== null && ws.target_stories !== undefined
                            ? ws.target_stories
                            : (localSaved ? Number(localSaved) : null);
                          setCustomMoviesCount(resolvedStories);
                          setTableCategoryFilter('ALL');
                          localStorage.setItem('mix_selected_ws', ws.name);
                          setIsWsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between transition ${
                          ws.name === selectedWs 
                            ? 'bg-red-950/40 text-red-400' 
                            : 'text-white hover:bg-[#1c1f28]'
                        }`}
                      >
                        <span className="truncate">{ws.name}</span>
                        {ws.name === selectedWs && <Check size={14} className="text-red-400 shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-[#262933] my-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      handleAddWorkspace();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-bold text-red-400 hover:bg-[#1c1f28] flex items-center gap-2 transition"
                  >
                    <Plus size={15} className="shrink-0 text-red-400" />
                    <span>เพิ่มทีมใหม่...</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button onClick={() => setIsCategoryModalOpen(true)} title="จัดการประเภทเรื่อง / ค่าย" className="p-2 sm:p-2.5 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] rounded-xl transition">
              <Tag size={15} />
            </button>
            <button onClick={handleRenameWorkspace} title="เปลี่ยนชื่อทีม" className="p-2 sm:p-2.5 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] rounded-xl transition">
              <Edit3 size={15} />
            </button>
            <button onClick={handleDeleteWorkspace} title="ลบทีม" className="p-2 sm:p-2.5 bg-[#1c1f28] hover:bg-red-950/50 text-[#8e94a4] hover:text-red-400 border border-[#262933] rounded-xl transition">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-xl md:max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-5 space-y-3.5 sm:space-y-4">

        {/* 1. ช่องนาทีรอบ & ยอดสุทธิ ขยายใหญ่ เด่น ชัดเจน */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 sm:p-5 shadow-sm">
            <span className="text-xs sm:text-sm text-[#8e94a4] flex items-center gap-1.5 font-medium">
              <Clock size={16} /> นาทีในรอบนี้
            </span>
            <p className="text-2xl xs:text-3xl sm:text-4xl font-black text-white mt-2 truncate">
              {currentTotalMins} <span className="text-xs sm:text-sm font-normal text-[#8e94a4]">นาที</span>
            </p>
            <p className="text-[11px] sm:text-xs text-red-400 font-semibold mt-1 truncate">
              {activeBilledJobs.length} เรื่องที่รอนับยอด
            </p>
          </div>

          <div className="bg-[#12141a] border border-red-900/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-28 h-28 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-xs sm:text-sm text-[#8e94a4] flex items-center gap-1.5 font-medium truncate">
              <DollarSign size={16} className="text-red-500 shrink-0" /> ยอดสุทธิ (หัก 3%)
            </span>
            <p className="text-2xl xs:text-3xl sm:text-4xl font-black text-red-500 mt-2 truncate">
              ฿{currentNet.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[0]}
              <span className="text-sm xs:text-base sm:text-lg font-bold opacity-80 ml-0.5">
                .{currentNet.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.')[1]}
              </span>
            </p>
            <p className="text-[10px] sm:text-xs text-[#8e94a4] mt-1 truncate">
              รวม ฿{currentGross.toLocaleString()} | ภาษี ฿{currentTax.toLocaleString()}
            </p>
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

          {isEditingTarget ? (
            <div className="flex gap-2 bg-[#0a0b0e] p-2 rounded-xl border border-[#262933]">
              <input 
                type="number" 
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="เป้าหมายเงินสุทธิ..."
                className="bg-transparent text-sm text-white min-w-0 flex-1 px-2 focus:outline-none font-mono"
                autoFocus
              />
              <button 
                onClick={saveTargetGoal}
                className="shrink-0 whitespace-nowrap bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
              >
                ตกลง
              </button>
            </div>
          ) : isTargetCollapsed ? (
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
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs text-[#8e94a4]">เป้าหมาย ({selectedWs}):</span>
                  <span className="text-sm sm:text-base font-black text-white ml-1.5">฿{monthlyTarget.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-red-400 font-bold">{targetPercent}%</span>
                  <span className="text-[10px] text-[#8e94a4] ml-1">สำเร็จแล้ว</span>
                </div>
              </div>

              <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#262933]">
                <div 
                  className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${targetPercent}%` }}
                />
              </div>

              <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3 grid grid-cols-2 gap-2 text-xs mt-2">
                <div>
                  <span className="text-[#8e94a4] block text-[11px]">นาทีที่ต้องทำเพิ่ม:</span>
                  <span className="font-mono font-bold text-white text-xs sm:text-sm truncate block">
                    {remainingMinsNeeded > 0 ? `${remainingMinsNeeded} นาที` : 'ครบแล้ว! 🎉'}
                  </span>
                  {remainingMoneyNeeded > 0 && (
                    <span className="text-[10px] text-red-400 block mt-0.5 truncate">(ยังขาดอีก ฿{remainingMoneyNeeded.toLocaleString()})</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[#8e94a4] text-[11px] truncate">ประมาณจำนวนเรื่อง:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSimMinutesInput('');
                        setSimCustomMoviesCount(null);
                        setIsSimModalOpen(true);
                      }}
                      className="text-[10px] bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded-md transition inline-flex items-center gap-1 shrink-0 font-medium"
                      title="จำลองคำนวณนาทีเรื่องถัดไป"
                    >
                      <Calculator size={10} className="shrink-0" />
                      <span>จำลอง</span>
                    </button>
                  </div>
                  {remainingMinsNeeded > 0 ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-white text-xs sm:text-sm truncate">
                        อีกประมาณ {remainingMoviesEst} เรื่อง
                      </span>
                      <div className="flex flex-col bg-[#12141a] border border-[#262933] rounded-md overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateTargetMovies(remainingMoviesEst + 1)}
                          className="px-1 py-0.2 hover:bg-[#262a36] text-[#8e94a4] hover:text-white transition leading-none"
                          title="เพิ่มจำนวนเรื่อง"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <button
                          type="button"
                          disabled={remainingMoviesEst <= 1}
                          onClick={() => handleUpdateTargetMovies(Math.max(1, remainingMoviesEst - 1))}
                          className="px-1 py-0.2 hover:bg-[#262a36] text-[#8e94a4] hover:text-white disabled:opacity-30 transition leading-none border-t border-[#262933]"
                          title="ลดจำนวนเรื่อง"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>
                      {customMoviesCount !== null && (
                        <button
                          type="button"
                          onClick={() => handleUpdateTargetMovies(null)}
                          className="p-0.5 text-[#6b7280] hover:text-red-400 transition shrink-0"
                          title="รีเซ็ตกลับเป็นค่าอัตโนมัติ"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-white text-xs sm:text-sm truncate block">
                      ครบแล้ว! 🎉
                    </span>
                  )}
                  {remainingMinsNeeded > 0 && (
                    <span className="text-[10px] text-[#6b7280] block mt-0.5 truncate">
                      (เฉลี่ยเรื่องละ ~{avgRemainingMinsPerMovie} นาที)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
              </div>
            </div>
          )}
        </section>

        {/* 3. ช่องโน้ต (ใช้เฉพาะปุ่มลูกศรขึ้น-ลง และบันทึกลำดับลง Supabase ให้ตรงกันทุกอุปกรณ์) */}
        <section className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 transition-all duration-300 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button 
              onClick={toggleNotesCollapse}
              className="min-w-0 text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wider hover:text-red-300 transition text-left"
            >
              <FileText size={15} className="shrink-0" /> 
              <span className="truncate">บันทึกข้อความ</span>
              <span className="text-[10px] bg-[#1c1f28] text-[#8e94a4] px-1.5 py-0.2 rounded border border-[#262933] font-mono shrink-0">
                {filteredNotes.length}
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={toggleNotesCollapse}
                className="p-1.5 text-[#8e94a4] hover:text-white rounded-lg bg-[#181a22] border border-[#262933] transition"
                title={isNotesCollapsed ? 'กางออก' : 'พับเก็บ'}
              >
                {isNotesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          {isNotesCollapsed && (
            <div className="pt-2 border-t border-[#1c1f28]">
              {filteredNotes.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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
                      <button 
                        key={n.id} 
                        onClick={() => setEditingNote(n)}
                        className="shrink-0 text-[11px] bg-[#181a22] hover:bg-[#262a36] text-[#8e94a4] hover:text-white px-2.5 py-1 rounded-xl border border-[#262933] transition"
                      >
                        {n.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#555a66]">(ไม่มีบันทึก)</p>
              )}
            </div>
          )}

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
                  placeholder="หัวข้อบันทึก (เว้นว่างได้)..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full sm:col-span-2 bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <textarea 
                  rows={2}
                  placeholder="รายละเอียด หรือวางข้อความยาว/โค้ด เช่น https://docs.google.com/..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none font-mono"
                />
                <button 
                  onClick={handleAddNote} 
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-xs transition shadow-md"
                >
                  เพิ่มโน้ต
                </button>
              </div>

              {filteredNotes.length > 0 && (
                <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
                  {filteredNotes.map((n, idx) => {
                    const isCopied = copiedNoteId === n.id;
                    return (
                      <div 
                        key={n.id} 
                        className="bg-[#181a22] hover:bg-[#1b1e28] border border-[#262933] p-2.5 rounded-xl flex items-start text-xs gap-2 transition group"
                      >
                        {/* ปุ่มเลื่อนขึ้น-ลง (เหลือเฉพาะลูกศร กดได้ทั้งในคอมและมือถือ) */}
                        <div className="flex flex-col items-center justify-center gap-0.5 pt-0.5 select-none shrink-0">
                          <button 
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); moveNotePosition(idx, 'up'); }}
                            className="p-1 hover:bg-[#262a36] hover:text-white disabled:opacity-20 text-[#8e94a4] rounded transition"
                            title="เลื่อนขึ้น"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button 
                            type="button"
                            disabled={idx === filteredNotes.length - 1}
                            onClick={(e) => { e.stopPropagation(); moveNotePosition(idx, 'down'); }}
                            className="p-1 hover:bg-[#262a36] hover:text-white disabled:opacity-20 text-[#8e94a4] rounded transition"
                            title="เลื่อนลง"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>

                        <div 
                          onClick={() => setEditingNote(n)}
                          className="space-y-1 min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-red-300 group-hover:text-red-200 transition truncate max-w-[200px]">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-[#6b7280] font-mono">{n.date}</span>
                          </div>
                          <div className="text-[#a6adbb] text-[12px] leading-relaxed break-words line-clamp-2 font-mono whitespace-pre-line">
                            {renderTextWithLinks(n.content)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button 
                            onClick={() => handleCopyNote(n.content, n.id)} 
                            className={`p-1.5 rounded-lg border transition ${
                              isCopied 
                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400' 
                                : 'bg-[#12141a] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border-[#262933]'
                            }`}
                            title="คัดลอกข้อความ"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <button 
                            onClick={() => setEditingNote(n)} 
                            className="p-1.5 bg-[#12141a] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border border-[#262933] rounded-lg transition" 
                            title="เปิดดู / แก้ไข"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteNote(n.id, n.title)} 
                            className="p-1.5 text-[#555a66] hover:text-red-400 transition" 
                            title="ลบบันทึก"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ======================= TAB 1: คิวงาน (Queue View) ======================= */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            
            <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-5 space-y-3.5">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <h2 className="text-xs font-bold text-red-400 tracking-wider uppercase">บันทึกงานใหม่</h2>
                <div className="flex bg-[#0a0b0e] p-0.5 rounded-lg border border-[#262933] text-[10px] sm:text-[11px]">
                  <button 
                    type="button"
                    onClick={() => setAddJobTargetStatus('pending')}
                    className={`px-2 py-0.5 rounded-md transition font-medium ${
                      addJobTargetStatus === 'pending' ? 'bg-red-600 text-white' : 'text-[#8e94a4] hover:text-white'
                    }`}
                  >
                    รอบปัจจุบัน
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAddJobTargetStatus('billed')}
                    className={`px-2 py-0.5 rounded-md transition font-medium ${
                      addJobTargetStatus === 'billed' ? 'bg-[#1c1f28] text-amber-400' : 'text-[#8e94a4] hover:text-white'
                    }`}
                    title="บันทึกเข้าตารางประวัติเก่าทันที ไม่นับรวมในคิวปัจจุบัน"
                  >
                    ประวัติเก่า (ปิดรอบแล้ว)
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#8e94a4] block mb-1">
                    1. ข้อมูลเรื่อง / รหัสด่วน (และลิงก์ Google Drive ถ้ามี)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="เช่น GS273_55_76 หรือวางพร้อมลิงก์ Drive เช่น GS273_55_76 https://drive.google.com/..."
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#8e94a4] block mb-1">
                    2. ข้อมูลวันที่ / แถวเดดไลน์ (หรือวางทั้งแถวจาก Sheet)
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="เช่น GS273 29-10-26 30-10-26 31-10-26 1-11-26 2-11-26 หรือใส่วันที่เดดไลน์"
                    value={sheetPaste}
                    onChange={(e) => setSheetPaste(e.target.value)}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddJob}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-sm transition shadow-lg shadow-red-950/50"
              >
                {addJobTargetStatus === 'pending' ? 'บันทึกงานลงรอบปัจจุบัน' : 'บันทึกเก็บเป็นประวัติที่ปิดรอบแล้ว'}
              </button>
            </div>

            {/* รายการคิวงาน */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-xs font-bold text-[#8e94a4] uppercase">
                    คิวงานปัจจุบัน ({currentCyclePendingJobs.length})
                  </span>
                  <span className="text-[10px] bg-red-950/40 text-red-400 border border-red-900/40 px-1.5 sm:px-2 py-0.5 rounded-md font-mono">
                    รองรับข้ามเดือน
                  </span>
                </div>
                <span className="text-[11px] text-red-400 font-semibold">งานพร้อมคิดเงิน</span>
              </div>

              {currentCyclePendingJobs.length === 0 ? (
                <div className="text-center py-12 text-[#555a66] text-xs bg-[#12141a]/50 rounded-2xl border border-dashed border-[#262933] space-y-1">
                  <p>{loading ? 'กำลังโหลดข้อมูลจาก Supabase...' : 'ไม่มีงานค้างในคิว'}</p>
                  {billedJobs.length > 0 && (
                    <p className="text-[11px] text-[#8e94a4]">
                      (มีงานที่ปิดรอบไปแล้ว {billedJobs.length} เรื่อง ดูได้ในแท็บ &quot;ตาราง&quot;)
                    </p>
                  )}
                </div>
              ) : (
                currentCyclePendingJobs.map((job) => {
                  const catCode = extractJobCategory(job.title);
                  const catStyle = getCategoryStyle(catCode);
                  const catFullName = categoryLabels[catCode];
                  const isCopied = copiedJobId === job.id;
                  const hasOnAir = Boolean(job.on_air_url);
                  return (
                    <div 
                      key={job.id} 
                      className={`rounded-2xl p-3 sm:p-4 transition border shadow-sm ${catStyle.card} ${!job.isIncludedInBilling && 'opacity-60'}`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <span 
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 tracking-wider ${catStyle.badge}`}
                            title={catFullName || catCode}
                          >
                            {catCode}
                          </span>

                          <span className="font-extrabold text-white text-base sm:text-lg tracking-wide truncate">
                            {job.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {hasOnAir ? (
                            <a
                              href={job.on_air_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border transition bg-emerald-950/60 border-emerald-500/60 text-emerald-400 hover:bg-emerald-900/50 inline-flex items-center justify-center"
                              title={`ออนแล้ว • เปิดหน้าเว็บ (${detectPlatformDisplay(job.on_air_url || '') || job.on_air_url})`}
                            >
                              <Tv size={13} />
                            </a>
                          ) : (
                            <button 
                              onClick={() => handleOpenOnAirModal(job)} 
                              className="p-1.5 rounded-lg border transition bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border-[#262933]"
                              title="เพิ่มลิงก์ออนแอร์"
                            >
                              <Tv size={13} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleCopyJob(job)} 
                            className={`p-1.5 rounded-lg border transition ${
                              isCopied 
                                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400' 
                                : 'bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white border-[#262933]'
                            }`}
                            title="คัดลอก (ชื่อ_ตอน_นาที)"
                          >
                            {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <button onClick={() => setEditingJob(job)} className="p-1.5 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] hover:text-white rounded-lg border border-[#262933] transition" title="แก้ไขงาน">
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => handleMarkJobAsBilled(job)} 
                            className="p-1.5 bg-[#1c1f28] hover:bg-amber-950/40 text-[#8e94a4] hover:text-amber-400 rounded-lg border border-[#262933] transition"
                            title="ย้ายไปตารางประวัติปิดรอบแล้ว"
                          >
                            <Archive size={13} />
                          </button>
                          <button onClick={() => handleDeleteJob(job.id, job.title)} className="p-1.5 text-[#555a66] hover:text-red-400 transition" title="ลบงาน">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 mt-2 pt-2 border-t border-[#1c1f28]/60 flex-wrap">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {job.episode && (
                            <span className="text-[11px] bg-[#1c1f28] text-[#a0a6b5] px-2 py-0.5 rounded-md border border-[#262933] font-medium shrink-0">
                              {job.episode} ตอน
                            </span>
                          )}

                          <span className="text-xs font-bold text-red-400 whitespace-nowrap">
                            {job.minutes} นาที <span className="text-[#8e94a4] font-normal">(฿{(job.minutes * 15).toLocaleString()})</span>
                          </span>

                          {job.drive_url && (
                            <a 
                              href={job.drive_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] bg-[#0e2a1b] hover:bg-[#133824] text-emerald-300 border border-emerald-600/40 px-2.5 py-0.5 rounded-lg transition font-medium shrink-0"
                            >
                              <FolderOpen size={12} className="text-emerald-400" /> Drive
                            </a>
                          )}
                        </div>

                        <button 
                          onClick={() => toggleJobBilling(job)}
                          title={job.isIncludedInBilling ? 'กำลังนับยอดรอบนี้อยู่ (กดเพื่อพักไว้รอบหน้า)' : 'พักไว้รอบหน้าอยู่ (กดเพื่อนับยอดรอบนี้)'}
                          className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-xl border font-semibold whitespace-nowrap transition shrink-0 ${
                            job.isIncludedInBilling 
                              ? 'border-red-500/50 text-red-400 bg-red-950/40 hover:bg-red-950/60' 
                              : 'border-[#262933] text-[#8e94a4] bg-[#181a22] hover:bg-[#262a36]'
                          }`}
                        >
                          {job.isIncludedInBilling ? 'นับยอดรอบนี้' : 'พักไว้รอบหน้า'}
                        </button>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-[#262933]">
                        <div className="grid grid-cols-5 text-center text-[9px] sm:text-[10px] uppercase font-bold text-[#6b7280] pb-1">
                          <div>เกลา</div>
                          <div>พากย์</div>
                          <div className="text-red-400 font-extrabold">มิกซ์</div>
                          <div>ซับ</div>
                          <div className="text-amber-400 font-extrabold">เดดไลน์</div>
                        </div>
                        <div className="grid grid-cols-5 text-center text-[10px] sm:text-xs font-mono bg-[#0a0b0e]/90 rounded-xl py-1.5 border border-[#262933]">
                          <div className="text-[#8e94a4] truncate">{formatToDisplayDate(job.date_glao)}</div>
                          <div className="text-[#8e94a4] truncate">{formatToDisplayDate(job.date_pak)}</div>
                          <div className="text-red-200 font-bold bg-red-950/70 border border-red-500/60 rounded-lg mx-0.5 py-0.5 truncate">
                            {formatToDisplayDate(job.date_mix)}
                          </div>
                          <div className="text-[#8e94a4] truncate">{formatToDisplayDate(job.date_sub || '')}</div>
                          <div className="text-amber-300 font-bold truncate">{formatToDisplayDate(job.date_deadline)}</div>
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
                      <div className={`z-10 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[11px] sm:text-xs font-bold transition ${
                        isMixDay ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/60 ring-2 ring-red-400 scale-105' : 
                        isDeadlineDay ? 'border-2 border-amber-400 text-amber-300 font-bold bg-[#181a22]' : 
                        isSelected ? 'border-2 border-white text-white' : 
                        isInRange ? 'text-red-200 font-bold' : 'text-[#8e94a4] hover:text-white'
                      }`}>
                        {dayNum}
                      </div>
                    </div>

                    {mixJobsToday.length > 0 ? (
                      <span className="text-[8px] sm:text-[9px] text-red-400 font-black leading-none mt-0.5 truncate max-w-[40px] sm:max-w-[48px]">
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

        {/* ======================= TAB 3: ตาราง ======================= */}
        {activeTab === 'table' && (
          <div className="space-y-4">
            
            <div className="flex bg-[#12141a] p-1.5 rounded-2xl border border-[#262933] gap-1">
              <button 
                onClick={() => setTableSubView('current')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'current' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <TableIcon size={14} /> งานรอบนี้ ({currentCyclePendingJobs.length})
              </button>
              <button 
                onClick={() => setTableSubView('billed')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'billed' ? 'bg-[#1c1f28] text-amber-400 border border-amber-500/40 shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <Archive size={14} /> ปิดรอบแล้ว ({billedJobs.length})
              </button>
              <button 
                onClick={() => setTableSubView('analytics')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tableSubView === 'analytics' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                <BarChart3 size={14} /> สถิติ
              </button>
            </div>

            {(tableSubView === 'current' || tableSubView === 'billed') && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e94a4]" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อเรื่อง รหัสค่าย หรือ ตอน..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="w-full bg-[#12141a] border border-[#262933] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-[#555a66] focus:border-red-500 focus:outline-none"
                  />
                  {tableSearchQuery && (
                    <button 
                      onClick={() => setTableSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e94a4] hover:text-white p-1"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* ตัวกรองรหัสประเภทเรื่อง + สถานะออนแอร์ (เรียงติดกันไม่มีเส้นคั่น) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => {
                      setTableCategoryFilter('ALL');
                      setTableOnAirFilter('all');
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition shrink-0 ${
                      tableCategoryFilter === 'ALL' && tableOnAirFilter === 'all'
                        ? 'bg-[#1c1f28] text-white border-white/25'
                        : 'bg-[#12141a] text-[#8e94a4] border-[#262933] hover:text-white'
                    }`}
                  >
                    ทั้งหมด ({(tableSubView === 'billed' ? billedJobs : currentCyclePendingJobs).length})
                  </button>

                  {(['GS', 'DW'] as const).map(code => {
                    const style = getCategoryStyle(code);
                    const isActive = tableCategoryFilter === code;
                    const count = (tableSubView === 'billed' ? billedJobs : currentCyclePendingJobs).filter(
                      j => extractJobCategory(j.title) === code
                    ).length;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setTableCategoryFilter(isActive ? 'ALL' : code)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition shrink-0 ${
                          isActive
                            ? style.badge
                            : 'bg-[#12141a] text-[#8e94a4] border-[#262933] hover:text-white'
                        }`}
                        title={categoryLabels[code] || code}
                      >
                        {code} ({count})
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setTableOnAirFilter(tableOnAirFilter === 'on_air' ? 'all' : 'on_air')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition inline-flex items-center gap-1 shrink-0 ${
                      tableOnAirFilter === 'on_air'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#12141a] text-[#8e94a4] border-[#262933] hover:text-emerald-300'
                    }`}
                  >
                    <Tv size={11} />
                    <span>ออนแล้ว ({tableOnAirCounts.onAir})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableOnAirFilter(tableOnAirFilter === 'not_on_air' ? 'all' : 'not_on_air')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition shrink-0 ${
                      tableOnAirFilter === 'not_on_air'
                        ? 'bg-[#1c1f28] text-amber-300 border-amber-500/40'
                        : 'bg-[#12141a] text-[#8e94a4] border-[#262933] hover:text-white'
                    }`}
                  >
                    ยังไม่ออน ({tableOnAirCounts.notOnAir})
                  </button>
                </div>
              </div>
            )}

            {tableSubView === 'current' && (
              <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3.5">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider truncate">
                      งานในรอบนี้ ({searchedCurrentJobs.length} เรื่อง)
                    </h3>
                  </div>
                  <button 
                    onClick={handleCopyAllJobs}
                    className="text-xs bg-[#1c1f28] hover:bg-[#262a36] text-white font-bold px-3 py-1.5 rounded-xl border border-[#262933] transition flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
                    title="คัดลอกสรุป ชื่อ_ตอน_นาที พร้อมยอดรวม"
                  >
                    <Copy size={13} className="text-red-400" />
                    <span>คัดลอกสรุปทั้งหมด</span>
                  </button>
                </div>

                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[#262933] text-red-400 font-bold bg-[#181a22] whitespace-nowrap">
                        <th className="py-2.5 px-2 text-center w-12">รหัส</th>
                        <th className="py-2.5 pl-2 pr-1 text-left w-36 whitespace-nowrap">ชื่อเรื่อง</th>
                        <th className="py-2.5 pl-1 pr-2 text-center w-14">ตอน</th>
                        <th className="py-2.5 px-2 text-center w-16">นาที</th>
                        <th className="py-2.5 px-2 text-center w-12">Drive</th>
                        <th className="py-2.5 px-2.5 text-center w-20">เกลา</th>
                        <th className="py-2.5 px-2.5 text-center w-20">พากย์</th>
                        <th className="py-2.5 px-2.5 text-center w-24 text-white bg-red-950/70 border-x border-red-500/30 font-black">มิกซ์</th>
                        <th className="py-2.5 px-2.5 text-center w-20">ซับ</th>
                        <th className="py-2.5 px-2.5 text-center w-24 text-amber-400 font-bold">เดดไลน์</th>
                        <th className="py-2.5 px-3 text-center w-32">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1f28]/60">
                      {searchedCurrentJobs.map((j, idx) => {
                        const catCode = extractJobCategory(j.title);
                        const catStyle = getCategoryStyle(catCode);
                        const isCopied = copiedJobId === j.id;
                        const hasOnAir = Boolean(j.on_air_url);
                        const rowBg = idx % 2 === 0 ? catStyle.rowEven : catStyle.rowOdd;

                        return (
                          <tr key={j.id} className={`${rowBg} transition`}>
                            <td className="py-2.5 px-2 text-center">
                              <span 
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${catStyle.badge}`}
                                title={categoryLabels[catCode] || catCode}
                              >
                                {catCode}
                              </span>
                            </td>
                            <td className="py-2.5 pl-2 pr-1 font-bold text-white whitespace-nowrap w-36">
                              {j.title}
                            </td>
                            <td className="py-2.5 pl-1 pr-2 text-center whitespace-nowrap w-14">
                              {j.episode ? (
                                <span className="text-[11px] bg-[#1c1f28] text-[#a0a6b5] px-2 py-0.5 rounded-md font-mono border border-[#262933]">
                                  {j.episode}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-red-400 font-mono font-bold whitespace-nowrap">
                              {j.minutes}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {j.drive_url ? (
                                <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-white inline-flex items-center justify-center p-1">
                                  <FolderOpen size={13} />
                                </a>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_glao)}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_pak)}
                            </td>
                            <td className="py-2.5 px-2.5 text-center font-bold text-white bg-red-950/50 border-x border-red-500/20 font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_mix)}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_sub || '')}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-amber-300 font-mono font-bold whitespace-nowrap">
                              {formatToDisplayDate(j.date_deadline)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {hasOnAir ? (
                                  <a
                                    href={j.on_air_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded transition text-emerald-400 hover:text-emerald-300 inline-flex items-center justify-center"
                                    title={`ออนแล้ว • เปิดหน้าเว็บ (${detectPlatformDisplay(j.on_air_url || '') || j.on_air_url})`}
                                  >
                                    <Tv size={13} />
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => handleOpenOnAirModal(j)} 
                                    className="p-1 rounded transition text-[#8e94a4] hover:text-white" 
                                    title="เพิ่มลิงก์ออนแอร์"
                                  >
                                    <Tv size={13} />
                                  </button>
                                )}
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
                                <button onClick={() => handleMarkJobAsBilled(j)} className="text-[#8e94a4] hover:text-amber-400 p-1" title="ย้ายไปปิดรอบแล้ว">
                                  <Archive size={13} />
                                </button>
                                <button onClick={() => handleDeleteJob(j.id, jobTitle(j.title))} className="text-[#555a66] hover:text-red-400 p-1" title="ลบงาน">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {searchedCurrentJobs.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-6 text-center text-[#555a66]">
                            {tableSearchQuery || tableOnAirFilter !== 'all' || tableCategoryFilter !== 'ALL' ? 'ไม่พบงานที่ตรงกับเงื่อนไข' : 'ไม่มีงานค้างในรอบนี้'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tableSubView === 'billed' && (
              <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-4 space-y-3.5">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Archive size={14} /> งานที่ปิดรอบแล้ว ({searchedBilledJobs.length} เรื่อง)
                    </h3>
                    <p className="text-[11px] text-[#8e94a4] mt-0.5">
                      รายการประวัติที่คิดเงินแล้ว ไม่ถูกนำมาคิดรวมในรอบปัจจุบัน
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse min-w-[540px]">
                    <thead>
                      <tr className="border-b border-[#262933] text-amber-400 font-bold bg-[#181a22] whitespace-nowrap">
                        <th className="py-2.5 px-2 text-center w-12">รหัส</th>
                        <th className="py-2.5 pl-2 pr-1 text-left w-28 whitespace-nowrap">ชื่อเรื่อง</th>
                        <th className="py-2.5 pl-1 pr-2 text-center w-12">ตอน</th>
                        <th className="py-2.5 px-2 text-center w-16">นาที</th>
                        <th className="py-2.5 px-2 text-center w-12">Drive</th>
                        <th className="py-2.5 px-2.5 text-center w-24">วันมิกซ์</th>
                        <th className="py-2.5 px-2.5 text-center w-24">เดดไลน์</th>
                        <th className="py-2.5 px-3 text-center w-36">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1f28]/60">
                      {searchedBilledJobs.map((j) => {
                        const catCode = extractJobCategory(j.title);
                        const catStyle = getCategoryStyle(catCode);
                        const isCopied = copiedJobId === j.id;
                        const hasOnAir = Boolean(j.on_air_url);
                        return (
                          <tr key={j.id} className="hover:bg-[#181a22]/60 transition opacity-85 hover:opacity-100">
                            <td className="py-2.5 px-2 text-center">
                              <span 
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${catStyle.badge}`}
                                title={categoryLabels[catCode] || catCode}
                              >
                                {catCode}
                              </span>
                            </td>
                            <td className="py-2.5 pl-2 pr-1 font-bold text-white whitespace-nowrap w-28">
                              {j.title}
                            </td>
                            <td className="py-2.5 pl-1 pr-2 text-center whitespace-nowrap w-12">
                              {j.episode ? (
                                <span className="text-[11px] bg-[#1c1f28] text-[#a0a6b5] px-2 py-0.5 rounded-md font-mono border border-[#262933]">
                                  {j.episode}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-center text-amber-400 font-mono font-bold whitespace-nowrap">
                              {j.minutes}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {j.drive_url ? (
                                <a href={j.drive_url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-white inline-flex items-center justify-center p-1">
                                  <FolderOpen size={13} />
                                </a>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_mix)}
                            </td>
                            <td className="py-2.5 px-2.5 text-center text-[#8e94a4] font-mono whitespace-nowrap">
                              {formatToDisplayDate(j.date_deadline)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {hasOnAir ? (
                                  <a
                                    href={j.on_air_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded transition text-emerald-400 hover:text-emerald-300 inline-flex items-center justify-center"
                                    title={`ออนแล้ว • เปิดหน้าเว็บ (${detectPlatformDisplay(j.on_air_url || '') || j.on_air_url})`}
                                  >
                                    <Tv size={13} />
                                  </a>
                                ) : (
                                  <button 
                                    onClick={() => handleOpenOnAirModal(j)} 
                                    className="p-1 rounded transition text-[#8e94a4] hover:text-white" 
                                    title="เพิ่มลิงก์ออนแอร์"
                                  >
                                    <Tv size={13} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleCopyJob(j)} 
                                  className={`p-1 rounded transition ${
                                    isCopied ? 'text-emerald-400' : 'text-[#8e94a4] hover:text-white'
                                  }`} 
                                  title="คัดลอก (ชื่อ_ตอน_นาที)"
                                >
                                  {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                                <button 
                                  onClick={() => handleReopenJob(j)} 
                                  className="text-[11px] bg-[#1c1f28] hover:bg-[#262a36] text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg transition inline-flex items-center gap-1"
                                  title="นำกลับมาในคิวรอบปัจจุบันเพื่อคำนวณเงินใหม่"
                                >
                                  <ArrowUpRight size={12} />
                                  <span>ดึงกลับมารอบนี้</span>
                                </button>
                                <button onClick={() => handleDeleteJob(j.id, j.title)} className="text-[#555a66] hover:text-red-400 p-1" title="ลบงาน">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {searchedBilledJobs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-[#555a66]">
                            {tableSearchQuery || tableOnAirFilter !== 'all' || tableCategoryFilter !== 'ALL' ? 'ไม่พบงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีงานที่ปิดรอบ'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tableSubView === 'analytics' && (
              <div className="space-y-3 sm:space-y-4">
                {/* 1. ภาพรวมรายได้และผลงานสะสมทั้งหมด */}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="bg-[#12141a] border border-red-900/40 rounded-2xl p-3.5 sm:p-4 space-y-1.5 min-w-0">
                    <span className="text-[11px] sm:text-xs text-[#8e94a4] flex items-center gap-1.5 min-w-0">
                      <DollarSign size={14} className="text-red-400 shrink-0" />
                      <span className="truncate">รายได้สุทธิสะสม (หัก 3%)</span>
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-red-500 font-mono truncate">
                      ฿{Math.round(analyticsData.totalAllNet).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-[#8e94a4] truncate">
                      รวม {analyticsData.totalAllMins.toLocaleString()} นาที ({analyticsData.totalJobsCount} เรื่อง)
                    </p>
                  </div>

                  <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 space-y-1.5 min-w-0">
                    <span className="text-[11px] sm:text-xs text-[#8e94a4] flex items-center gap-1.5 min-w-0">
                      <Clock size={14} className="text-cyan-400 shrink-0" />
                      <span className="truncate">ค่าเฉลี่ยต่อ 1 เรื่อง</span>
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-white font-mono truncate">
                      ~{analyticsData.avgMinsPerJob} <span className="text-xs sm:text-sm font-normal text-[#8e94a4]">นาที</span>
                    </p>
                    <p className="text-[11px] text-emerald-400 font-semibold truncate">
                      เฉลี่ย ~฿{analyticsData.avgNetPerJob.toLocaleString()}/เรื่อง
                    </p>
                  </div>
                </div>

                {/* 2. สรุปสถิติเด่น (ประเภทหลัก / ออนแอร์) */}
                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp size={15} className="shrink-0" />
                    <span>ภาพรวมการทำงานของทีม</span>
                  </h4>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                    <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3 min-w-0">
                      <span className="text-[11px] text-[#8e94a4] block">ค่ายหลัก:</span>
                      <p className="text-sm sm:text-base font-black text-white mt-1 truncate">{analyticsData.mostWorkedType}</p>
                    </div>
                    <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3 min-w-0">
                      <span className="text-[11px] text-[#8e94a4] block">ออนแอร์แล้ว:</span>
                      <p className="text-sm sm:text-base font-black text-emerald-400 mt-1 font-mono truncate">
                        {analyticsData.totalOnAirCount}/{analyticsData.totalJobsCount} <span className="text-xs font-normal">({analyticsData.onAirPercent}%)</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. สถิติรายเดือนเทียบเป้าหมาย */}
                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers size={14} className="text-red-400 shrink-0" />
                      <span>ยอดสุทธิรายเดือน</span>
                    </span>
                    <span className="text-[11px] text-[#8e94a4] font-mono">
                      เทียบเป้า ฿{monthlyTarget.toLocaleString()}
                    </span>
                  </div>
                  {analyticsData.monthlyTrend.length > 0 ? (
                    <div className="space-y-2.5">
                      {analyticsData.monthlyTrend.map(m => {
                        const pctBar = Math.min(100, Math.round((m.netIncome / analyticsData.maxMonthNet) * 100));
                        const hitTarget = m.netIncome >= monthlyTarget && monthlyTarget > 0;
                        return (
                          <div key={m.key} className="space-y-1">
                            <div className="flex justify-between items-center gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                <span className="font-bold text-white font-mono shrink-0">{m.label}</span>
                                <span className="text-[10px] sm:text-[11px] text-[#8e94a4] truncate">({m.count} เรื่อง • {m.mins} น.)</span>
                                {hitTarget && (
                                  <span className="text-[9px] bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold shrink-0">
                                    ถึงเป้า
                                  </span>
                                )}
                              </div>
                              <span className={`font-mono font-bold shrink-0 ${hitTarget ? 'text-emerald-400' : 'text-red-400'}`}>
                                ฿{Math.round(m.netIncome).toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full bg-[#1c1f28] h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  hitTarget ? 'bg-emerald-500' : 'bg-gradient-to-r from-red-700 to-red-500'
                                }`}
                                style={{ width: `${pctBar}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ไม่มีข้อมูลรายเดือน</p>
                  )}
                </div>

                {/* 4. สัดส่วนนาทีและรายได้ตามประเภทค่าย */}
                <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-1.5">
                    <span className="text-xs font-bold text-white">สัดส่วนผลงานแยกตามรหัสค่าย</span>
                    <span className="text-[11px] text-[#8e94a4] font-mono">
                      รวม {analyticsData.totalAllMins.toLocaleString()} นาที
                    </span>
                  </div>
                  {analyticsData.totalAllMins > 0 ? (
                    <div className="space-y-2.5">
                      <div className="w-full bg-[#1c1f28] h-3.5 rounded-full overflow-hidden flex">
                        {analyticsData.categoryBreakdown.map(item => {
                          const style = getCategoryStyle(item.code);
                          const pct = (item.mins / analyticsData.totalAllMins) * 100;
                          return (
                            <div
                              key={item.code}
                              className={`${style.bar} transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                              title={`${item.code}: ${item.mins} นาที (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {analyticsData.categoryBreakdown.map(item => {
                          const style = getCategoryStyle(item.code);
                          const fullLabel = categoryLabels[item.code];
                          const pct = Math.round((item.mins / analyticsData.totalAllMins) * 100);
                          const avgCatMins = item.count > 0 ? Math.round(item.mins / item.count) : 0;
                          return (
                            <div
                              key={item.code}
                              className="bg-[#181a22] border border-[#262933] rounded-xl p-3 space-y-1.5 text-xs min-w-0"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0 ${style.badge}`}>
                                    {item.code}
                                  </span>
                                  <span className="text-white font-bold truncate">
                                    {fullLabel || item.code}
                                  </span>
                                </div>
                                <span className={`font-mono font-bold shrink-0 ${style.text}`}>
                                  {pct}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2 text-[11px] text-[#8e94a4] font-mono pt-1.5 border-t border-[#262933]/70">
                                <span className="truncate">{item.mins} น. ({item.count} เรื่อง)</span>
                                <span className="text-white font-semibold shrink-0">฿{Math.round(item.netIncome).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2 text-[10px] text-[#6b7280]">
                                <span className="truncate">เฉลี่ย ~{avgCatMins} น./เรื่อง</span>
                                <span className="text-emerald-400/90 shrink-0">ออนแล้ว {item.onAirCount}/{item.count}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555a66]">ไม่มีข้อมูล</p>
                  )}
                </div>

                {/* 5. การกระจายงานตามช่วงวันที่ในเดือน */}
                {analyticsData.maxPeriodMins > 0 && (
                  <div className="bg-[#12141a] border border-[#262933] rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                    <span className="text-xs font-bold text-white block">ปริมาณงานตามช่วงวันที่ (วันมิกซ์)</span>
                    {[
                      { label: 'ต้นเดือน (วันที่ 1–10)', mins: analyticsData.periodEarly, count: analyticsData.periodEarlyCount },
                      { label: 'กลางเดือน (วันที่ 11–20)', mins: analyticsData.periodMid, count: analyticsData.periodMidCount },
                      { label: 'ปลายเดือน (วันที่ 21–31)', mins: analyticsData.periodLate, count: analyticsData.periodLateCount }
                    ].map(p => {
                      const pct = Math.round((p.mins / analyticsData.maxPeriodMins) * 100);
                      const isPeak = p.mins === analyticsData.maxPeriodMins && p.mins > 0;
                      return (
                        <div key={p.label} className="space-y-1 text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <span className={`truncate ${isPeak ? 'text-amber-300 font-bold' : 'text-[#a6adbb]'}`}>{p.label}</span>
                            <span className="font-mono text-white font-semibold shrink-0">
                              {p.mins} นาที <span className="text-[10px] text-[#8e94a4]">({p.count} เรื่อง)</span>
                            </span>
                          </div>
                          <div className="w-full bg-[#1c1f28] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isPeak ? 'bg-amber-400' : 'bg-red-500/70'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  รวม {activeBilledJobs.length} เรื่องในรอบนี้
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
                  <span>รวมนาทีรอบนี้:</span>
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

      {/* On-Air URL Modal: เพิ่มลิงก์ออนแอร์ของเรื่อง */}
      {onAirModalJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-emerald-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262933] pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Tv size={15} className="text-emerald-400" />
                <span>ลิงก์ออนแอร์ • {onAirModalJob.title}</span>
              </h4>
              <button onClick={() => setOnAirModalJob(null)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>

            {onAirModalJob.on_air_url && (
              <a
                href={onAirModalJob.on_air_url}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-500/50 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={14} className="text-emerald-400 shrink-0" />
                <span>เปิดหน้าเว็บออนแอร์{detectKnownPlatform(onAirModalJob.on_air_url) ? ` (${detectKnownPlatform(onAirModalJob.on_air_url)})` : ''}</span>
              </a>
            )}

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#8e94a4]">วางลิงก์หน้าเว็บของเรื่องนี้:</label>
                  {onAirUrlInput.trim() && detectPlatformDisplay(onAirUrlInput.trim()) && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                      {detectPlatformDisplay(onAirUrlInput.trim())}
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  value={onAirUrlInput}
                  onChange={(e) => setOnAirUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#0a0b0e] border border-[#262933] focus:border-emerald-500 focus:outline-none rounded-xl p-2.5 text-white font-mono"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveOnAirUrl();
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {onAirModalJob.on_air_url && (
                <button
                  type="button"
                  onClick={async () => {
                    setOnAirUrlInput('');
                    await supabase
                      .from('jobs')
                      .update({ on_air_url: '' })
                      .eq('id', onAirModalJob.id);
                    setJobs(prev =>
                      prev.map(j => (j.id === onAirModalJob.id ? { ...j, on_air_url: '' } : j))
                    );
                    setOnAirModalJob(null);
                  }}
                  className="px-3 py-2 bg-[#1c1f28] hover:bg-red-950/50 text-[#8e94a4] hover:text-red-400 border border-[#262933] rounded-xl text-xs font-bold transition"
                  title="ลบลิงก์ออนแอร์"
                >
                  ลบลิงก์
                </button>
              )}
              <button
                type="button"
                onClick={() => setOnAirModalJob(null)}
                className="flex-1 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] font-bold py-2 rounded-xl text-xs transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveOnAirUrl}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs transition shadow-md"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal: จัดการรหัสประเภทเรื่อง / ค่าย */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/40 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#262933] pb-2 shrink-0">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Tag size={15} className="text-red-500" />
                <span>รหัสประเภทเรื่อง / ค่าย ({selectedWs})</span>
              </h4>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <p className="text-[11px] text-[#8e94a4] leading-relaxed">
                ระบบจะดึงตัวอักษรหน้าชื่อเรื่อง (เช่น <span className="text-white font-mono">DW</span>, <span className="text-white font-mono">GS</span>, <span className="text-white font-mono">RD</span>) มาสร้างป้ายอัตโนมัติ คุณสามารถกำหนดชื่อเต็มของแต่ละรหัสได้ที่นี่:
              </p>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="รหัส (เช่น RD)"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                  className="w-24 bg-[#0a0b0e] border border-[#262933] rounded-xl px-2.5 py-2 text-xs text-white font-mono uppercase focus:border-red-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="ชื่อเต็ม (เช่น ReelShort)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 min-w-0 bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategoryItem();
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategoryItem}
                  className="shrink-0 bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-2 rounded-xl text-xs transition"
                >
                  เพิ่ม
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {Object.entries(categoryLabels).map(([code, label]) => {
                  const style = getCategoryStyle(code);
                  return (
                    <div
                      key={code}
                      className="bg-[#181a22] border border-[#262933] rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border shrink-0 ${style.badge}`}>
                          {code}
                        </span>
                        <span className="text-white font-bold truncate">{label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategoryItem(code)}
                        className="text-[#555a66] hover:text-red-400 p-1 transition shrink-0"
                        title="ลบรหัสนี้"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
                {Object.keys(categoryLabels).length === 0 && (
                  <p className="text-center text-[#555a66] py-3">ยังไม่มีรายการกำหนดชื่อค่าย</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="w-full bg-[#1c1f28] hover:bg-[#262a36] text-white font-bold py-2.5 rounded-xl text-xs transition border border-[#262933] shrink-0"
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}

      {/* Edit Job Modal: ช่องใส่วันที่แบบไว (วางทั้งแถวจาก Sheet) + แสดงผล 5 ขั้นตอน + พับเก็บช่องเลือกแบบละเอียด */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
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

              <div>
                <label className="text-[#8e94a4] block mb-1">ลิงก์ออนแอร์ (ลบออกเพื่อยกเลิกสถานะออนแล้ว)</label>
                <input 
                  type="text" 
                  value={editingJob.on_air_url || ''}
                  onChange={(e) => setEditingJob({ ...editingJob, on_air_url: e.target.value })}
                  placeholder="https://..."
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

              {/* ช่องใส่วันที่แบบไว (วางทั้งแถวเหมือนตอนกรอกแรก) + แสดงตาราง 5 ขั้นตอน */}
              <div className="pt-2 border-t border-[#262933] space-y-2">
                <label className="text-xs text-[#8e94a4] block font-medium">
                  ข้อมูลวันที่ / แถวเดดไลน์ (วางทั้งแถวจาก Sheet ได้ทันที):
                </label>
                <textarea 
                  rows={2}
                  placeholder="เช่น 29-10-26 30-10-26 31-10-26 1-11-26 2-11-26 หรือวางทั้งแถวจาก Sheet"
                  onChange={(e) => {
                    const val = e.target.value;
                    const tokens = val
                      .replace(/(https?:\/\/[^\s]+)/g, '')
                      .split(/\t+|\s+/)
                      .map(t => t.trim())
                      .filter(Boolean);

                    const foundDates: string[] = [];
                    for (const tok of tokens) {
                      if (isDateLike(tok)) {
                        foundDates.push(cleanDateToStandard(tok));
                      }
                    }

                    if (foundDates.length === 0) return;

                    let date_glao = '';
                    let date_pak = '';
                    let date_mix = '';
                    let date_sub = '';
                    let date_deadline = '';

                    if (foundDates.length >= 5) {
                      date_glao = foundDates[0];
                      date_pak = foundDates[1];
                      date_mix = foundDates[2];
                      date_sub = foundDates[3];
                      date_deadline = foundDates[4];
                    } else if (foundDates.length === 4) {
                      date_glao = foundDates[0];
                      date_pak = foundDates[1];
                      date_mix = foundDates[2];
                      date_deadline = foundDates[3];
                    } else if (foundDates.length === 3) {
                      date_pak = foundDates[0];
                      date_mix = foundDates[1];
                      date_deadline = foundDates[2];
                    } else if (foundDates.length === 2) {
                      date_mix = foundDates[0];
                      date_deadline = foundDates[1];
                    } else if (foundDates.length === 1) {
                      date_deadline = foundDates[0];
                      date_mix = foundDates[0];
                    }

                    setEditingJob(prev => prev ? ({
                      ...prev,
                      date_glao,
                      date_pak,
                      date_mix,
                      date_sub,
                      date_deadline
                    }) : null);
                  }}
                  className="w-full bg-[#0a0b0e] border border-red-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-[#454954] focus:border-red-500 focus:outline-none font-mono"
                />

                {/* แสดงสถานะวันที่ทั้ง 5 ขั้นตอนแบบเดียวกับคิวงานหลัก */}
                <div className="pt-1">
                  <div className="grid grid-cols-5 text-center text-[9px] uppercase font-bold text-[#6b7280] pb-1">
                    <div>เกลา</div>
                    <div>พากย์</div>
                    <div className="text-red-400 font-extrabold">มิกซ์</div>
                    <div>ซับ</div>
                    <div className="text-amber-400 font-extrabold">เดดไลน์</div>
                  </div>
                  <div className="grid grid-cols-5 text-center text-[10px] font-mono bg-[#0a0b0e] rounded-xl py-1.5 border border-[#262933]">
                    <div className="text-[#8e94a4] truncate px-0.5">{formatToDisplayDate(editingJob.date_glao || '')}</div>
                    <div className="text-[#8e94a4] truncate px-0.5">{formatToDisplayDate(editingJob.date_pak || '')}</div>
                    <div className="text-red-200 font-bold bg-red-950/70 border border-red-500/60 rounded mx-0.5 py-0.5 truncate px-0.5">
                      {formatToDisplayDate(editingJob.date_mix || '')}
                    </div>
                    <div className="text-[#8e94a4] truncate px-0.5">{formatToDisplayDate(editingJob.date_sub || '')}</div>
                    <div className="text-amber-300 font-bold truncate px-0.5">{formatToDisplayDate(editingJob.date_deadline || '')}</div>
                  </div>
                </div>

                {/* พับเก็บช่องเลือกปฏิทินแบบละเอียดไว้ เผื่อต้องการแก้เฉพาะวันใดวันหนึ่ง */}
                <details className="text-[11px] text-[#8e94a4] pt-1">
                  <summary className="cursor-pointer hover:text-white transition select-none py-1 inline-flex items-center gap-1.5">
                    <Settings size={13} className="shrink-0 text-[#8e94a4]" />
                    <span>ปรับแก้วันที่เฉพาะช่อง (คลิกเพื่อกางออก)</span>
                  </summary>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-[#8e94a4] block mb-1">วันเกลา</label>
                      <input 
                        type="date" 
                        value={editingJob.date_glao || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, date_glao: e.target.value })}
                        className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[#8e94a4] block mb-1">วันพากย์</label>
                      <input 
                        type="date" 
                        value={editingJob.date_pak || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, date_pak: e.target.value })}
                        className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-red-400 font-bold block mb-1">วันมิกซ์</label>
                      <input 
                        type="date" 
                        value={editingJob.date_mix || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, date_mix: e.target.value })}
                        className="w-full bg-[#0a0b0e] border border-red-500/50 rounded-lg p-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[#8e94a4] block mb-1">วันซับ</label>
                      <input 
                        type="date" 
                        value={editingJob.date_sub || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, date_sub: e.target.value })}
                        className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-amber-400 font-bold block mb-1">วันเดดไลน์ส่ง</label>
                      <input 
                        type="date" 
                        value={editingJob.date_deadline || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, date_deadline: e.target.value })}
                        className="w-full bg-[#0a0b0e] border border-amber-500/40 rounded-lg p-2 text-white"
                      />
                    </div>
                  </div>
                </details>
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

      {/* Note Detail & Edit Modal: เปิดดูข้อความเต็ม คัดลอก แก้ไข หรือลบ */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#12141a] border border-red-500/50 rounded-2xl p-5 max-w-lg w-full space-y-3.5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#262933] pb-2 shrink-0">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileText size={15} className="text-red-500" />
                <span>รายละเอียดบันทึก</span>
              </h4>
              <button onClick={() => setEditingNote(null)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[#8e94a4] block mb-1">วันที่</label>
                  <input 
                    type="date" 
                    value={editingNote.date || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, date: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[#8e94a4] block mb-1">หัวข้อ</label>
                  <input 
                    type="text" 
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full bg-[#0a0b0e] border border-[#262933] rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#8e94a4] block">ข้อความทั้งหมด:</label>
                  <button 
                    onClick={() => handleCopyNote(editingNote.content, 'modal-view')}
                    className="text-[11px] text-red-400 hover:text-red-300 inline-flex items-center gap-1 font-bold"
                  >
                    {copiedNoteId === 'modal-view' ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">คัดลอกสำเร็จ!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>คัดลอกทั้งหมด</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  rows={9}
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl p-3 text-xs text-white placeholder-[#555a66] font-mono leading-relaxed focus:border-red-500 focus:outline-none"
                  placeholder="พิมพ์หรือแก้ไขข้อความที่นี่..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#262933] shrink-0">
              <button 
                onClick={() => {
                  const target = editingNote;
                  setEditingNote(null);
                  handleDeleteNote(target.id, target.title);
                }} 
                className="p-2.5 bg-[#1c1f28] hover:bg-red-950/50 text-[#8e94a4] hover:text-red-400 border border-[#262933] rounded-xl transition"
                title="ลบบันทึกนี้"
              >
                <Trash2 size={15} />
              </button>
              <button 
                onClick={() => setEditingNote(null)} 
                className="flex-1 bg-[#1c1f28] hover:bg-[#262a36] text-[#8e94a4] font-bold py-2.5 rounded-xl text-xs transition"
              >
                ปิด
              </button>
              <button 
                onClick={handleSaveEditNote} 
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Modal: จำลองนาทีเรื่องถัดไป (ชั่วคราว ไม่บันทึกข้อมูล) */}
      {isSimModalOpen && (() => {
        const simMins = Math.max(0, parseFloat(simMinutesInput) || 0);
        const simAddedNet = simMins * netRatePerMin;
        const simNewTotalMins = currentTotalMins + simMins;
        const simNewNet = currentNet + simAddedNet;
        const simNewPercent = monthlyTarget > 0
          ? Math.min(100, Math.round((simNewNet / monthlyTarget) * 100))
          : 100;
        const simRawRemainingMins = Math.max(0, totalMinsNeeded - simNewTotalMins);
        const simOverMoney = Math.max(0, simNewNet - monthlyTarget);

        // คำนวณจำนวนเรื่องโดยอ้างอิงค่าที่ตั้งไว้ในหน้าหลักตามตรง
        const simAutoMoviesEst = simRawRemainingMins > 0
          ? Math.ceil(simRawRemainingMins / standardMovieLength)
          : 0;
        const simInheritedMoviesEst = customMoviesCount && customMoviesCount > 0
          ? customMoviesCount
          : simAutoMoviesEst;
        const simMoviesEst = simRawRemainingMins > 0
          ? (simCustomMoviesCount !== null ? simCustomMoviesCount : simInheritedMoviesEst)
          : 0;
        const simAvgMinsPerMovie = simMoviesEst > 0
          ? Math.ceil(simRawRemainingMins / simMoviesEst) + 1
          : 0;
        const simRemainingMinsNeeded = simMoviesEst * simAvgMinsPerMovie;
        const simRemainingMoney = Math.round(simRemainingMinsNeeded * netRatePerMin);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#12141a] border border-red-500/50 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#262933] pb-2.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Calculator size={15} className="text-red-500" />
                  <span>จำลองนาทีเรื่องถัดไป</span>
                </h4>
                <button
                  onClick={() => setIsSimModalOpen(false)}
                  className="text-[#8e94a4] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[#8e94a4] block mb-1.5">
                    กรอกจำนวนนาทีของเรื่องถัดไป:
                  </label>
                  <div className="flex items-center bg-[#0a0b0e] border border-red-500/40 rounded-xl px-3 py-2 focus-within:border-red-500">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={simMinutesInput}
                      onChange={(e) => setSimMinutesInput(e.target.value)}
                      placeholder="เช่น 75 หรือ 80"
                      className="w-full bg-transparent text-base font-mono font-bold text-white placeholder-[#454954] focus:outline-none"
                      autoFocus
                    />
                    <span className="text-[#8e94a4] font-medium shrink-0 ml-2">นาที</span>
                  </div>
                </div>

                {/* แถบแสดงความคืบหน้าหลังจำลอง */}
                <div className="bg-[#0a0b0e] border border-[#262933] rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[11px] text-[#8e94a4]">
                      ยอดสุทธิหลังทำเรื่องนี้:
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-red-400 font-bold">{simNewPercent}%</span>
                      <span className="text-[10px] text-[#8e94a4] ml-1">
                        (เดิม {targetPercent}%)
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-[#1c1f28] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#262933]">
                    <div
                      className="bg-gradient-to-r from-red-700 to-red-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${simNewPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-mono font-black text-white text-sm">
                      ฿{simNewNet.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[10px] text-[#6b7280] font-normal ml-1">
                        / ฿{monthlyTarget.toLocaleString()}
                      </span>
                    </span>
                    {simMins > 0 && (
                      <span className="text-[11px] font-mono font-bold text-emerald-400">
                        +฿{simAddedNet.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* สรุปส่วนที่เหลือหลังจากทำเรื่องจำลองนี้แล้ว (รูปแบบเดียวกับหน้าหลัก) */}
                {simRawRemainingMins === 0 ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-center space-y-1">
                    <p className="text-sm font-black text-emerald-400">
                      ถึงเป้าหมายเดือนนี้แล้ว! 🎉
                    </p>
                    {simOverMoney > 0 && (
                      <p className="text-[11px] text-emerald-300/80 font-mono">
                        (เกินเป้าหมาย +฿{simOverMoney.toLocaleString('th-TH', { maximumFractionDigits: 0 })})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#181a22] border border-[#262933] rounded-xl p-3 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#8e94a4] block text-[11px]">นาทีที่ต้องทำเพิ่ม:</span>
                      <span className="font-mono font-bold text-white text-xs sm:text-sm block mt-0.5 truncate">
                        {simRemainingMinsNeeded} นาที
                      </span>
                      <span className="text-[10px] text-red-400 block mt-0.5 truncate">
                        (ยังขาดอีก ฿{simRemainingMoney.toLocaleString()})
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8e94a4] block text-[11px]">ประมาณจำนวนเรื่อง:</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-white text-xs sm:text-sm truncate">
                          อีกประมาณ {simMoviesEst} เรื่อง
                        </span>
                        <div className="flex flex-col bg-[#12141a] border border-[#262933] rounded-md overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => setSimCustomMoviesCount(simMoviesEst + 1)}
                            className="px-1 py-0.2 hover:bg-[#262a36] text-[#8e94a4] hover:text-white transition leading-none"
                            title="เพิ่มจำนวนเรื่อง"
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={simMoviesEst <= 1}
                            onClick={() => setSimCustomMoviesCount(Math.max(1, simMoviesEst - 1))}
                            className="px-1 py-0.2 hover:bg-[#262a36] text-[#8e94a4] hover:text-white disabled:opacity-30 transition leading-none border-t border-[#262933]"
                            title="ลดจำนวนเรื่อง"
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>
                        {simCustomMoviesCount !== null && (
                          <button
                            type="button"
                            onClick={() => setSimCustomMoviesCount(null)}
                            className="p-0.5 text-[#6b7280] hover:text-red-400 transition shrink-0"
                            title="รีเซ็ตกลับเป็นค่าเริ่มต้น"
                          >
                            <RotateCcw size={11} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-[#6b7280] block mt-0.5 truncate">
                        (เฉลี่ยเรื่องละ ~{simAvgMinsPerMovie} นาที)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsSimModalOpen(false)}
                className="w-full bg-[#1c1f28] hover:bg-[#262a36] text-white font-bold py-2.5 rounded-xl text-xs transition border border-[#262933]"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        );
      })()}

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

            {dialogState.type !== 'prompt' && dialogState.desc && (
              <div className="text-xs text-[#a0a6b5] leading-relaxed whitespace-pre-line bg-[#0a0b0e]/70 p-3 rounded-xl border border-[#262933] font-mono">
                {dialogState.desc}
              </div>
            )}

            {dialogState.type === 'prompt' && (
              <div className="space-y-1.5">
                {dialogState.desc && (
                  <p className="text-xs text-[#8e94a4]">
                    {dialogState.desc}
                  </p>
                )}
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
            <span>ตาราง</span>
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

function jobTitle(title: string): string {
  return title || 'รายการนี้';
}