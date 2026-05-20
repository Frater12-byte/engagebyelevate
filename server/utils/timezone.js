// Map a user's country (free-text input) to an IANA timezone.
// Falls back to Asia/Dubai since the event is in Dubai.
function countryToTimezone(country) {
  if (!country) return 'Asia/Dubai';
  const c = country.toLowerCase();

  if (c.includes('uae') || c.includes('united arab') || c.includes('emirates') || c.includes('dubai')) return 'Asia/Dubai';
  if (c.includes('saudi')) return 'Asia/Riyadh';
  if (c.includes('thailand')) return 'Asia/Bangkok';
  if (c.includes('kyrgyz')) return 'Asia/Bishkek';
  if (c.includes('israel')) return 'Asia/Jerusalem';
  if (c.includes('uk') || c.includes('united kingdom') || c.includes('britain') || c.includes('england')) return 'Europe/London';
  if (c.includes('france')) return 'Europe/Paris';
  if (c.includes('spain')) return 'Europe/Madrid';
  if (c.includes('portugal')) return 'Europe/Lisbon';
  if (c.includes('romania')) return 'Europe/Bucharest';
  if (c.includes('germany')) return 'Europe/Berlin';
  if (c.includes('italy')) return 'Europe/Rome';
  if (c.includes('belgium')) return 'Europe/Brussels';
  if (c.includes('netherlands') || c.includes('holland')) return 'Europe/Amsterdam';
  if (c.includes('sweden')) return 'Europe/Stockholm';
  if (c.includes('slovakia')) return 'Europe/Bratislava';
  if (c.includes('bulgaria')) return 'Europe/Sofia';
  if (c.includes('belarus')) return 'Europe/Minsk';
  if (c.includes('russia')) return 'Europe/Moscow';
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
