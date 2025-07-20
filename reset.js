import { CONFIG } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const tokenInput = document.getElementById('reset-token');
  const passwordInput = document.getElementById('new-password');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = tokenInput.value.trim();
    const newPassword = passwordInput.value.trim();

    if (!token || !newPassword) {
      alert('Please enter both token and new password.');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.API_BASE}/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      if (res.ok) {
        alert('✅ Password updated successfully. Please log in.');
        window.location.href = 'auth.html';
      } else {
        const { error } = await res.json();
        alert(`❌ Reset failed: ${error || res.statusText}`);
      }
    } catch (err) {
      console.error('Reset error:', err);
      alert('❌ Network error. Please try again.');
    }
  });
});
