export interface JobItem {
  id: string;
  workspace: string;
  title: string;
  episode: string;
  minutes: number;
  drive_url?: string;    // ลิงก์ Drive สำหรับเปิดไฟล์งาน
  date_glao: string;
  date_pak: string;
  date_mix: string;
  date_sub?: string;
  date_deadline: string;
  isIncludedInBilling: boolean;
  status: 'pending' | 'billed'; // pending = รอบปัจจุบัน, billed = ปิดยอดไปแล้ว
  billingCycleId?: string;      // ผูกกับรอบบิลที่ปิด
}

export interface BillingCycle {
  id: string;
  workspace: string;
  title: string;
  cutoffDate: string;
  totalMinutes: number;
  grossIncome: number;
  taxAmount: number;
  netIncome: number;
  jobCount: number;
  jobIds: string[];
  createdAt: string;
}

export function isDateString(s: string): boolean {
  if (!s) return false;
  return /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s.trim());
}

export function formatToStandardDate(str: string): string {
  if (!str || str.trim() === '-' || str.trim() === '') return '';
  const clean = str.trim().replace(/\//g, '-');
  const parts = clean.split('-');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return '';
}

export function formatToDisplayDate(isoStr: string): string {
  if (!isoStr) return '-';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0].slice(2)}`;
  }
  return isoStr;
}

// แยกข้อความด่วน: รองรับทั้งแยกชื่อ_ตอน_นาที และดึงลิงก์ Drive อัตโนมัติหากก๊อปติดมาด้วย
export function parseQuickCode(input: string) {
  let text = input.trim();
  let extractedUrl = '';

  // ตรวจจับ URL หากผู้ใช้ก๊อปปี้ติดมาในช่องเดียวกัน
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (urlMatch) {
    extractedUrl = urlMatch[0];
    text = text.replace(extractedUrl, '').trim();
  }

  const parts = text.split('_');
  const title = parts[0] || '';
  const episode = parts.length >= 3 ? parts[1] : '';
  const minutes = parseFloat(parts.length >= 3 ? parts[2] : parts[1] || '0') || 0;
  return { title, episode, minutes, drive_url: extractedUrl };
}

// แกะข้อมูลแถวจาก Sheet หรือตาราง
export function parseSheetRow(text: string) {
  const cols = text.split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);
  if (cols.length === 0) return null;

  let title = '';
  let dateTokens: string[] = [];

  if (isDateString(cols[0])) {
    dateTokens = cols.filter(c => isDateString(c));
  } else {
    title = cols[0];
    dateTokens = cols.slice(1).filter(c => isDateString(c));
  }

  const isDW = title.toUpperCase().startsWith('DW');

  let date_glao = '';
  let date_pak = '';
  let date_mix = '';
  let date_sub = '';
  let date_deadline = '';

  if (isDW) {
    if (dateTokens.length >= 4) {
      date_glao = formatToStandardDate(dateTokens[0]);
      date_pak = formatToStandardDate(dateTokens[1]);
      date_mix = formatToStandardDate(dateTokens[2]);
      date_deadline = formatToStandardDate(dateTokens[3]);
    } else if (dateTokens.length === 3) {
      date_pak = formatToStandardDate(dateTokens[0]);
      date_mix = formatToStandardDate(dateTokens[1]);
      date_deadline = formatToStandardDate(dateTokens[2]);
    }
  } else {
    if (dateTokens.length >= 5) {
      date_glao = formatToStandardDate(dateTokens[0]);
      date_pak = formatToStandardDate(dateTokens[1]);
      date_mix = formatToStandardDate(dateTokens[2]);
      date_sub = formatToStandardDate(dateTokens[3]);
      date_deadline = formatToStandardDate(dateTokens[4]);
    } else if (dateTokens.length === 4) {
      date_glao = formatToStandardDate(dateTokens[0]);
      date_pak = formatToStandardDate(dateTokens[1]);
      date_mix = formatToStandardDate(dateTokens[2]);
      date_deadline = formatToStandardDate(dateTokens[3]);
    }
  }

  return { title, date_glao, date_pak, date_mix, date_sub, date_deadline };
}