export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeek(monday: string): string {
  const sunday = new Date(monday + "T12:00:00Z");
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return `${formatDate(monday)} – ${formatDate(sunday.toISOString().slice(0, 10))}`;
}
