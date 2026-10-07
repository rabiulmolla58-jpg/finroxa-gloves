import { supabase } from './supabase.js';

const form = document.getElementById('resetForm');
const btn = document.getElementById('resetBtn');
const alertBox = document.getElementById('alertBox');

function showAlert(msg, type = 'error') {
  alertBox.className = 'alert alert-' + type + ' show';
  alertBox.textContent = msg;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.className = 'alert';

  const email = document.getElementById('email').value.trim();

  if (!email) {
    showAlert('ইমেইল দিন');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'পাঠানো হচ্ছে...';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://app.finroxa.space/reset-password.html'
  });

  btn.disabled = false;
  btn.textContent = 'রিসেট লিংক পাঠান';

  if (error) {
    showAlert(error.message);
    return;
  }

  showAlert('✅ ইমেইল পাঠানো হয়েছে। ইনবক্স ও Spam ফোল্ডার চেক করুন।', 'success');
  form.reset();
});