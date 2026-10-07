import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

let TENANT_ID = null, ALL_WORKERS = [], WEEK_START = null, WEEK_END = null;

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { start: sunday.toISOString().slice(0, 10), end: saturday.toISOString().slice(0, 10) };
}

function formatDate(d) {
  const date = new Date(d);
  const months = ['জানু','ফেব','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্ট','অক্টো','নভে','ডিসে'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

async function init() {
  const { data: user } = await supabase
    .from('users').select('tenant_id').eq('id', session.user.id).maybeSingle();
  if (!user || !user.tenant_id) { alert('ইউজার সেটআপে সমস্যা'); return; }
  TENANT_ID = user.tenant_id;

  const range = getWeekRange();
  WEEK_START = range.start; WEEK_END = range.end;

  const { data: workers } = await supabase
    .from('workers').select('id, name, code').eq('active', true).order('name');
  ALL_WORKERS = workers || [];

  const select = document.getElementById('workerSelect');
  ALL_WORKERS.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.code})`;
    select.appendChild(opt);
  });

  await loadAdvances();
}

async function loadAdvances() {
  const { data, error } = await supabase
    .from('advances').select('id, worker_id, amount, given_at, reason')
    .gte('given_at', WEEK_START).lte('given_at', WEEK_END)
    .order('given_at', { ascending: false });

  const listEl = document.getElementById('advanceList');
  if (error) { listEl.innerHTML = `<p class="empty" style="color:red;">${error.message}</p>`; return; }

  const advances = data || [];
  const total = advances.reduce((s, a) => s + Number(a.amount), 0);
  document.getElementById('totalAdvance').textContent = '৳' + total;

  if (advances.length === 0) {
    listEl.innerHTML = `<p class="empty">এই সপ্তাহে কোনো অ্যাডভান্স নেই</p>`;
    return;
  }

  listEl.innerHTML = advances.map(a => {
    const w = ALL_WORKERS.find(x => x.id === a.worker_id);
    return `<div class="advance-item">
        <div>
          <div>${w ? w.name : '?'} ${a.reason ? '— ' + a.reason : ''}</div>
          <div class="date">${formatDate(a.given_at)}</div>
        </div>
        <div class="amount">৳${Number(a.amount).toFixed(0)}</div>
      </div>`;
  }).join('');
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const workerId = document.getElementById('workerSelect').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const reason = document.getElementById('reason').value.trim();

  if (!workerId) { alert('কর্মী সিলেক্ট করুন'); return; }
  if (!amount || amount <= 0) { alert('সঠিক টাকার পরিমাণ দিন'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে...';

  const { error } = await supabase.from('advances').insert({
    tenant_id: TENANT_ID, worker_id: workerId, amount: amount,
    reason: reason || null, given_at: new Date().toISOString().slice(0, 10)
  });

  btn.disabled = false;
  btn.textContent = '💸 অ্যাডভান্স দিন';
  if (error) { alert('সমস্যা: ' + error.message); return; }

  document.getElementById('amount').value = '';
  document.getElementById('reason').value = '';
  document.getElementById('workerSelect').value = '';
  await loadAdvances();
  alert('✅ অ্যাডভান্স সেভ হয়েছে');
});

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = '/index.html';
});

init();