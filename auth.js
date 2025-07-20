import { CONFIG } from './constants.js';

function showForm(id) {
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    // Tab styling toggle
    document.querySelectorAll('.tab-btns button').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${id}`)?.classList.add('active');
}

document.getElementById('tab-login')?.addEventListener('click', () => showForm('login'));
document.getElementById('tab-register')?.addEventListener('click', () => showForm('register'));
document.getElementById('tab-forgot')?.addEventListener('click', () => showForm('forgot'));


// ---- LOGIN ----
document.getElementById('login')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) return alert('Please fill all fields.');

    try {
        const res = await fetch(`${CONFIG.API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            const { error } = await res.json();
            return alert(`Login failed: ${error || res.statusText}`);
        }

        const user = await res.json();
        await chrome.storage.sync.set({ userId: user._id, email: user.email });
        await chrome.storage.local.remove('importedOnce');
        window.location.href = 'popup.html';
    } catch (err) {
        alert('Network error. Please try again.');
        console.error('Login error:', err);
    }
});

// ---- REGISTER ----
document.getElementById('register')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if (!name || !email || !password) return alert('Please fill all fields.');

    try {
        const res = await fetch(`${CONFIG.API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (!res.ok) {
            const { error } = await res.json();
            return alert(`Registration failed: ${error || res.statusText}`);
        }

        const user = await res.json();
        await chrome.storage.sync.set({ userId: user._id, email: user.email });
        await chrome.storage.local.remove('importedOnce');
        window.location.href = 'popup.html';

    } catch (err) {
        alert('Network error. Please try again.');
        console.error('Register error:', err);
    }
});

// ---- FORGOT PASSWORD ----
document.getElementById('forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return alert('Enter your email.');

    try {
        const res = await fetch(`${CONFIG.API_BASE}/auth/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const result = await res.json();

        if (res.ok) {
            alert('Reset link sent! (Check console for dev mode)');
            showForm('login');
        } else {
            alert(`Reset failed: ${result.error || res.statusText}`);
        }
    } catch (err) {
        alert('Network error. Please try again.');
        console.error('Reset error:', err);
    }
});
