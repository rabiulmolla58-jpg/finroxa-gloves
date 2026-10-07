import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

const listEl = document.getElementById('workerList');
const countEl = document.getElementById('workerCount');

let EDIT_ID = null;
let DELETE_ID = null;

// ═══════════════════════════════════════
// লগআউট
// ═══════════════════════════════════════
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = '/index.html';
});

// ═══════════════════════════════════════
// কর্মী লোড করা
// ═══════════════════════════════════════
async function loadWorkers() {
  const { data: workers, error } = await supabase
    .from('workers').select('*').order('code', { ascending: true });

  if (error) {
    listEl.innerHTML = '<p style="color:red;">' + error.message + '</p>';
    return;
  }

  countEl.textContent = workers.length;

  if (workers.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:#6c757d;">এখনো কোনো কর্মী যোগ করা হয়নি।</p>';
    return;
  }

  listEl.innerHTML = workers.map(w => `
    <div class="worker-card">
      <div class="worker-info">
        <h4>${w.name}</h4>
        <p>কোড: ${w.code} | রেট: ৳${w.base_rate}/pair${w.phone ? ' | 📱 ' + w.phone : ''}</p>
      </div>
      <div class="worker-actions">
        <button class="action-btn btn-edit" data-action="edit" data-id="${w.id}">✏️</button>
        <button class="action-btn btn-del" data-action="del" data-id="${w.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  // ইভেন্ট হ্যান্ডলার বসানো
  listEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const w = workers.find(x => x.id === id);
      if (!w) return;

      if (btn.dataset.action === 'edit') openEdit(w);
      else if (btn.dataset.action === 'del') openDelete(w);
    });
  });
}

// ═══════════════════════════════════════
// নতুন কর্মী যোগ
// ═══════════════════════════════════════
document.getElementById('addWorkerBtn').addEventListener('click', async () => {
  const name = document.getElementById('workerName').value.trim();
  const code = document.getElementById('workerCode').value.trim();
  const rate = parseFloat(document.getElementById('workerRate').value);
  const phone = document.getElementById('workerPhone').value.trim();

  if (!name || !code) { alert('নাম এবং কোড দিন'); return; }
  if (!rate || rate <= 0) { alert('সঠিক রেট দিন'); return; }

  const { data: user } = await supabase
    .from('users').select('tenant_id').eq('id', session.user.id).single();

  if (!user) { alert('ইউজার তথ্য পাওয়া যায়নি'); return; }

  const { error } = await supabase.from('workers').insert({
    tenant_id: user.tenant_id,
    name: name,
    code: code,
    base_rate: rate,
    phone: phone || null
  });

  if (error) {
    alert('সমস্যা: ' + error.message);
    return;
  }

  document.getElementById('workerName').value = '';
  document.getElementById('workerCode').value = '';
  document.getElementById('workerRate').value = '15';
  document.getElementById('workerPhone').value = '';

  await loadWorkers();
  showToast('✅ কর্মী যোগ হয়েছে');
});

// ═══════════════════════════════════════
// Edit Modal
// ═══════════════════════════════════════
function openEdit(w) {
  EDIT_ID = w.id;
  document.getElementById('editName').value = w.name || '';
  document.getElementById('editCode').value = w.code || '';
  document.getElementById('editRate').value = w.base_rate || '';
  document.getElementById('editPhone').value = w.phone || '';
  document.getElementById('editModal').classList.add('show');
}

document.getElementById('editCancel').addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('show');
  EDIT_ID = null;
});

document.getElementById('editSave').addEventListener('click', async () => {
  if (!EDIT_ID) return;

  const name = document.getElementById('editName').value.trim();
  const code = document.getElementById('editCode').value.trim();
  const rate = parseFloat(document.getElementById('editRate').value);
  const phone = document.getElementById('editPhone').value.trim();

  if (!name || !code) { alert('নাম এবং কোড দিন'); return; }
  if (!rate || rate <= 0) { alert('সঠিক রেট দিন'); return; }

  const { error } = await supabase.from('workers').update({
    name: name,
    code: code,
    base_rate: rate,
    phone: phone || null
  }).eq('id', EDIT_ID);

  if (error) {
    alert('সমস্যা: ' + error.message);
    return;
  }

  document.getElementById('editModal').classList.remove('show');
  EDIT_ID = null;
  await loadWorkers();
  showToast('✅ আপডেট হয়েছে');
});

// ═══════════════════════════════════════
// Delete Modal
// ═══════════════════════════════════════
function openDelete(w) {
  DELETE_ID = w.id;
  document.getElementById('deleteText').textContent =
    `"${w.name}" (কোড: ${w.code}) কে ডিলিট করবেন?`;
  document.getElementById('deleteModal').classList.add('show');
}

document.getElementById('delCancel').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.remove('show');
  DELETE_ID = null;
});

document.getElementById('delConfirm').addEventListener('click', async () => {
  if (!DELETE_ID) return;

  // Cascade: production_entries এবং advances ডিলিট হবে
  // (workers টেবিলে ON DELETE CASCADE আছে)
  const { error } = await supabase
    .from('workers').delete().eq('id', DELETE_ID);

  if (error) {
    alert('সমস্যা: ' + error.message);
    return;
  }

  document.getElementById('deleteModal').classList.remove('show');
  DELETE_ID = null;
  await loadWorkers();
  showToast('🗑️ ডিলিট হয়েছে');
});

// ═══════════════════════════════════════
// Toast helper
// ═══════════════════════════════════════
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════
loadWorkers();