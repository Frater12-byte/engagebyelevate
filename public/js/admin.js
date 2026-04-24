async function apiGet(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (res.status === 401) { location.href = '/admin-login'; return null; }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.statusText); }
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(path, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body || {}) });
  if (res.status === 401) { location.href = '/admin-login'; return null; }
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Request failed');
  return d;
}
async function apiPatch(path, body) {
  const res = await fetch(path, { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (res.status === 401) { location.href = '/admin-login'; return null; }
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Request failed');
  return d;
}
async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', credentials: 'include' });
  if (res.status === 401) { location.href = '/admin-login'; return null; }
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function esc(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDt(iso) { if (!iso) return '-'; return new Date(iso).toLocaleString('en-GB', { timeZone:'Asia/Dubai', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function badge(text, color) { return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40">${esc(text)}</span>`; }
function statusBadge(s) {
  const colors = { approved:'#22c55e', pending:'#EC672C', declined:'#ef4444', cancelled:'#ef4444', expired:'#6a6a75' };
  return badge(s, colors[s] || '#6a6a75');
}
function typeBadge(t) {
  const colors = { hotel:'#4EA8DE', agent:'#A78BFA', exhibitor:'#F59E0B', admin:'#EC672C' };
  return badge(t, colors[t] || '#6a6a75');
}
