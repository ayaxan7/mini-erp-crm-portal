export function formatMoney(value: string | number): string {
  const number = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(number);
}

export function formatMoneyCompact(value: string | number): string {
  const number = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(number)) return '—';
  const abs = Math.abs(number);
  if (abs >= 1_00_00_000) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number / 1_00_00_000)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number / 1_00_000)}L`;
  }
  return formatMoney(number);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}