import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

try {
  const { data: userRow } = await supabase
    .from('users').select('name, role')
    .eq('id', session.user.id).maybeSingle();

  document.getElementById('userName').textContent = userRow
    ? (userRow.name || 'ইউজার') + ' (' + (userRow.role || '') + ')'
    : session.user.email + ' (owner)';
} catch (e) {
  document.getElementById('userName').textContent = session.user.email;
}

try {
  const { count: workerCount } = await supabase
    .from('workers').select('*', { count: 'exact', head: true });
  document.getElementById('workerCount').textContent = workerCount ?? 0;
} catch (e) { document.getElementById('workerCount').textContent = '0'; }

try {
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayData } = await supabase
    .from('production_entries').select('pairs').eq('entry_date', today);
  const total = (todayData || []).reduce((s, r) => s + r.pairs, 0);
  document.getElementById('todayPairs').textContent = total;
} catch (e) { document.getElementById('todayPairs').textContent = '0'; }

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.href = '/index.html';
});