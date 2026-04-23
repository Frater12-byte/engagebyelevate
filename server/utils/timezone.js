// Map a user's country (free-text input) to an IANA timezone.
// Falls back to Asia/Dubai since the event is in Dubai.
function countryToTimezone(country) {
  if (!country) return 'Asia/Dubai';
  const c = country.toLowerCase();

  if (c.includes('uae') || c.includes('united arab') || c.includes('emirates') || c.includes('dubai')) return 'Asia/Dubai';
  if (c.includes('thailand')) return 'Asia/Bangkok';
  if (c.includes('uk') || c.includes('united kingdom') || c.includes('britain') || c.includes('england')) return 'Europe/London';
  if (c.includes('france')) return 'Europe/Paris';
  if (c.includes('spain')) return 'Europe/Madrid';
  if (c.includes('portugal')) return 'Europe/Lisbon';
  if (c.includes('romania')) return 'Europe/Bucharest';
  if (c.includes('maldives')) return 'Indian/Maldives';
  if (c.includes('mauritius')) return 'Indian/Mauritius';

  return 'Asia/Dubai';
}

// Derive attendance_mode from region.
// UAE hotels attend on-site; everyone else (INTL hotels, agents) is remote.
function regionToAttendanceMode(region) {
  return region === 'UAE' ? 'on_site' : 'remote';
}

module.exports = { countryToTimezone, regionToAttendanceMode };
