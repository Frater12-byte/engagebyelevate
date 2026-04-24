const MAIN_HOSTS = ['engagebyelevate.com', 'www.engagebyelevate.com', 'localhost', '127.0.0.1'];
const ADMIN_HOSTS = ['admin.engagebyelevate.com'];

function isAdminHost(req) {
  return ADMIN_HOSTS.includes((req.hostname || '').toLowerCase());
}

function blockAdminOnMain(req, res, next) {
  if (isAdminHost(req)) return next();
  if (req.path === '/admin-login' || req.path.startsWith('/admin/') || req.path === '/admin') {
    return res.status(404).send('Not found');
  }
  next();
}

function blockMainOnAdmin(req, res, next) {
  if (!isAdminHost(req)) return next();
  const allowed = req.path === '/' || req.path === '/admin-login' || req.path === '/admin' || req.path.startsWith('/admin/') ||
    req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/img/') ||
    req.path.startsWith('/favicon') || req.path.startsWith('/uploads/');
  if (!allowed) return res.status(404).send('Not found');
  next();
}

module.exports = { isAdminHost, blockAdminOnMain, blockMainOnAdmin };
