'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Sparkles, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { JobItem, formatToStandardDate, isDateString } from '@/lib/parser';

export default function QuickImportPage() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [targetWorkspace, setTargetWorkspace] = useState('');
  // เลือกว่าจะนำเข้าเป็นรอบปัจจุบัน (รอคิดเงิน) หรือประวัติเก่า (ปิดรอบแล้ว)
  const [importStatus, setImportStatus] = useState<'pending' | 'billed'>('pending');
  
  const [rawText, setRawText] = useState('');
  const [parsedJobs, setParsedJobs] = useState<JobItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ title: string; desc: string } | null>(null);

  // ดึง Workspaces จริงจาก Supabase และจำค่าทีมที่เลือกไว้ล่าสุด
  useEffect(() => {
    async function loadWorkspaces() {
      const { data } = await supabase.from('workspaces').select('name').order('created_at', { ascending: true });
      if (data && data.length > 0) {
        const names = data.map(w => w.name);
        setWorkspaces(names);
        const savedWs = localStorage.getItem('mix_selected_ws');
        if (savedWs && names.includes(savedWs)) {
          setTargetWorkspace(savedWs);
        } else {
          setTargetWorkspace(names[0]);
        }
      }
    }
    loadWorkspaces();
  }, []);

  const handleParse = () => {
    if (!rawText.trim()) return;
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const newItems: JobItem[] = [];
    let currentTitle = '';
    let currentEpisode = '';
    let currentMinutes = 0;
    let currentDriveUrl = '';
    let currentDateTokens: string[] = [];

    const commitCurrent = () => {
      if (!currentTitle && currentDateTokens.length === 0) return;
      const title = currentTitle || 'งานไม่มีชื่อ';
      const isDW = title.toUpperCase().startsWith('DW');
      let date_glao = '';
      let date_pak = '';
      let date_mix = '';
      let date_sub = '';
      let date_deadline = '';

      if (isDW) {
        if (currentDateTokens.length >= 4) {
          date_glao = formatToStandardDate(currentDateTokens[0]);
          date_pak = formatToStandardDate(currentDateTokens[1]);
          date_mix = formatToStandardDate(currentDateTokens[2]);
          date_deadline = formatToStandardDate(currentDateTokens[3]);
        } else if (currentDateTokens.length === 3) {
          date_pak = formatToStandardDate(currentDateTokens[0]);
          date_mix = formatToStandardDate(currentDateTokens[1]);
          date_deadline = formatToStandardDate(currentDateTokens[2]);
        }
      } else {
        if (currentDateTokens.length >= 5) {
          date_glao = formatToStandardDate(currentDateTokens[0]);
          date_pak = formatToStandardDate(currentDateTokens[1]);
          date_mix = formatToStandardDate(currentDateTokens[2]);
          date_sub = formatToStandardDate(currentDateTokens[3]);
          date_deadline = formatToStandardDate(currentDateTokens[4]);
        } else if (currentDateTokens.length === 4) {
          date_glao = formatToStandardDate(currentDateTokens[0]);
          date_pak = formatToStandardDate(currentDateTokens[1]);
          date_mix = formatToStandardDate(currentDateTokens[2]);
          date_deadline = formatToStandardDate(currentDateTokens[3]);
        }
      }

      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        workspace: targetWorkspace,
        title,
        episode: currentEpisode,
        minutes: currentMinutes,
        drive_url: currentDriveUrl,
        date_glao,
        date_pak,
        date_mix,
        date_sub,
        date_deadline: date_deadline || date_mix || new Date().toISOString().split('T')[0],
        isIncludedInBilling: importStatus === 'pending',
        status: importStatus
      });

      currentTitle = '';
      currentEpisode = '';
      currentMinutes = 0;
      currentDriveUrl = '';
      currentDateTokens = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        currentDriveUrl = urlMatch[0];
      }
      if (line.includes('_')) {
        const clean = line.replace(/(https?:\/\/[^\s]+)/g, '').trim();
        const parts = clean.split('_');
        if (parts.length >= 2 && !isDateString(parts[0])) {
          if (currentTitle) {
            commitCurrent();
          }
          currentTitle = parts[0];
          currentEpisode = parts.length >= 3 ? parts[1] : '';
          currentMinutes = parseFloat(parts.length >= 3 ? parts[2] : parts[1]) || 0;
          continue;
        }
      }
      const tokens = line.split(/\t+|\s{2,}|\s+/).map(t => t.trim()).filter(Boolean);
      const foundDates = tokens.filter(t => isDateString(t));
      if (foundDates.length >= 3) {
        if (!isDateString(tokens[0]) && !currentTitle) {
          currentTitle = tokens[0];
        }
        currentDateTokens = foundDates;
        commitCurrent();
      }
    }
    commitCurrent();
    setParsedJobs(newItems);
    setStatusMessage(`แปลงข้อมูลเรียบร้อย พบ ${newItems.length} รายการ (สถานะ: ${importStatus === 'pending' ? 'รอบปัจจุบัน' : 'ประวัติเก่า'})`);
  };

  const handleSaveToSupabase = async () => {
    if (parsedJobs.length === 0) return;
    setSaving(true);
    try {
      if (targetWorkspace) {
        localStorage.setItem('mix_selected_ws', targetWorkspace);
      }

      const payload = parsedJobs.map(j => ({
        id: j.id,
        workspace: targetWorkspace,
        title: j.title,
        episode: j.episode,
        minutes: j.minutes,
        drive_url: j.drive_url || '',
        date_glao: j.date_glao || '',
        date_pak: j.date_pak || '',
        date_mix: j.date_mix || '',
        date_sub: j.date_sub || '',
        date_deadline: j.date_deadline || '',
        is_included_in_billing: importStatus === 'pending',
        status: importStatus
      }));

      const { error } = await supabase.from('jobs').insert(payload);
      if (!error) {
        setModalMessage({
          title: 'บันทึกสำเร็จ',
          desc: `นำเข้า ${parsedJobs.length} เรื่อง เข้าสู่ทีม "${targetWorkspace}" เรียบร้อยแล้ว (${importStatus === 'pending' ? 'อยู่ในคิวรอบปัจจุบัน' : 'อยู่ในตารางประวัติปิดรอบแล้ว'})`
        });
        setParsedJobs([]);
        setRawText('');
      } else {
        setModalMessage({ title: 'เกิดข้อผิดพลาด', desc: error.message });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      setModalMessage({ title: 'เกิดข้อผิดพลาด', desc: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-[#f0f2f5] p-4 md:p-8 font-sans max-w-2xl mx-auto select-none">
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#8e94a4] hover:text-white bg-[#12141a] border border-[#262933] px-3 py-2 rounded-xl transition">
          <ArrowLeft size={15} /> กลับหน้าหลัก
        </Link>
        <span className="text-[11px] text-red-400 font-mono font-bold uppercase tracking-wider">Cloud Ingest Tool</span>
      </div>

      <div className="bg-[#12141a] border border-red-900/40 rounded-2xl p-5 space-y-4">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Sparkles size={18} className="text-red-500" /> นำเข้าข้อมูลด่วนเข้า Supabase
          </h1>
          <p className="text-xs text-[#8e94a4] mt-1 leading-relaxed">
            วางข้อความที่มีชื่อเรื่อง ตอน นาที ลิงก์ Drive หรือตารางวันที่ ระบบจะแยกข้อมูลและบันทึกเข้าสู่ทีมที่เลือกโดยไม่ทับงานเดิม
          </p>
        </div>

        {/* เลือกทีม / Workspace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#8e94a4] block mb-1 font-bold">บันทึกเข้าทีม (Workspace):</label>
            <select
              value={targetWorkspace}
              onChange={(e) => {
                setTargetWorkspace(e.target.value);
                localStorage.setItem('mix_selected_ws', e.target.value);
              }}
              className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2.5 text-xs text-white focus:border-red-500 focus:outline-none cursor-pointer font-bold"
            >
              {workspaces.map(w => (
                <option key={w} value={w} className="bg-[#12141a] text-white">{w}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#8e94a4] block mb-1 font-bold">หมวดหมู่งานที่นำเข้า:</label>
            <div className="flex bg-[#0a0b0e] p-1 rounded-xl border border-[#262933] h-[38px] items-center">
              <button
                type="button"
                onClick={() => setImportStatus('pending')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                  importStatus === 'pending' ? 'bg-red-600 text-white shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                รอบปัจจุบัน (รอคิดเงิน)
              </button>
              <button
                type="button"
                onClick={() => setImportStatus('billed')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                  importStatus === 'billed' ? 'bg-[#1c1f28] text-amber-400 border border-amber-500/40 shadow' : 'text-[#8e94a4] hover:text-white'
                }`}
              >
                ประวัติเก่า (ปิดรอบแล้ว)
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-[#8e94a4] block mb-1 font-bold">วางข้อความดิบ:</label>
          <textarea 
            rows={9}
            placeholder={`GS269_61_84\nhttps://drive.google.com/drive/folders/...\n26-10-26  27-10-26  28-10-26  29-10-26  30-10-26\n\nDW335_42_75\nhttps://drive.google.com/drive/folders/...\n23-10-26  24-10-26  25-10-26  26-10-26`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl p-3 text-xs text-white placeholder-[#454954] font-mono focus:border-red-500 focus:outline-none"
          />
        </div>

        <button 
          onClick={handleParse}
          className="w-full bg-[#1c1f28] hover:bg-[#262a36] border border-[#262933] text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2"
        >
          <Sparkles size={15} className="text-red-400" /> แปลงข้อความเป็นรายการงาน
        </button>

        {statusMessage && (
          <div className="text-xs text-red-400 font-bold bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl text-center">
            {statusMessage}
          </div>
        )}
      </div>

      {parsedJobs.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase">ตัวอย่างรายการที่เตรียมนำเข้า ({parsedJobs.length} เรื่อง)</h2>
            <button 
              onClick={handleSaveToSupabase}
              disabled={saving}
              className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/50 transition disabled:opacity-50"
            >
              <Save size={15} /> {saving ? 'กำลังบันทึก...' : 'ยืนยันบันทึกเข้า Supabase'}
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {parsedJobs.map((j, idx) => (
              <div key={idx} className="bg-[#12141a] border border-[#262933] p-3 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{j.title} {j.episode ? `ตอน ${j.episode}` : ''}</span>
                    <span className="text-red-400 font-mono font-bold">({j.minutes} นาที)</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      importStatus === 'pending' ? 'bg-red-950/40 text-red-300 border-red-900/40' : 'bg-amber-950/40 text-amber-300 border-amber-900/40'
                    }`}>
                      {importStatus === 'pending' ? 'รอบปัจจุบัน' : 'ปิดรอบแล้ว'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5 font-mono">
                    มิกซ์: {j.date_mix || '-'} | เดดไลน์: {j.date_deadline || '-'}
                  </div>
                </div>
                {j.drive_url ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md">
                    มี Drive
                  </span>
                ) : (
                  <span className="text-[10px] text-[#555a66]">ไม่มี Drive</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {modalMessage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-red-500/40 rounded-2xl p-5 max-w-xs w-full text-center space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#262933] pb-2">
              <h4 className="text-sm font-bold text-white">{modalMessage.title}</h4>
              <button onClick={() => setModalMessage(null)} className="text-[#8e94a4] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#a0a6b5] leading-relaxed whitespace-pre-line text-left bg-[#0a0b0e] p-3 rounded-xl border border-[#262933]">
              {modalMessage.desc}
            </p>
            <button 
              onClick={() => setModalMessage(null)} 
              className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-md"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </main>
  );
}