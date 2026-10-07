import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

let TENANT_ID = null, WEEK_START = null, WEEK_END = null;

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
  document.getElementById('weekRange').textContent =
    `${formatDate(WEEK_START)} — ${formatDate(WEEK_END)}`;
  await loadSettlement();
}

async function loadSettlement() {
  const listEl = document.getElementById('workerList');

  const { data: entries, error: eErr } = await supabase
    .from('production_entries').select('worker_id, pairs, rate_per_pair')
    .gte('entry_date', WEEK_START).lte('entry_date', WEEK_END);
  if (eErr) { listEl.innerHTML = `<p class="empty" style="color:red;">${eErr.message}</p>`; return; }

  const { data: advances } = await supabase
    .from('advances').select('worker_id, amount, settlement_id')
    .gte('given_at', WEEK_START).lte('given_at', WEEK_END);

  const { data: workers } = await supabase
    .from('workers').select('id, name, code, base_rate')
    .eq('active', true).order('name');

  if (!workers || workers.length === 0) {
    listEl.innerHTML = `<div class="empty">এখনো কোনো কর্মী নেই</div>`;
    return;
  }

  const byWorker = {};
  (entries || []).forEach(e => {
    if (!byWorker[e.worker_id]) byWorker[e.worker_id] = { pairs: 0, gross: 0, advance: 0 };
    byWorker[e.worker_id].pairs += e.pairs;
    byWorker[e.worker_id].gross += e.pairs * Number(e.rate_per_pair);
  });
  (advances || []).forEach(a => {
    if (!byWorker[a.worker_id]) byWorker[a.worker_id] = { pairs: 0, gross: 0, advance: 0 };
    if (!a.settlement_id) byWorker[a.worker_id].advance += Number(a.amount);
  });

  let totalPairs = 0, totalGross = 0, totalNet = 0, html = '', hasData = false;

  workers.forEach(w => {
    const d = byWorker[w.id] || { pairs: 0, gross: 0, advance: 0 };
    const net = d.gross - d.advance;
    totalPairs += d.pairs; totalGross += d.gross; totalNet += net;
    if (d.pairs > 0 || d.advance > 0) hasData = true;

    html += `<div class="worker-row">
        <div class="name">${w.name} <span style="color:#6c757d;font-size:12px;">(${w.code})</span></div>
        <div>${d.pairs}</div>
        <div class="hide-mobile">৳${d.gross.toFixed(0)}</div>
        <div class="hide-mobile" style="color:#dc3545;">${d.advance > 0 ? '-৳' + d.advance.toFixed(0) : '—'}</div>
        <div class="net" style="color:${net < 0 ? '#dc3545' : '#198754'};">৳${net.toFixed(0)}</div>
      </div>`;
  });

  listEl.innerHTML = hasData ? html : `<div class="empty">এই সপ্তাহে এখনো কোনো এন্ট্রি হয়নি</div>`;

  document.getElementById('totalPairs').textContent = totalPairs;
  document.getElementById('totalGross').textContent = '৳' + totalGross.toFixed(0);
  document.getElementById('totalNet').textContent = '৳' + totalNet.toFixed(0);

  const btn = document.getElementById('approveBtn');
  if (hasData) {
    btn.style.display = 'block';
    btn.onclick = () => approveSettlement(workers, byWorker);
  }
}

async function approveSettlement(workers, byWorker) {
  if (!confirm('সেটেলমেন্ট Approve করবেন?')) return;
  const btn = document.getElementById('approveBtn');
  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে...';

  // আগে চেক করুন এই সপ্তাহের সেটেলমেন্ট আছে কিনা
  const { data: existing } = await supabase
    .from('settlements')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('week_start', WEEK_START)
    .maybeSingle();

  let settle;

  if (existing) {
    // আগে থাকলে আপডেট করুন
    const { data, error } = await supabase
      .from('settlements')
      .update({
        week_end: WEEK_END,
        status: 'approved',
        approved_by: session.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      alert('সমস্যা: ' + error.message);
      btn.disabled = false;
      btn.textContent = '✅ Approve করুন';
      return;
    }
    settle = data;

    // পুরনো আইটেম মুছে ফেলুন
    await supabase.from('settlement_items').delete().eq('settlement_id', settle.id);

    // অ্যাডভান্সের settlement_id রিসেট করুন
    await supabase.from('advances')
      .update({ settlement_id: null })
      .eq('settlement_id', settle.id);
  } else {
    // না থাকলে নতুন তৈরি করুন
    const { data, error } = await supabase
      .from('settlements')
      .insert({
        tenant_id: TENANT_ID,
        week_start: WEEK_START,
        week_end: WEEK_END,
        status: 'approved',
        approved_by: session.user.id,
        approved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      alert('সমস্যা: ' + error.message);
      btn.disabled = false;
      btn.textContent = '✅ Approve করুন';
      return;
    }
    settle = data;
  }

  // আইটেম তৈরি করুন
  const items = workers.map(w => {
    const d = byWorker[w.id];
    if (!d || (d.pairs === 0 && d.advance === 0)) return null;
    return {
      settlement_id: settle.id,
      worker_id: w.id,
      pairs: d.pairs,
      gross: d.gross,
      advance_deducted: d.advance,
      net_payable: d.gross - d.advance
    };
  }).filter(Boolean);

  if (items.length > 0) {
    const { error: iErr } = await supabase.from('settlement_items').insert(items);
    if (iErr) {
      alert('আইটেম সেভে সমস্যা: ' + iErr.message);
      btn.disabled = false;
      btn.textContent = '✅ Approve করুন';
      return;
    }
  }

  // অ্যাডভান্সে settlement_id বসান
  await supabase.from('advances')
    .update({ settlement_id: settle.id })
    .gte('given_at', WEEK_START)
    .lte('given_at', WEEK_END)
    .is('settlement_id', null);

  alert('✅ সেটেলমেন্ট Approve হয়েছে!');
  btn.textContent = '✅ Approved';
}

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = '/index.html';
});

init();