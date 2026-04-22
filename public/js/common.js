/* Shared helpers for all pages */

const api = {
  async get(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
};

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Dubai' });
}
function fmtDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' });
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function getMe() {
  try { return (await api.get('/auth/me')).user; }
  catch { return null; }
}

/** Update nav for logged-in user: My Dashboard (with notification count) + Sign out */
async function updateNavForUser(me) {
  if (!me) return;
  const authLink = document.getElementById('nav-auth-link');
  if (authLink) {
    authLink.textContent = 'My Dashboard';
    authLink.href = '/dashboard';
    // Fetch notification count
    try {
      const { count } = await api.get('/api/me/notifications');
      if (count > 0) {
        authLink.insertAdjacentHTML('beforeend', `<span class="nav-notif">${count}</span>`);
      }
    } catch {}
  }
  const ctaLink = document.getElementById('nav-cta-link');
  if (ctaLink) {
    ctaLink.textContent = 'Sign out';
    ctaLink.href = '#';
    ctaLink.className = '';
    ctaLink.onclick = async (e) => { e.preventDefault(); await api.post('/auth/logout'); location.href = '/'; };
  }
}

function openModal(contentNode) {
  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => {
    if (e.target === backdrop) backdrop.remove();
  }});
  const modal = el('div', { class: 'modal' });
  modal.appendChild(contentNode);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return backdrop;
}

/* Navigation highlighter */
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) a.classList.add('active');
  });
});
