import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

let TENANT_ID = null;
let ALL_WORKERS = [];
let SELECTED_WORKER = null;
let SCANNER = null;
let SCANNER_ACTIVE = false;

async function init() {
  const { data: user } = await supabase
    .from('users').select('tenant_id').eq('id', session.user.id).maybeSingle();
  if (!user || !user.tenant_id) { alert('ইউজার সেটআপে সমস্যা'); return; }
  TENANT_ID = user.tenant_id;

  const { data: workers } = await supabase
    .from('workers').select('id, name, code, base_rate')
    .eq('active', true).order('name');
  ALL_WORKERS = workers || [];

  await loadTodayEntries();
  setupScanButton();
  setupCodeInput();
  setupSaveButton();
  setupLogout();
}

function setupScanButton() {
  document.getElementById('scanBtn').addEventListener('click', toggleScanner);
}

async function toggleScanner() {
  const readerEl = document.getElementById('reader');
  const scanBtn = document.getElementById('scanBtn');

  if (SCANNER_ACTIVE) { await stopScanner(); return; }

  readerEl.classList.add('show');
  scanBtn.textContent = '⏹️ স্ক্যান বন্ধ করুন';

  SCANNER = new Html5Qrcode("reader");
  try {
    await SCANNER.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      () => {}
    );
    SCANNER_ACTIVE = true;
  } catch (err) {
    alert('ক্যামেরা চালু করা যায়নি। অনুমতি দিন বা ম্যানুয়ালি ID লিখুন।');
    readerEl.classList.remove('show');
    scanBtn.textContent = '📷 QR স্ক্যান করুন';
    SCANNER = null;
  }
}

async function onScanSuccess(decodedText) {
  await stopScanner();
  await selectWorkerByCode(decodedText.trim());
}

async function stopScanner() {
  if (SCANNER && SCANNER_ACTIVE) {
    try { await SCANNER.stop(); } catch (e) {}
    document.getElementById('reader').classList.remove('show');
    document.getElementById('scanBtn').textContent = '📷 QR স্ক্যান করুন';
    SCANNER_ACTIVE = false;
    SCANNER = null;
  }
}

function setupCodeInput() {
  const codeInput = document.getElementById('codeInput');
  const findBtn = document.getElementById('findBtn');

  findBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (code) selectWorkerByCode(code);
  });

  codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const code = codeInput.value.trim();
      if (code) selectWorkerByCode(code);
    }
  });
}

async function selectWorkerByCode(code) {
  const worker = ALL_WORKERS.find(w =>
    w.code.toUpperCase() === code.toUpperCase()
  );

  if (!worker) {
    alert(`"${code}" কোডে কোনো কর্মী পাওয়া যায়নি`);
    return;
  }

  SELECTED_WORKER = worker;
  document.getElementById('previewName').textContent = worker.name;
  document.getElementById('previewRate').textContent =
    `কোড: ${worker.code} | রেট: ৳${worker.base_rate}/pair`;
  document.getElementById('workerPreview').classList.add('show');
  document.getElementById('saveBtn').disabled = false;
  document.getElementById('codeInput').value = '';
  document.getElementById('pairs').focus();
}

function setupSaveButton() {
  document.getElementById('saveBtn').addEventListener('click', async () => {
    if (!SELECTED_WORKER) { alert('আগে কর্মী নির্বাচন করুন'); return; }

    const pairs = parseInt(document.getElementById('pairs').value);
    const rejects = parseInt(document.getElementById('rejects').value) || 0;

    if (!pairs || pairs <= 0) { alert('সঠিক pair সংখ্যা দিন'); return; }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'সেভ হচ্ছে...';

    const { error } = await supabase.from('production_entries').insert({
      tenant_id: TENANT_ID,
      worker_id: SELECTED_WORKER.id,
      pairs: pairs,
      rejects: rejects,
      rate_per_pair: SELECTED_WORKER.base_rate,
      entry_date: new Date().toISOString().slice(0, 10),
      entered_by: session.user.id
    });

    if (error) {
      alert('সমস্যা: ' + error.message);
      btn.disabled = false;
      btn.textContent = '✅ সেভ করুন';
      return;
    }

    showToast(`✅ ${SELECTED_WORKER.name} — ${pairs} pair`);

    document.getElementById('pairs').value = '';
    document.getElementById('rejects').value = '0';
    document.getElementById('workerPreview').classList.remove('show');
    document.getElementById('codeInput').value = '';
    SELECTED_WORKER = null;
    btn.textContent = '✅ সেভ করুন';
    btn.disabled = true;

    await loadTodayEntries();
    document.getElementById('codeInput').focus();
  });
}

async function loadTodayEntries() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('production_entries')
    .select('pairs, rejects, rate_per_pair, created_at, worker_id')
    .eq('entry_date', today)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('todayList');
  const summaryEl = document.getElementById('summary');

  if (error) { listEl.innerHTML = '<p style="color:red;">' + error.message + '</p>'; return; }

  const entries = data || [];
  const total = entries.reduce((s, e) => s + e.pairs, 0);
  summaryEl.innerHTML = `আজকের মোট: <strong>${total}</strong> pair`;

  if (entries.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:#6c757d;">আজ এখনো কোনো এন্ট্রি হয়নি</p>';
    return;
  }

  listEl.innerHTML = entries.map(e => {
    const w = ALL_WORKERS.find(x => x.id === e.worker_id);
    const time = new Date(e.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
    return `<div class="entry-item">
        <span>${w ? w.name : '?'} — ${e.pairs} pair</span>
        <span class="time">${time}</span>
      </div>`;
  }).join('');
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 30px; left: 50%;
    transform: translateX(-50%);
    background: #198754; color: white;
    padding: 14px 24px; border-radius: 10px;
    font-weight: 600; z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    font-family: inherit; font-size: 15px;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await stopScanner();
    await supabase.auth.signOut();
    location.href = '/index.html';
  });
}

init();sss