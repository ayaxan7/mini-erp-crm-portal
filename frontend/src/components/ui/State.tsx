import type { ReactNode } from 'react';
import styles from './State.module.css';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className={styles.center} role="status">
      <span className={styles.spinner} />
      {label && <p className="text-secondary">{label}</p>}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.skeletonRows} data-testid="skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={styles.skeleton} />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      {icon && <div className={styles.stateIcon}>{icon}</div>}
      <h3>{title}</h3>
      {description && <p className="text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, action }: { title?: string; description?: string; onRetry?: () => void; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <div className={`${styles.stateIcon} ${styles.errorIcon}`}>!</div>
      <h3>{title}</h3>
      {description && <p className="text-secondary">{description}</p>}
      {(onRetry || action) && (
        <div className={`mt-4 flex gap-3`}>
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}