import { supabase } from './supabase.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const { data: { session } } = await supabase.auth.getSession();
if (session) { location.href = '/app.html'; }

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');
const alertBox = document.getElementById('alertBox');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.className = 'alert';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled = true;
  btn.textContent = 'লগইন হচ্ছে...';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alertBox.className = 'alert alert-error show';
    alertBox.textContent = error.message === 'Invalid login credentials'
      ? 'ভুল ইমেইল বা পাসওয়ার্ড' : error.message;
    btn.disabled = false;
    btn.textContent = 'লগইন করুন';
    return;
  }

  alertBox.className = 'alert alert-success show';
  alertBox.textContent = 'সফল! ঢুকছি...';
  setTimeout(() => location.href = '/app.html', 400);
});