import type { ReactNode } from 'react';
import styles from './Card.module.css';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.card} ${className ?? ''}`}>{children}</div>;
}

function CardHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={styles.cardHeader}>
      <div>
        <h3>{title}</h3>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

Card.Header = CardHeader;

export function StatCard({ label, value, icon, tone = 'primary' }: { label: string; value: ReactNode; icon?: ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' }) {
  return (
    <div className={styles.stat}>
      {icon && (
        <div className={`${styles.statIcon} ${styles[tone]}`}>{icon}</div>
      )}
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div>
        <h1>{title}</h1>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </div>
  );
}