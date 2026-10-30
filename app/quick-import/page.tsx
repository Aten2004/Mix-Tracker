'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { JobItem, formatToStandardDate, isDateString } from '@/lib/parser';

export default function QuickImportPage() {
  const [targetWorkspace, setTargetWorkspace] = useState('ทีมซีรีส์จีน (GS/DW)');
  const [rawText, setRawText] = useState('');
  const [parsedJobs, setParsedJobs] = useState<JobItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      const title = currentTitle || 'งานนำเข้า';
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
        id: (Date.now() + Math.random() * 1000).toFixed(0),
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
        isIncludedInBilling: true,
        status: 'pending'
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
    setStatusMessage(`วิเคราะห์พบทั้งหมด ${newItems.length} เรื่อง`);
  };

  // บันทึกตรงเข้าฐานข้อมูล Supabase
  const handleSaveToSupabase = async () => {
    if (parsedJobs.length === 0) return;
    setSaving(true);

    try {
      // ตรวจสอบให้มั่นใจว่ามีชื่อทีมนี้ในตาราง workspaces ก่อน
      await supabase.from('workspaces').insert([{ name: targetWorkspace }]).select();

      const payload = parsedJobs.map(j => ({
        id: j.id,
        workspace: j.workspace,
        title: j.title,
        episode: j.episode,
        minutes: j.minutes,
        drive_url: j.drive_url || '',
        date_glao: j.date_glao || '',
        date_pak: j.date_pak || '',
        date_mix: j.date_mix || '',
        date_sub: j.date_sub || '',
        date_deadline: j.date_deadline || '',
        is_included_in_billing: true,
        status: 'pending'
      }));

      const { error } = await supabase.from('jobs').insert(payload);

      if (!error) {
        alert(`✅ บันทึกงานทั้ง ${parsedJobs.length} เรื่องขึ้น Supabase เรียบร้อยแล้ว!\nข้อมูลจะซิงค์กับทั้งคอมและมือถือทันที`);
        setParsedJobs([]);
        setRawText('');
      } else {
        alert(`เกิดข้อผิดพลาด: ${error.message}`);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-[#f0f2f5] p-4 md:p-8 font-sans max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[#8e94a4] hover:text-white bg-[#12141a] border border-[#262933] px-3 py-2 rounded-xl transition">
          <ArrowLeft size={15} /> กลับหน้าหลัก
        </Link>
        <span className="text-[11px] text-red-400 font-mono font-bold uppercase tracking-wider">Cloud Ingest Tool</span>
      </div>

      <div className="bg-[#12141a] border border-red-900/40 rounded-2xl p-5 space-y-4">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Sparkles size={18} className="text-red-500" /> นำเข้าข้อมูลประวัติด่วนขึ้น Supabase
          </h1>
          <p className="text-xs text-[#8e94a4] mt-1 leading-relaxed">
            ก๊อปปี้ข้อความทั้งหมดจาก Discord หรือตาราง Sheet มาวางพร้อมกันได้เลย ระบบจะแยกชื่อเรื่อง ตอน นาที ลิงก์ Drive และส่งขึ้น Cloud ทันที
          </p>
        </div>

        <div>
          <label className="text-xs text-[#8e94a4] block mb-1 font-bold">บันทึกเข้าสู่ทีม:</label>
          <input 
            type="text" 
            value={targetWorkspace}
            onChange={(e) => setTargetWorkspace(e.target.value)}
            className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs text-[#8e94a4] block mb-1 font-bold">วางข้อความทั้งหมดที่นี่:</label>
          <textarea 
            rows={10}
            placeholder={`GS269_61_84\nhttps://drive.google.com/drive/folders/...\n26-10-26  27-10-26  28-10-26  29-10-26  30-10-26\n\nGS273_55_76\nhttps://drive.google.com/drive/folders/...\n29-10-26  30-10-26  31-10-26  1-11-26  2-11-26`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full bg-[#0a0b0e] border border-[#262933] rounded-xl p-3 text-xs text-white placeholder-[#454954] font-mono focus:border-red-500 focus:outline-none"
          />
        </div>

        <button 
          onClick={handleParse}
          className="w-full bg-[#1c1f28] hover:bg-[#262a36] border border-[#262933] text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2"
        >
          <Sparkles size={15} className="text-red-400" /> ตรวจสอบและดึงข้อมูล
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
            <h2 className="text-xs font-bold text-white uppercase">ตัวอย่างข้อมูลที่ตรวจพบ ({parsedJobs.length} เรื่อง)</h2>
            <button 
              onClick={handleSaveToSupabase}
              disabled={saving}
              className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/50 transition disabled:opacity-50"
            >
              <Save size={15} /> {saving ? 'กำลังส่งขึ้น Cloud...' : 'บันทึกทั้งหมดขึ้น Supabase'}
            </button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {parsedJobs.map((j, idx) => (
              <div key={idx} className="bg-[#12141a] border border-[#262933] p-3 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{j.title} {j.episode ? `ตอน ${j.episode}` : ''}</span>
                    <span className="text-red-400 font-mono font-bold">({j.minutes} นาที)</span>
                  </div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5 font-mono">
                    มิกซ์: {j.date_mix || '-'} | เดดไลน์: {j.date_deadline || '-'}
                  </div>
                </div>
                {j.drive_url ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-md">
                    มีลิงก์ Drive
                  </span>
                ) : (
                  <span className="text-[10px] text-[#555a66]">ไม่มี Drive</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}