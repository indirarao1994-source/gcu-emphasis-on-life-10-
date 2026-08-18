/**
 * Helper utility to consistently format dates as DD-MM-YYYY across the GCU application.
 */

export function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy}`;
  }

  // Check if already in DD-MM-YYYY or DD/MM/YYYY
  const ddmmMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmMatch) {
    const [, dd, mm, yyyy] = ddmmMatch;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy}`;
  }

  // Try parsing date
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  return str;
}

export function formatDateRangeDDMMYYYY(from?: string, to?: string, fallback?: string): string {
  if (from && to) {
    return `${formatDateDDMMYYYY(from)} TO ${formatDateDDMMYYYY(to)}`;
  }
  if (from) {
    return formatDateDDMMYYYY(from);
  }
  if (fallback) {
    // Convert any YYYY-MM-DD instances inside fallback text
    return fallback.replace(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/g, (_, y, m, d) => {
      return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    });
  }
  return '';
}

export function toISODateString(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // Match YYYY-MM-DD or YYYY/MM/DD
  const yyyyMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (yyyyMatch) {
    const [, yyyy, mm, dd] = yyyyMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmMatch) {
    const [, dd, mm, yyyy] = ddmmMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Parse Date object
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return str;
}

export function isEventOver(evt: { date?: string; timeEnd?: string; isCompleted?: boolean; reportedToConvenor?: boolean; status?: string }): boolean {
  if (!evt?.date) return false;
  
  const isoDate = toISODateString(evt.date);
  if (!isoDate) return false;

  const todayISO = new Date().toISOString().slice(0, 10);
  
  // IF EVENT DATE IS IN THE FUTURE (e.g. 2026-08-15 > 2026-08-07), IT IS DEFINITELY NOT OVER!
  if (isoDate > todayISO) {
    return false;
  }

  const end = new Date(`${isoDate}T${evt.timeEnd || '23:59'}`);
  const hasEndPassed = !isNaN(end.getTime()) && end.getTime() < Date.now();
  
  return hasEndPassed || Boolean(evt.isCompleted && evt.reportedToConvenor);
}

/**
 * Checks whether student registration is closed for an event.
 * Compares event date with current date:
 * - If event date is in the future (isoDate > todayISO), registration is OPEN
 *   UNLESS faculty explicitly clicked "Close Registration" (isRegistrationClosed / registrationClosed).
 * - If event date/end time has passed (isEventOver(evt)), registration is CLOSED.
 */
export function isEventRegistrationClosed(evt: { 
  date?: string; 
  timeEnd?: string; 
  isCompleted?: boolean; 
  reportedToConvenor?: boolean; 
  isRegistrationClosed?: boolean; 
  registrationClosed?: boolean; 
  status?: string 
}): boolean {
  if (!evt) return false;

  let isoDate = evt.date || '';
  const ddmmMatch = isoDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmMatch) {
    const [, dd, mm, yyyy] = ddmmMatch;
    isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // If event date is in the future (e.g. rescheduled to 13th), registration is OPEN
  // unless faculty explicitly clicked "Close Registration"
  if (isoDate > todayISO) {
    return Boolean(evt.isRegistrationClosed || evt.registrationClosed);
  }

  // If event is over, registration is closed
  if (isEventOver(evt)) return true;

  // Otherwise check explicit registration closed flags
  return Boolean(evt.isRegistrationClosed || evt.registrationClosed);
}
