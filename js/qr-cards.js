import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

async function loadCards() {
  const gridEl = document.getElementById('cardsGrid');

  // কারখানার নাম
  const { data: user } = await supabase
    .from('users').select('tenants(name)')
    .eq('id', session.user.id).maybeSingle();
  const factoryName = user?.tenants?.name || 'Finroxa Gloves';

  // সব কর্মী
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
    gridEl.innerHTML = '<div class="empty">এখনো কোনো কর্মী নেই। আগে কর্মী যোগ করুন।</div>';
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
    `;
    gridEl.appendChild(card);

    // QR তৈরি
    QRCode.toCanvas(w.code, { width: 130, margin: 1 }, (err, canvas) => {
      if (!err) {
        document.getElementById(`qr-${w.id}`).appendChild(canvas);
      } else {
        console.error('QR error:', err);
      }
    });
  });
}

document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

loadCards();