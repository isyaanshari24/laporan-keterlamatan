// ─────────────────────────────────────────────────────────────────
// app.js - Manajemen Laporan Pengawas Replating & Integrasi Gemini
// ─────────────────────────────────────────────────────────────────
import { GoogleGenAI } from '@google/genai';

// ======================== DI SINI TEMPAT TOKEN GEMINI ANDA ========================
const GEMINI_API_KEY = "AIzaSyYourActualGeminiApiKeyHere..."; 
// ==================================================================================

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ────────────────────────── STATE GLOBAL ──────────────────────────
const STORE_KEY = 'shm_keterlambatan';
const PROJ_KEY  = 'shm_projects';

let projects = JSON.parse(localStorage.getItem(PROJ_KEY) || '[]');
if (!projects.length) {
  projects = [
    'BG. MBP 4005', 'LCT Bantu', 'Bahtera 02', 'BG. Belinjo',
    'BG. Perkasa', 'KM. Antasena', 'Tongkang 01'
  ];
  saveProjects();
}

let selectedProjects = new Set();
let rekoms = [];

// ────────────────────────── STARTUP INIT ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const tglInput = document.getElementById('inp-tanggal');
  if (tglInput) tglInput.value = today;

  renderChips();
  
  // Setup baris rekomendasi awal default
  addRekom(); addRekom(); addRekom(); addRekom();
  const defaults = [
    'Menghentikan sementara pekerjaan luar ruangan demi keselamatan personel dan kualitas hasil kerja',
    'Melakukan inspeksi ulang pada area kerja setelah kondisi normal',
    'Menyesuaikan jadwal pekerjaan dan menginformasikan perubahan kepada pihak terkait',
    'Memastikan peralatan dan material terlindungi'
  ];
  rekoms.forEach((r, i) => {
    const el = document.getElementById(r.id);
    if (defaults[i] && el) el.value = defaults[i];
  });

  const tindakInput = document.getElementById('inp-tindak');
  if (tindakInput) {
    tindakInput.value = 'Pemantauan kondisi secara berkala dan evaluasi dampak terhadap target penyelesaian pekerjaan.';
  }
});

// ────────────────────────── NAVIGASI TAB ──────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tabs button').forEach(el => el.classList.remove('active'));
  
  const tabEl = document.getElementById('tab-' + name);
  if (tabEl) tabEl.classList.add('active');
  
  const btnIdx = ['form', 'preview', 'history'].indexOf(name);
  if (btnIdx !== -1) {
    const btn = document.querySelectorAll('.tabs button')[btnIdx];
    if (btn) btn.classList.add('active');
  }
  
  if (name === 'history') { 
    populateFilterProject(); 
    renderHistory(); 
  }
}

// ────────────────────────── MANAGEMENT PROYEK ──────────────────────────
function saveProjects() {
  localStorage.setItem(PROJ_KEY, JSON.stringify(projects));
}

function renderChips() {
  const cont = document.getElementById('project-chips');
  if (!cont) return;
  cont.innerHTML = '';
  projects.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (selectedProjects.has(p) ? ' selected' : '');
    chip.innerHTML = `<span>${p}</span><button class="chip-del" title="Hapus">×</button>`;
    
    chip.querySelector('span').addEventListener('click', () => toggleProject(p));
    chip.querySelector('.chip-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeProject(p);
    });
    
    cont.appendChild(chip);
  });
}

function toggleProject(p) {
  if (selectedProjects.has(p)) selectedProjects.delete(p);
  else selectedProjects.add(p);
  renderChips();
}

function addProject() {
  const inp = document.getElementById('inp-new-project');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  if (!projects.includes(val)) { projects.push(val); saveProjects(); }
  selectedProjects.add(val);
  inp.value = '';
  renderChips();
}

function removeProject(p) {
  if (!confirm(`Hapus proyek "${p}" dari daftar?`)) return;
  projects = projects.filter(x => x !== p);
  selectedProjects.delete(p);
  saveProjects();
  renderChips();
}

// ────────────────────────── INPUT REKOMENDASI ──────────────────────────
function addRekom() {
  const id = 'rekom-' + Date.now() + Math.random().toString(36).slice(2);
  rekoms.push({ id });
  const row = document.createElement('div');
  row.className = 'rekom-item';
  row.id = 'row-' + id;
  row.innerHTML = `
    <textarea id="${id}" placeholder="Ketik rekomendasi alternatif atau tindakan K3 lapangan..."></textarea>
    <button class="btn btn-danger btn-sm btn-del-rekom" style="padding:0 12px;">−</button>
  `;
  row.querySelector('.btn-del-rekom').addEventListener('click', () => removeRekom(id));
  
  const listCont = document.getElementById('rekom-list');
  if (listCont) listCont.appendChild(row);
}

function removeRekom(id) {
  rekoms = rekoms.filter(r => r.id !== id);
  const el = document.getElementById('row-' + id);
  if (el) el.remove();
}

// ────────────────────────── LOGIKA INTEGRASI AI (GEMINI) ──────────────────────────
async function generateAIRekom() {
  const penyebab = document.getElementById('inp-penyebab').value.trim();
  const btnAI = document.getElementById('btn-ai-rekom');
  const btnManual = document.querySelector('.btn-add-rekom');
  const status = document.getElementById('ai-rekom-status');

  if (!penyebab) {
    alert('Isi "Penyebab Keterlambatan" dulu, baru AI bisa menganalisa rekomendasi.');
    document.getElementById('inp-penyebab').focus();
    return;
  }

  const existing = rekoms
    .map(r => document.getElementById(r.id)?.value.trim())
    .filter(Boolean);

  btnAI.disabled = true;
  if (btnManual) btnManual.disabled = true;

  const originalText = btnAI.innerHTML;
  btnAI.innerHTML = '<span class="spinner"></span> Gemini sedang menganalisa...';
  status.innerHTML = '⚡ Menganalisa parameter K3 & Teknis Replating...';

  try {
    if (GEMINI_API_KEY.includes("YourActualGeminiApiKey")) {
      throw new Error("API Key belum diset. Buka file app.js dan ganti variabel GEMINI_API_KEY.");
    }

    // Konstruksi Prompt Multiparameter (Alat Berat, Electric, Logistik, K3, dll.)
    const prompt = `
      Anda adalah seorang Manajer Proyek Senior dan Ahli K3 (Keselamatan dan Kesehatan Kerja) di industri galangan kapal dan konstruksi berat.
      Tugas Anda adalah membantu Pengawas Lapangan dari pihak Subcontractor Replating untuk mengatasi keterlambatan proyek. Pengawas sering menghadapi kendala yang saling berkaitan.

      Konteks Pekerjaan: 
      - Bagian: Replating (Fabrikasi, Fit-up, Welding/Pengelasan, Gouging plat baja)
      - Deskripsi Kendala/Penyebab Keterlambatan: "${penyebab}"
      - Daftar rekomendasi yang sudah ada (JANGAN DIULANGI): ${JSON.stringify(existing)}

      Analisis penyebab di atas dan berikan 2 sampai 3 rekomendasi solusi yang taktis, spesifik, dan aman. Jika input di atas menyinggung faktor-faktor berikut, berikan solusi spesifik:
      1. KENDALA ALAT BERAT (Crane, Forklift): Berikan solusi koordinasi, *sharing schedule* dengan Main Contractor, atau optimalisasi metode rigging/fit-up alternatif yang aman.
      2. KENDALA ELECTRIC (Power drop, lampu mati, breaker trip): Berikan solusi taktis pengawasan instalasi kabel, penyediaan genset backup, atau koordinasi dengan tim electric Main Con untuk pembagian beban daya agar tidak mengganggu proses las (welding).
      3. KENDALA LOGISTIK (Keterlambatan material plat, gas, kawat las): Berikan solusi manajemen buffer stock, koordinasi *pre-order*, atau pengalihan tenaga kerja (*fitter/welder*) ke area kerja lain yang materialnya siap agar tidak ada *idle time*.
      4. KESELAMATAN KERJA (K3) & FAKTOR LAIN (Cuaca/Fatigue): Solusi WAJIB mengutamakan keselamatan (contoh: pemakaian blower di confined space, pembatasan lembur jika pekerja lelah/fatigue, kebersihan area dari kabel melintang, dan kepatuhan JSA/Hot Work Permit).

      Tuliskan rekomendasi dalam kalimat instruksi lapangan yang singkat, padat, dan langsung bisa dieksekusi oleh Pengawas Lapangan.

      Format output HARUS berupa JSON array of strings murni tanpa format markdown apa pun (tanpa \`\`\`json). 
      Contoh output: 
      ["Berkoordinasi dengan Main Con untuk sinkronisasi jadwal overhead crane khusus area lambung agar waktu tunggu (idle time) material plat bisa dipangkas", "Meminta tim electric menyediakan panel distribusi temporary khusus mesin las replating agar tidak terjadi trip bersamaan", "Mengalihkan welder ke area fabrikasi workshop internal saat hujan deras guna menjaga progres tanpa melanggar aspek safety K3"]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!response.text) throw new Error("Tidak ada respon teks dari Gemini API.");

    const listRekomendasi = JSON.parse(response.text);

    if (!Array.isArray(listRekomendasi) || listRekomendasi.length === 0) {
      throw new Error("Format data yang dikembalikan AI tidak sesuai ketentuan.");
    }

    // Singkirkan kolom input yang masih kosong agar tidak menumpuk di UI
    rekoms.slice().forEach(r => {
      const el = document.getElementById(r.id);
      if (el && !el.value.trim()) removeRekom(r.id);
    });

    // Tempel rekomendasi dari Gemini ke UI Form
    listRekomendasi.forEach(txt => {
      addRekom();
      const last = rekoms[rekoms.length - 1];
      if (last) {
        const inputEl = document.getElementById(last.id);
        if (inputEl) inputEl.value = txt;
      }
    });

    status.innerHTML = `✓ ${listRekomendasi.length} Solusi taktis K3 berhasil ditambahkan.`;
    showToast('✓ Rekomendasi AI Berhasil Dimuat!');

  } catch (err) {
    console.error("Error Detail:", err);
    let pesanError = err.message;
    if (err.message.includes("403") || err.message.includes("API key")) {
      pesanError = "Token/API Key Gemini Anda tidak valid.";
    } else if (err.message.includes("429") || err.message.includes("quota")) {
      pesanError = "Batas kuota gratis Gemini Anda habis (Too Many Requests).";
    }
    status.innerHTML = '✗ ' + pesanError;
    alert('Gagal mengambil analisa AI: ' + pesanError);
  } finally {
    btnAI.disabled = false;
    btnAI.innerHTML = originalText;
    if (btnManual) btnManual.disabled = false;
  }
}

// ────────────────────────── DATA PROCESSING ──────────────────────────
function buildData() {
  const tanggal   = document.getElementById('inp-tanggal').value;
  const jamMulai  = document.getElementById('inp-jam-mulai').value;
  const jamSelesai= document.getElementById('inp-jam-selesai').value;
  const penyebab  = document.getElementById('inp-penyebab').value.trim();
  const tindak    = document.getElementById('inp-tindak').value.trim();
  const rekomList = rekoms.map(r => document.getElementById(r.id)?.value.trim()).filter(Boolean);

  return { tanggal, jamMulai, jamSelesai, penyebab, rekomList, tindak, projects: [...selectedProjects] };
}

function buildWAText(data) {
  const { tanggal, jamMulai, jamSelesai, penyebab, rekomList, tindak, projects } = data;
  const tgl = tanggal ? formatTanggal(tanggal) : '—';
  const waktu = jamMulai ? jamMulai + (jamSelesai ? ' - ' + jamSelesai : '') + ' WITA' : '—';

  let txt = `*LAPORAN KETERLAMBATAN PELAKSANAAN PEKERJAAN*\n\n`;
  txt += `*1. Proyek yang Terdampak*\n`;
  if (projects.length) {
    projects.forEach(p => { txt += `- ${p}\n`; });
  } else {
    txt += `- (belum dipilih)\n`;
  }
  txt += `\n*2. Waktu Kejadian*: ${waktu}`;
  txt += `\n*3. Penyebab*: ${penyebab || '—'}`;
  txt += `\n*4. Rekomendasi Solusi & K3*:\n`;
  rekomList.forEach(r => { txt += `- ${r}\n`; });
  if (!rekomList.length) txt += `- (belum diisi)\n`;
  txt += `\n*5. Tindak Lanjut*: ${tindak || '—'}`;
  txt += `\n\n_Tanggal Laporan: ${tgl}_`;
  return txt;
}

function formatTanggal(str) {
  if(!str) return '—';
  const [y, m, d] = str.split('-');
  const bulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${parseInt(d)} ${bulan[parseInt(m)]} ${y}`;
}

// ────────────────────────── OUTPUT HANDLING ──────────────────────────
function goPreview() {
  const data = buildData();
  const wa   = buildWAText(data);
  const html = wa.replace(/\*([^*]+)\*/g, '<span class="bold">$1</span>');
  document.getElementById('preview-output').innerHTML = html;
  switchTab('preview');
}

function copyWA() {
  const data = buildData();
  const txt  = buildWAText(data);
  navigator.clipboard.writeText(txt).then(() => showToast('✓ Tersalin ke clipboard!'));
}

// ────────────────────────── STORAGE & SYNC ──────────────────────────
function saveReport() {
  const data = buildData();
  if (!data.tanggal) { alert('Isi tanggal dulu ya!'); return; }
  if (!data.projects.length) { alert('Pilih minimal 1 proyek!'); return; }
  if (!data.penyebab) { alert('Isi penyebab dulu!'); return; }

  const records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  data.id = Date.now();
  data.savedAt = new Date().toISOString();
  records.unshift(data);
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
  
  pushGAS('saveLaporan', { record: data });
  showToast('✓ Laporan disimpan & disinkron!');
}

function loadRecord(id) {
  const records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  const r = records.find(x => x.id === id);
  if (!r) return;

  document.getElementById('inp-tanggal').value   = r.tanggal || '';
  document.getElementById('inp-jam-mulai').value = r.jamMulai || '';
  document.getElementById('inp-jam-selesai').value= r.jamSelesai || '';
  document.getElementById('inp-penyebab').value  = r.penyebab || '';
  document.getElementById('inp-tindak').value    = r.tindak || '';

  selectedProjects = new Set(r.projects || []);
  renderChips();

  document.getElementById('rekom-list').innerHTML = '';
  rekoms = [];
  (r.rekomList || []).forEach(txt => {
    addRekom();
    const last = rekoms[rekoms.length-1];
    document.getElementById(last.id).value = txt;
  });

  switchTab('form');
}

function deleteRecord(id) {
  if (!confirm('Hapus laporan ini?')) return;
  let records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  records = records.filter(x => x.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
  pushGAS('deleteLaporan', { id });
  renderHistory();
  showToast('Laporan dihapus.');
}

function populateFilterProject() {
  const sel = document.getElementById('filter-project');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua Proyek</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    if (p === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderHistory() {
  const records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  const filterP  = document.getElementById('filter-project')?.value || '';
  const filterF  = document.getElementById('filter-from')?.value || '';
  const filterT  = document.getElementById('filter-to')?.value || '';

  const filtered = records.filter(r => {
    if (filterP && !r.projects.includes(filterP)) return false;
    if (filterF && r.tanggal < filterF) return false;
    if (filterT && r.tanggal > filterT) return false;
    return true;
  });

  const cont = document.getElementById('history-list');
  if (!cont) return;
  
  if (!filtered.length) {
    cont.innerHTML = '<div class="history-empty" style="text-align:center; padding:30px; color:var(--muted);">Belum ada riwayat laporan terfilter.</div>';
    return;
  }

  cont.innerHTML = '';
  filtered.forEach(r => {
    const tgl  = formatTanggal(r.tanggal);
    const waktu= r.jamMulai ? r.jamMulai + (r.jamSelesai ? '-'+r.jamSelesai : '') + ' WITA' : '—';
    const chips= (r.projects||[]).map(p=>`<span class="hc-chip">${p}</span>`).join('');
    
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="hc-top">
        <div class="hc-date">📅 ${tgl}</div>
        <div class="hc-time">⏱ ${waktu}</div>
      </div>
      <div class="hc-projects">${chips}</div>
      <div class="hc-cause">${r.penyebab || '—'}</div>
      <div class="hc-actions">
        <button class="hc-btn btn-edit">✏️ Edit</button>
        <button class="hc-btn btn-view">👁 Preview</button>
        <button class="hc-btn danger btn-del">🗑 Hapus</button>
      </div>
    `;
    
    card.querySelector('.btn-edit').addEventListener('click', () => loadRecord(r.id));
    card.querySelector('.btn-view').addEventListener('click', () => previewRecord(r.id));
    card.querySelector('.btn-del').addEventListener('click', () => deleteRecord(r.id));
    
    cont.appendChild(card);
  });

  const all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  const countEl = document.getElementById('filter-count');
  if (countEl) countEl.textContent = `Menampilkan ${filtered.length} dari ${all.length} laporan`;
}

function previewRecord(id) {
  const records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  const r = records.find(x => x.id === id);
  if (!r) return;
  const wa  = buildWAText(r);
  const html= wa.replace(/\*([^*]+)\*/g, '<span class="bold">$1</span>');
  document.getElementById('preview-output').innerHTML = html;
  switchTab('preview');
}

// ────────────────────────── RESET & TOAST UTILS ──────────────────────────
function resetForm() {
  if (!confirm('Reset semua isian?')) return;
  document.getElementById('inp-jam-mulai').value  = '08:00';
  document.getElementById('inp-jam-selesai').value= '';
  document.getElementById('inp-penyebab').value   = '';
  document.getElementById('inp-tindak').value     = '';
  selectedProjects.clear();
  document.getElementById('rekom-list').innerHTML = '';
  rekoms = [];
  renderChips();
  addRekom(); addRekom(); addRekom(); addRekom();
}

function showToast(msg = '✓') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═════════════ REKAP EXPORT & GAS RECAP ═════════════
const SCRIPT_URL = localStorage.getItem('shm_script_url') || 'https://script.google.com/macros/s/AKfycbx0PqBdhvnNm6kvz-HsrjmIQGj-_wDy19wgy_5zFLZBBAEM5KQ3QUzEtyxFHVJy5PE/exec';

async function pushGAS(action, payload) {
  if (!SCRIPT_URL) return;
  try {
    await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({ action, ...payload }) });
  } catch(e) { console.warn('GAS push fail', e); }
}

async function syncFromGAS() {
  if (!SCRIPT_URL) { showToast('⚠️ URL GAS belum diset'); return; }
  showToast('⏳ Memuat data cloud...');
  try {
    const res = await fetch(SCRIPT_URL + '?action=getLaporan');
    const data = await res.json();
    if (data && data.records) {
      localStorage.setItem(STORE_KEY, JSON.stringify(data.records));
      renderHistory();
      showToast('✓ ' + data.records.length + ' laporan berhasil dimuat');
    } else showToast('⚠️ Tidak ada data di cloud');
  } catch(e) { showToast('❌ Gagal sinkronisasi'); }
}

function getFilteredRecords() {
  const records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  const fp = document.getElementById('filter-project')?.value || '';
  const ff = document.getElementById('filter-from')?.value || '';
  const ft = document.getElementById('filter-to')?.value || '';
  return records.filter(r => {
    if (fp && !(r.projects||[]).includes(fp)) return false;
    if (ff && (r.tanggal||'') < ff) return false;
    if (ft && (r.tanggal||'') > ft) return false;
    return true;
  });
}

function copyFiltered() {
  const filtered = getFilteredRecords();
  if (!filtered.length) { showToast('⚠️ Tidak ada laporan untuk disalin'); return; }
  const fp = document.getElementById('filter-project').value;
  const ff = document.getElementById('filter-from').value;
  const ft = document.getElementById('filter-to').value;
  let head = `📋 KUMPULAN LAPORAN KETERLAMBATAN\nPT. SUMBER HAYATI MANDIRI\n`;
  if (fp) head += `Proyek: ${fp}\n`;
  if (ff || ft) head += `Periode: ${ff||'—'} s/d ${ft||'—'}\n`;
  head += `Total: ${filtered.length} laporan\n` + '═'.repeat(40) + '\n\n';
  const body = filtered.map((r,i) => `[ LAPORAN ${i+1} ]\n` + buildWAText(r))
                       .join('\n\n' + '─'.repeat(40) + '\n\n');
  navigator.clipboard.writeText(head + body)
    .then(() => showToast(`✓ ${filtered.length} laporan disalin`));
}

function exportFilteredPDF() {
  const filtered = getFilteredRecords();
  if (!filtered.length) { showToast('⚠️ Tidak ada laporan'); return; }
  const fp = document.getElementById('filter-project').value;
  const ff = document.getElementById('filter-from').value;
  const ft = document.getElementById('filter-to').value;
  const now = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  const win = window.open('', '_blank');
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rekap Laporan Keterlambatan</title>
    <style>body{font-family:'Plus Jakarta Sans',Arial,sans-serif;padding:20px;font-size:12px;color:#111}
    h1{font-size:15px;text-align:center;margin:0}
    h2{font-size:13px;text-align:center;margin:6px 0 14px;color:#1a3358}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}
    td{padding:5px 8px;border:1px solid #e5e7eb;vertical-align:top}
    td.k{background:#f9fafb;font-weight:700;width:28%}
    .meta{text-align:center;color:#666;font-size:11px;margin-bottom:14px}
    .card{border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:12px;page-break-inside:avoid}
    .pn{font-weight:700;color:#666;font-size:10px;margin-bottom:6px}
    .chip{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:20px;padding:1px 8px;font-size:10px;margin:1px}
    @media print{button{display:none}@page{margin:15mm}}
    </style></head><body>
    <h1>PT. SUMBER HAYATI MANDIRI</h1>
    <h2>LAPORAN KETERLAMBATAN PELAKSANAAN PEKERJAAN</h2>
    <div class="meta">
      ${fp?`Proyek: ${fp}<br>`:''}
      ${(ff||ft)?`Periode: ${ff||'—'} s/d ${ft||'—'}<br>`:''}
      Dicetak: ${now} · ${filtered.length} laporan
    </div>`;
  filtered.forEach((r,i) => {
    const tgl = r.tanggal ? formatTanggal(r.tanggal) : '—';
    const waktu = r.jamMulai ? r.jamMulai + (r.jamSelesai?' - '+r.jamSelesai:'') + ' WITA' : '—';
    const chips = (r.projects||[]).map(p=>`<span class="chip">${p}</span>`).join(' ');
    const rekomsHTML = (r.rekomList||[]).map(x=>`<li>${x}</li>`).join('') || '<li>—</li>';
    html += `<div class="card">
      <div class="pn">LAPORAN ${i+1} · 📅 ${tgl} · ⏱ ${waktu}</div>
      <div style="margin-bottom:6px">${chips}</div>
      <table>
        <tr><td class="k">1. Proyek</td><td>${(r.projects||[]).join(', ')||'—'}</td></tr>
        <tr><td class="k">2. Waktu</td><td>${waktu}</td></tr>
        <tr><td class="k">3. Penyebab</td><td>${r.penyebab||'—'}</td></tr>
        <tr><td class="k">4. Rekomendasi</td><td><ul style="margin:0;padding-left:14px">${rekomsHTML}</ul></td></tr>
        <tr><td class="k">5. Tindak Lanjut</td><td>${r.tindak||'—'}</td></tr>
      </table></div>`;
  });
  html += `<div style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 24px;background:#1d4ed8;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer">🖨️ Print / Save PDF</button>
  </div></body></html>`;
  win.document.write(html); win.document.close();
  setTimeout(()=>win.print(), 600);
}

// EKSPOS FUNGSI KE LEVEL WINDOW AGAR DAPAT DIAKSES OLEH EVENT ONCLICK INLINE DI HTML
window.switchTab = switchTab;
window.addProject = addProject;
window.addRekom = addRekom;
window.generateAIRekom = generateAIRekom;
window.goPreview = goPreview;
window.copyWA = copyWA;
window.saveReport = saveReport;
window.resetForm = resetForm;
window.renderHistory = renderHistory;
window.copyFiltered = copyFiltered;
window.exportFilteredPDF = exportFilteredPDF;
window.syncFromGAS = syncFromGAS;
