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
  if (!userTz || userTz === 'Asia/Dubai') return { primary: fmtTime(startIso, 'Asia/Dubai') + ' \u2013 ' + fmtTime(endIso, 'Asia/Dubai') + ' Dubai', secondary: '' };
  var local = fmtTime(startIso, userTz) + ' \u2013 ' + fmtTime(endIso, userTz);
  return { primary: local, secondary: fmtTime(startIso, 'Asia/Dubai') + ' \u2013 ' + fmtTime(endIso, 'Asia/Dubai') + ' (Dubai)' };
}
function fmtTimeDual(iso, userTz) {
  if (!userTz || userTz === 'Asia/Dubai') return { primary: fmtTime(iso, 'Asia/Dubai') + ' Dubai', secondary: '' };
  return { primary: fmtTime(iso, userTz), secondary: fmtTime(iso, 'Asia/Dubai') + ' (Dubai)' };
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
  maybeShowVerifyBanner(me);
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


/* Session switch toast */
function maybeShowSwitchToast() {
  if (!document.cookie.includes('just_switched=1')) return;
  document.cookie = 'just_switched=; path=/; max-age=0';
  getMe().then(me => {
    if (!me) return;
    const t = document.createElement('div');
    t.className = 'toast-switch';
    t.innerHTML = 'Signed in as <strong>' + escapeHtml(me.contact_name || me.email) + '</strong>' + (me.org_name ? ' (' + escapeHtml(me.org_name) + ')' : '');
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4500);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeShowSwitchToast);
else maybeShowSwitchToast();

/* Email verification banner */
function maybeShowVerifyBanner(me) {
  if (!me || me.email_verified_at) return;
  if (!me.created_at) return;
  var hoursLeft = 48 - ((Date.now() - new Date(me.created_at).getTime()) / 3600000);
  if (hoursLeft <= 0) return;
  var banner = document.createElement('div');
  banner.id = 'verify-banner';
  banner.className = 'verify-banner';
  banner.innerHTML = '<span class="verify-banner-text">Please confirm your email to keep full access. <strong>' + Math.max(1, Math.ceil(hoursLeft)) + 'h remaining.</strong> Check your inbox for the sign-in link, or <a href="#" id="verify-resend">resend it</a>.</span>';
  document.body.insertBefore(banner, document.body.firstChild);
  document.getElementById('verify-resend').addEventListener('click', function(e) {
    e.preventDefault();
    api.post('/auth/resend-magic', { email: me.email }).then(function() {
      banner.innerHTML = '<span class="verify-banner-text">Sign-in link resent. Check your inbox.</span>';
    }).catch(function() {
      toast('Could not resend. Try again in a minute.', 'error');
    });
  });
}

/* Live chat status chip */
(function() {
  var chip = document.createElement('a');
  chip.href = 'https://tawk.to/chat/69eb5d1ef851631c32b88e82/1jmvm7fv8';
  chip.target = '_blank';
  chip.rel = 'noopener noreferrer';
  chip.className = 'chat-status';
  chip.id = 'chat-status';
  chip.innerHTML = '<span class="chat-status-dot"></span><span class="chat-status-text">Live Chat \u2013 Agents Online</span>';
  document.body.appendChild(chip);
  chip.addEventListener('click', function() {
    if (typeof gtag === 'function') {
      gtag('event', 'chat_link_clicked', { page: window.location.pathname });
    }
  });
})();
