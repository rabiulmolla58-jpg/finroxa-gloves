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

    // QR তৈরি (নতুন লাইব্রেরি দিয়ে)
    new QRCode(document.getElementById(`qr-${w.id}`), {
      text: w.code,
      width: 130,
      height: 130,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  });
}

document.getElementById('printBtn').addEventListener('click', () => {
  window.print();
});

loadCards();