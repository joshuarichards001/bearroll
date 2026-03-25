export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function medalClass(rank: number): string {
  if (rank === 1) return "text-gold font-bold";
  if (rank === 2) return "text-silver font-bold";
  if (rank === 3) return "text-bronze font-bold";
  return "text-fg";
}
