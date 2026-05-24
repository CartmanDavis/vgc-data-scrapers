export function applySort<T>(rows: T[], col: keyof T | null, dir: 'asc' | 'desc'): T[] {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    if (typeof av === 'string' && typeof bv === 'string') {
      const cmp = av.localeCompare(bv);
      return dir === 'asc' ? cmp : -cmp;
    }
    return dir === 'desc' ? (Number(bv) - Number(av)) : (Number(av) - Number(bv));
  });
}

export function toggleSort<T extends string>(
  col: T,
  sort: { col: T; dir: 'asc' | 'desc' } | null,
  setSort: (s: { col: T; dir: 'asc' | 'desc' } | null) => void,
) {
  if (sort?.col === col) {
    setSort({ col, dir: sort.dir === 'desc' ? 'asc' : 'desc' });
  } else {
    setSort({ col, dir: 'desc' });
  }
}

export function SortTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      className={className}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={onClick}
    >
      {label}{' '}
      <i
        className={`bi ${active ? (dir === 'desc' ? 'bi-caret-down-fill' : 'bi-caret-up-fill') : 'bi-caret-down'}`}
        style={{ fontSize: 10, opacity: active ? 1 : 0.35 }}
      />
    </th>
  );
}
