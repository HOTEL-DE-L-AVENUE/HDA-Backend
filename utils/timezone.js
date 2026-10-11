const MADAGASCAR_TIMEZONE = 'Indian/Antananarivo';

const madagascarDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: MADAGASCAR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

module.exports = { madagascarDate };
