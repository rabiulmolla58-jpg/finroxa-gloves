import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/index.html'; }

// লগআউট
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  location.href = '/index.html';
});

// ═══════════════════════════════════════
// সিগনেচার Canvas সেটআপ
// ═══════════════════════════════════════
const canvas = document.getElementById('sigCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let hasDrawn = false;

// Canvas সাইজ ঠিক করা (রেটিনা ডিসপ্লের জন্য)
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

resizeCanvas();

// পজিশন বের করা (touch + mouse both)
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

// শুরু
function startDraw(e) {
  e.preventDefault();
  isDrawing = true;
  hasDrawn = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

// চলমান
function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

// শেষ
function endDraw(e) {
  if (!isDrawing) return;
  isDrawing = false;
  ctx.closePath();
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', endDraw);

// ═══════════════════════════════════════
// সেভ/লোড/ডিলিট
// ═══════════════════════════════════════
const STORAGE_KEY = 'manager_signature';

function loadSignature() {
  const dataUrl = localStorage.getItem(STORAGE_KEY);
  const preview = document.getElementById('sigPreview');

  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="Signature" />`;
  } else {
    preview.innerHTML = `<div class="empty-text">এখনো সিগনেচার সেভ করা হয়নি</div>`;
  }
}

document.getElementById('clearBtn').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasDrawn = false;
});

document.getElementById('saveBtn').addEventListener('click', () => {
  if (!hasDrawn) {
    alert('আগে সই করুন');
    return;
  }

  // সাদা ব্যাকগ্রাউন্ড, ক্রপ করা
  const dataUrl = canvas.toDataURL('image/png');
  localStorage.setItem(STORAGE_KEY, dataUrl);
  loadSignature();
  alert('✅ সিগনেচার সেভ হয়েছে!\nএখন প্রতিটি স্লিপে অটো বসবে।');
});

document.getElementById('deleteBtn').addEventListener('click', () => {
  if (!confirm('সিগনেচার মুছে ফেলবেন?')) return;
  localStorage.removeItem(STORAGE_KEY);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasDrawn = false;
  loadSignature();
});

// পেজ লোড হলে সিগনেচার দেখানো
loadSignature();