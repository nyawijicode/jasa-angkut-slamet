const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPickupDate(value?: string): string | null {
  if (!value) return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return dateFormatter.format(date);
}

export function formatPickupTime(value?: string): string | null {
  if (!value) return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return `${match[1]}.${match[2]} WIB`;
}

export function formatSchedule(date?: string, time?: string): string | null {
  const parts: string[] = [];
  const formattedDate = formatPickupDate(date);
  const formattedTime = formatPickupTime(time);

  if (formattedDate) parts.push(formattedDate);
  if (formattedTime) parts.push(`pukul ${formattedTime}`);

  return parts.length > 0 ? parts.join(", ") : null;
}
