import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

const SIGNATURE = localStorage.getItem('manager_signature');

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return {
    start: sunday.toISOString().slice(0, 10),
    end: saturday.toISOString().slice(0, 10)
  };
}

function formatDate(d) {
  const date = new Date(d);
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function signatureHtml() {
  if (SIGNATURE) {
    return `<img src="${SIGNATURE}" alt="signature" />`;
  }
  return '';
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
async function init() {
  const { data: user } = await supabase
    .from('users').select('tenant_id, tenants(name)')
    .eq('id', session.user.id).maybeSingle();

  if (!user || !user.tenant_id) {
    document.getElementById('slipContainer').innerHTML =
      '<div class="empty">ইউজার সেটআপে সমস্যা</div>';
    return;
  }

  const factoryName = user.tenants?.name || 'Finroxa Gloves';
  const range = getWeekRange();

  const { data: entries } = await supabase
    .from('production_entries').select('worker_id, pairs, rate_per_pair')
    .gte('entry_date', range.start).lte('entry_date', range.end);

  const { data: advances } = await supabase
    .from('advances').select('worker_id, amount, settlement_id')
    .gte('given_at', range.start).lte('given_at', range.end);

  const { data: workers } = await supabase
    .from('workers').select('id, name, code, base_rate, phone')
    .eq('active', true).order('name');

  if (!workers || workers.length === 0) {
    document.getElementById('slipContainer').innerHTML =
      '<div class="empty">এখনো কোনো কর্মী নেই</div>';
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

  const slips = workers.map(w => {
    const d = byWorker[w.id] || { pairs: 0, gross: 0, advance: 0 };
    if (d.pairs === 0 && d.advance === 0) return null;
    return {
      worker: w,
      pairs: d.pairs,
      gross: d.gross,
      advance: d.advance,
      net: d.gross - d.advance
    };
  }).filter(Boolean);

  if (slips.length === 0) {
    document.getElementById('slipContainer').innerHTML =
      '<div class="empty">এই সপ্তাহে কারো কোনো কাজ নেই।</div>';
    return;
  }

  document.getElementById('slipContainer').innerHTML = slips.map((s, idx) => `
    <div class="slip-card" id="slip-${idx}">
      <div class="slip-header">
        <h1>${factoryName}</h1>
        <p>সাপ্তাহিক পেমেন্ট স্লিপ</p>
        <div class="week">সপ্তাহ: ${formatDate(range.start)} — ${formatDate(range.end)}</div>
      </div>

      <div class="info-row">
        <span class="label">কর্মীর নাম</span>
        <span class="value">${s.worker.name}</span>
      </div>
      <div class="info-row">
        <span class="label">কর্মী কোড</span>
        <span class="value">${s.worker.code}</span>
      </div>
      <div class="info-row">
        <span class="label">মোট pair</span>
        <span class="value">${s.pairs} pair</span>
      </div>
      <div class="info-row">
        <span class="label">পিস রেট</span>
        <span class="value">৳${s.worker.base_rate} / pair</span>
      </div>
      <div class="info-row">
        <span class="label">মোট আয়</span>
        <span class="value">৳${s.gross.toFixed(0)}</span>
      </div>
      ${s.advance > 0 ? `
      <div class="info-row">
        <span class="label">অ্যাডভান্স (বাদ)</span>
        <span class="value" style="color:#dc3545;">− ৳${s.advance.toFixed(0)}</span>
      </div>` : ''}

      <div class="amount-box">
        <div class="label">প্রাপ্য টাকা</div>
        <div class="value">৳ ${s.net.toFixed(0)}</div>
      </div>

      <div class="signature">
        <div>কর্মীর স্বাক্ষর</div>
        <div>${signatureHtml()}ম্যানেজারের স্বাক্ষর</div>
      </div>

      <div class="footer-note">
        স্লিপ তৈরি: ${formatDate(new Date())} • Finroxa Gloves
      </div>

      <div class="share-bar no-print">
        <button class="share-btn share-wa" onclick="shareToWhatsApp(${idx}, '${s.worker.name}', '${s.worker.phone || ''}', ${s.net.toFixed(0)})">
          📱 WhatsApp-এ পাঠান
        </button>
        <button class="share-btn share-pdf" onclick="downloadSlipPDF(${idx}, '${s.worker.name}')">
          ⬇️ PDF ডাউনলোড
        </button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════
// PDF ডাউনলোড
// ═══════════════════════════════════════
window.downloadSlipPDF = async function(idx, workerName) {
  const el = document.getElementById(`slip-${idx}`);
  const shareBar = el.querySelector('.share-bar');
  shareBar.style.display = 'none';

  try {
    const pdfBlob = await html2pdf().set({
      margin: 10,
      filename: `payslip-${workerName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).outputPdf('blob');

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${workerName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('PDF বানাতে সমস্যা: ' + err.message);
  } finally {
    shareBar.style.display = 'flex';
  }
};

// ═══════════════════════════════════════
// WhatsApp Share
// ═══════════════════════════════════════
window.shareToWhatsApp = async function(idx, workerName, phone, amount) {
  // ১. ফোন নাম্বার চেক
  if (!phone || !phone.trim()) {
    alert(`⚠️ ${workerName}-এর ফোন নম্বর নেই।\n\n"কর্মী" পেজে গিয়ে তার নম্বর যোগ করুন।`);
    return;
  }

    // ২. ফোন নম্বর ক্লিন
  let cleanPhone = phone.replace(/\D/g, '');
  let waPhone;

  if (cleanPhone.length === 10) {
    // ১০ ডিজিট = ভারতের নম্বর → 91 যোগ করুন
    waPhone = '91' + cleanPhone;
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
    // ১১ ডিজিট, 0 দিয়ে শুরু = বাংলাদেশ → 880 যোগ করুন
    waPhone = '880' + cleanPhone.slice(1);
  } else {
    // অন্য কিছু হলে সরাসরি
    waPhone = cleanPhone;
  }

  // ৩. WhatsApp সাথে সাথে খুলুন (Popup Blocker এড়াতে)
  const message = encodeURIComponent(
    `প্রিয় ${workerName}, আপনার এই সপ্তাহের পেমেন্ট স্লিপ (৳${amount}) পাঠানো হলো।`
  );
  const waUrl = `https://wa.me/${waPhone}?text=${message}`;
  const waWindow = window.open(waUrl, '_blank');

  if (!waWindow) {
    alert('❌ ব্রাউজার নতুন ট্যাব ব্লক করেছে।\n\nপপআপ ব্লকার বন্ধ করুন এবং আবার চেষ্টা করুন।');
    return;
  }

  // ৪. PDF তৈরি ও ডাউনলোড
  const el = document.getElementById(`slip-${idx}`);
  const shareBar = el.querySelector('.share-bar');
  shareBar.style.display = 'none';

  try {
    const pdfBlob = await html2pdf().set({
      margin: 10,
      filename: `payslip-${workerName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).outputPdf('blob');

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${workerName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    setTimeout(() => {
      alert(
        `✅ WhatsApp খুলেছে।\n\n` +
        `📄 PDF ফাইল "${workerName}.pdf" নামে ডাউনলোড হয়েছে।\n\n` +
        `এখন:\n` +
        `১. WhatsApp চ্যাটে 📎 ক্লিক করুন\n` +
        `২. "Document" সিলেক্ট করুন\n` +
        `৩. ডাউনলোড করা PDF পাঠান`
      );
    }, 800);

  } catch (err) {
    alert('PDF বানাতে সমস্যা: ' + err.message);
  } finally {
    shareBar.style.display = 'flex';
  }
};

// প্রিন্ট
document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

init();