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

export function isEventOver(evt: { date?: string; timeEnd?: string; isCompleted?: boolean; reportedToConvenor?: boolean; status?: string }): boolean {
  if (!evt?.date) return false;
  
  // Normalize date to YYYY-MM-DD for comparison
  let isoDate = evt.date;
  const ddmmMatch = evt.date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmMatch) {
    const [, dd, mm, yyyy] = ddmmMatch;
    isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  
  if (isoDate > todayISO) return false;

  const end = new Date(`${isoDate}T${evt.timeEnd || '23:59'}`);
  const hasEndPassed = !isNaN(end.getTime()) && end.getTime() < Date.now();
  
  return hasEndPassed || Boolean(evt.isCompleted || evt.reportedToConvenor || (evt as any).status === 'ended');
}
