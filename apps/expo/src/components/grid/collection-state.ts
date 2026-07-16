/** Pure view-state for the expandable collection grid. */
export interface CollectionView<T> {
  visible: T[];
  hiddenCount: number;
  /** Index into `visible` where newly revealed (staggered) cards start; -1 when collapsed. */
  revealFrom: number;
}

export function collectionView<T>(
  items: readonly T[],
  expanded: boolean,
  previewCount: number,
): CollectionView<T> {
  const preview = Math.max(0, previewCount);
  if (!expanded) {
    const visible = items.slice(0, preview);
    return { visible, hiddenCount: items.length - visible.length, revealFrom: -1 };
  }
  return { visible: [...items], hiddenCount: 0, revealFrom: preview };
}
