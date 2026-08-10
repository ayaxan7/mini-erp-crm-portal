import type { ReactNode } from 'react';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyLabel?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (row: T) => void;
  bottomContent?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyLabel,
  emptyDescription,
  emptyIcon,
  onRowClick,
  bottomContent,
}: DataTableProps<T>) {
  const cellClass = (align?: 'left' | 'center' | 'right') =>
    align === 'right' ? styles.right : align === 'center' ? styles.center : '';

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={{ width: column.width }} className={cellClass(column.align)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        <span className={styles.cellSkeleton} />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
                ? (
                    <tr>
                      <td colSpan={columns.length}>
                        <div className={styles.empty}>
                          <div className={styles.emptyIcon}>{emptyIcon}</div>
                          <h4>{emptyLabel ?? 'Nothing here yet'}</h4>
                          {emptyDescription && <p className="text-secondary">{emptyDescription}</p>}
                        </div>
                      </td>
                    </tr>
                  )
                : data.map((row) => (
                    <tr
                      key={rowKey(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={onRowClick ? styles.clickable : undefined}
                    >
                      {columns.map((column) => (
                        <td key={column.key} className={cellClass(column.align)}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>
      {bottomContent}
    </div>
  );
}