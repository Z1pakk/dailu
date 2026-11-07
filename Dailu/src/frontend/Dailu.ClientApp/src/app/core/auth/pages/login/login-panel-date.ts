const FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Brand-panel eyebrow on the login page: "TODAY · THU 5 NOV". */
export function loginPanelDate(date: Date): string {
  const parts = FORMAT.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `TODAY · ${part('weekday')} ${part('day')} ${part('month')}`.toUpperCase();
}
