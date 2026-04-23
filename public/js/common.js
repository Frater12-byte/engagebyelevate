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

function fmtTime(iso, tz = 'Asia/Dubai') {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
}
function fmtDate(iso, tz = 'Asia/Dubai') {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
}
function fmtDateShort(iso, tz = 'Asia/Dubai') {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz });
}
function tzAbbr(iso, tz) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: tz, timeZoneName: 'short' }).split(' ').pop();
}
function tzCity(tz) {
  var map = {
    'Asia/Dubai':'Dubai','Asia/Bangkok':'Bangkok','Europe/London':'London',
    'Europe/Paris':'Paris','Europe/Madrid':'Madrid','Europe/Lisbon':'Lisbon',
    'Europe/Bucharest':'Bucharest','Indian/Maldives':'Maldives','Indian/Mauritius':'Mauritius'
  };
  if (map[tz]) return map[tz];
  if (!tz) return 'Dubai';
  var parts = tz.split('/');
  return (parts[parts.length - 1] || tz).replace(/_/g, ' ');
}
function fmtTimeRange(startIso, endIso, userTz) {
  var dubai = fmtTime(startIso, 'Asia/Dubai') + ' \u2013 ' + fmtTime(endIso, 'Asia/Dubai') + ' Dubai';
  if (!userTz || userTz === 'Asia/Dubai') return { primary: dubai, secondary: '' };
  var local = fmtTime(startIso, userTz) + ' \u2013 ' + fmtTime(endIso, userTz) + ' ' + tzCity(userTz);
  return { primary: local, secondary: dubai };
}
function fmtTimeDual(iso, userTz) {
  if (!userTz || userTz === 'Asia/Dubai') return { primary: fmtTime(iso, 'Asia/Dubai') + ' Dubai', secondary: '' };
  return { primary: fmtTime(iso, userTz) + ' ' + tzCity(userTz), secondary: fmtTime(iso, 'Asia/Dubai') + ' Dubai' };
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

/**
 * Validate auth state and enrich nav (notification count, sign-out handler).
 * The initial show/hide is handled by CSS + the inline <script> in <head>.
 * This function handles: stale cookie correction, notification badge, sign-out wiring.
 */
async function updateNavForUser(me) {
  const html = document.documentElement;
  if (!me) {
    // Session invalid — force guest state even if cookie said authed
    html.classList.remove('is-authed');
    html.classList.add('is-guest');
    return;
  }
  // Confirmed authed
  html.classList.remove('is-guest');
  html.classList.add('is-authed');
  // Add notification badge
  const dashLink = document.getElementById('nav-dash');
  if (dashLink) {
    try {
      const { count } = await api.get('/api/me/notifications');
      if (count > 0) dashLink.insertAdjacentHTML('beforeend', `<span class="nav-notif">${count}</span>`);
    } catch {}
  }
  // Wire sign-out
  const signOut = document.getElementById('nav-signout');
  if (signOut) {
    signOut.onclick = async (e) => {
      e.preventDefault();
      document.cookie = 'logged_in=; Max-Age=0; path=/';
      await api.post('/auth/logout');
      location.href = '/';
    };
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

/* Live Dubai clock in nav */
function injectDubaiClock() {
  const host = document.querySelector('.nav-inner');
  if (!host) return;
  const el = document.createElement('span');
  el.id = 'dubai-clock';
  el.className = 'nav-clock';
  el.setAttribute('aria-label', 'Current Dubai time');
  const toggle = host.querySelector('.nav-toggle');
  if (toggle) host.insertBefore(el, toggle);
  else host.appendChild(el);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const tick = () => { el.textContent = 'Dubai \u00b7 ' + fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectDubaiClock);
else injectDubaiClock();
