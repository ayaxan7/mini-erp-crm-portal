import styles from './Table.module.css';

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages: number[] = [];
  for (let i = windowStart; i <= windowEnd; i += 1) pages.push(i);

  return (
    <div className={styles.pagination}>
      <span className={styles.pageInfo}>
        Page {page} of {totalPages}
      </span>
      <div className={styles.pageButtons}>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={styles.pageButton}>
          ←
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            className={`${styles.pageButton} ${number === page ? styles.active : ''}`}
          >
            {number}
          </button>
        ))}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={styles.pageButton}>
          →
        </button>
      </div>
    </div>
  );
}