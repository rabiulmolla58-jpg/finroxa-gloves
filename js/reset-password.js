import { supabase } from './supabase.js';

const form = document.getElementById('newPasswordForm');
const btn = document.getElementById('saveBtn');
const alertBox = document.getElementById('alertBox');

function showAlert(msg, type = 'error') {
  alertBox.className = 'alert alert-' + type + ' show';
  alertBox.textContent = msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.className = 'alert';

  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword.length < 6) {
    showAlert('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
    return;
  }
  if (newPassword !== confirmPassword) {
    showAlert('দুইটা পাসওয়ার্ড মিলছে না');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'সেভ হচ্ছে...';

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    showAlert(error.message);
    btn.disabled = false;
    btn.textContent = 'পাসওয়ার্ড সেভ করুন';
    return;
  }

  showAlert('✅ পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! লগইনে যাচ্ছি...', 'success');
  setTimeout(() => {
    supabase.auth.signOut();
    location.href = '/index.html';
  }, 2000);
});