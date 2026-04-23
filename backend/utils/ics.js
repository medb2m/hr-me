/**
 * Minimal iCalendar (RFC 5545) single event — UTF-8 lines folded not implemented for long lines.
 * @param {{
 *   uid: string;
 *   title: string;
 *   description?: string;
 *   start: Date;
 *   end: Date;
 *   location?: string;
 *   url?: string;
 * }} opts
 */
export function buildIcsEvent(opts) {
  const fmt = (d) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escape = (s) =>
    String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HR me//Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escape(opts.uid)}@hr-me`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${escape(opts.title)}`,
  ];
  if (opts.description) {
    lines.push(`DESCRIPTION:${escape(opts.description)}`);
  }
  if (opts.location) {
    lines.push(`LOCATION:${escape(opts.location)}`);
  }
  if (opts.url) {
    lines.push(`URL:${escape(opts.url)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
