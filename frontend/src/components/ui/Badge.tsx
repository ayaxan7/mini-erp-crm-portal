import styles from './Badge.module.css';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  tone: Tone;
  children: React.ReactNode;
}

export const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: 'success',
  CONFIRMED: 'success',
  IN: 'success',
  INACTIVE: 'neutral',
  CANCELLED: 'danger',
  OUT: 'warning',
  LEAD: 'warning',
  DRAFT: 'info',
  RETAIL: 'info',
  WHOLESALE: 'primary',
  DISTRIBUTOR: 'warning',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ADMIN: 'primary',
  SALES: 'info',
  WAREHOUSE: 'neutral',
  ACCOUNTS: 'warning',
};

export function statusTone(value: string): Tone {
  return STATUS_TONES[value] ?? 'neutral';
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge tone={statusTone(value)}>{value}</Badge>;
}