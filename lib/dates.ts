export function daysAgoIso(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function daysFromNowIso(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function daysBetween(fromIso: string, to = new Date()) {
  const from = new Date(fromIso);
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export function daysSince(iso: string | null) {
  if (!iso) return null;
  return daysBetween(iso);
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatFull(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function monthName(d = new Date()) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
}

export function unusedCopy(days: number) {
  if (days >= 180) return `${Math.round(days / 30)} months quiet`;
  if (days >= 60) return `${days} days untouched`;
  if (days >= 30) return `${days} days since last use`;
  if (days === 0) return "used today";
  if (days === 1) return "used yesterday";
  return `used ${days} days ago`;
}
