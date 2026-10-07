import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

async function loadCards() {
  const gridEl = document.getElementById('cardsGrid');

  const { data: user } = await supabase
    .from('users').select('tenants(name)')
    .eq('id', session.user.id).maybeSingle();
  const factoryName = user?.tenants?.name || 'Finroxa Gloves';

  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, code, base_rate')
    .eq('active', true)
    .order('code');

  if (error) {
    gridEl.innerHTML = `<p style="color:red;text-align:center;">${error.message}</p>`;
    return;
  }

  if (!workers || workers.length === 0) {
    gridEl.innerHTML = '<div class="empty">এখনো কোনো কর্মী নেই।</div>';
    return;
  }

  gridEl.innerHTML = '';

  workers.forEach(w => {
    const card = document.createElement('div');
    card.className = 'worker-card-print';
    card.innerHTML = `
      <div class="factory">${factoryName.toUpperCase()}</div>
      <div class="qr-box" id="qr-${w.id}"></div>
      <div class="name">${w.name}</div>
      <div class="code">${w.code}</div>
      <button class="download-btn no-print" data-worker="${w.name}" data-qr="qr-${w.id}">
        ⬇️ ডাউনলোড করুন
      </button>
    `;
    gridEl.appendChild(card);

    new QRCode(document.getElementById(`qr-${w.id}`), {
      text: w.code,
      width: 150,
      height: 150,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  });

  // ডাউনলোড বাটনে ক্লিক হ্যান্ডলার
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const qrId = this.dataset.qr;
      const workerName = this.dataset.worker;
      downloadQR(qrId, workerName);
    });
  });
}

// QR ডাউনলোড ফাংশন
function downloadQR(qrId, workerName) {
  const qrBox = document.getElementById(qrId);
  if (!qrBox) {
    alert('QR বক্স পাওয়া যায়নি');
    return;
  }

  const canvas = qrBox.querySelector('canvas');
  const img = qrBox.querySelector('img');

  let dataUrl = null;

  // ১. Canvas থেকে চেষ্টা
  if (canvas) {
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Canvas error:', err);
    }
  }

  // ২. img থেকে চেষ্টা
  if (!dataUrl && img && img.src) {
    dataUrl = img.src;
  }

  // ৩. কিছুই না পেলে
  if (!dataUrl) {
    alert('QR ছবি পাওয়া যায়নি। বাম দিকের QR-এর উপর রাইট-ক্লিক করে "Save image as..." করুন।');
    return;
  }

  // ডাউনলোড
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${workerName}-QR.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // ছোট notification
  showToast(`✅ ${workerName}-QR.png ডাউনলোড হয়েছে`);
}

// ছোট notification
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
  setTimeout(() => toast.remove(), 2500);
}

document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

loadCards();