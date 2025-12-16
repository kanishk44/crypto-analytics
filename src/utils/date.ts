/**
 * Date utilities for handling UTC dates in YYYY-MM-DD format
 */

export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00.000Z');
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return date;
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(start: string, end: string): string[] {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (startDate > endDate) {
    throw new Error(`Start date (${start}) must be before or equal to end date (${end})`);
  }

  const dates: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export function isToday(dateStr: string): boolean {
  const today = formatDate(new Date());
  return dateStr === today;
}

export function getToday(): string {
  return formatDate(new Date());
}

export function dateToTimestamp(dateStr: string): number {
  return parseDate(dateStr).getTime();
}

export function timestampToDate(timestamp: number): string {
  return formatDate(new Date(timestamp));
}

