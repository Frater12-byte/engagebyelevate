const dayjs = require('dayjs');

function emailVerifiedOrInGrace(user) {
  if (user.email_verified_at) return true;
  if (!user.created_at) return true;
  const ageHours = dayjs().diff(dayjs(user.created_at), 'hour');
  return ageHours < 48;
}

module.exports = { emailVerifiedOrInGrace };
