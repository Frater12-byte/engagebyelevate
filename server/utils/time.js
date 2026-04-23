// UTC ISO 8601 timestamp with Z suffix. Always use this for DB writes.
function nowUtc() {
  return new Date().toISOString();
}

module.exports = { nowUtc };
