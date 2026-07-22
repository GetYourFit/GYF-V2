/** Aspect ratios the board draws from, matching Ref1/Ref2's ragged columns. */
const RATIOS = [0.72, 0.88, 1, 1.18, 1.4] as const;

/** Cheap deterministic hash — the same item must land the same shape every time. */
function hash(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i += 1) value = (value * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(value);
}

/**
 * A tile's height is derived from its id, never from load order: re-anchoring
 * the board must not reshuffle the shapes of items that stayed.
 */
export function tileHeight(id: string, width: number): number {
  return Math.round(width * RATIOS[hash(id) % RATIOS.length]);
}

export interface BoardTile<T> {
  height: number;
  item: T;
  width: number;
  x: number;
  y: number;
}

export interface BoardBlock<T> {
  /** One repeat unit. The lattice tiles this in both axes. */
  height: number;
  tiles: BoardTile<T>[];
  width: number;
}

/**
 * Masonry into fixed columns: each tile lands in whichever column is currently
 * shortest, which is what gives Ref2 its ragged, non-gridded rhythm.
 *
 * The block's height is the tallest column, so shorter columns carry a larger
 * gap before they repeat. That raggedness is the reference's look, not a bug —
 * forcing every column to the same height would produce visible banding.
 */
export function layoutBoard<T extends { id: string }>(
  items: readonly T[],
  columns: number,
  columnWidth: number,
  gap: number,
): BoardBlock<T> {
  const safeColumns = Math.max(1, columns);
  const heights = new Array<number>(safeColumns).fill(0);
  const tiles: BoardTile<T>[] = [];

  for (const item of items) {
    let shortest = 0;
    for (let column = 1; column < safeColumns; column += 1) {
      if (heights[column] < heights[shortest]) shortest = column;
    }
    const height = tileHeight(item.id, columnWidth);
    tiles.push({
      height,
      item,
      width: columnWidth,
      x: shortest * (columnWidth + gap),
      y: heights[shortest],
    });
    heights[shortest] += height + gap;
  }

  return {
    height: Math.max(...heights, gap),
    tiles,
    width: safeColumns * (columnWidth + gap),
  };
}

/**
 * Positive modulo. The board pans without limit, so the lattice offset has to
 * fold back into one block — JS `%` keeps the sign and would jump the content
 * a whole block the moment the user drags past origin.
 */
export function wrap(value: number, size: number): number {
  "worklet";
  if (size <= 0) return 0;
  return ((value % size) + size) % size;
}
