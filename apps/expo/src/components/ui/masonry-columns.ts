/**
 * Deal items into columns the way ref8's feed reads: down one column, then
 * the next, so neighbours in the data end up side by side rather than stacked.
 *
 * Round-robin rather than shortest-column, because a tile's real height is not
 * known until its image loads — a shortest-column pass would have to guess a
 * height, then reshuffle every tile the moment the guess was corrected. Over a
 * page of items the columns stay within roughly one tile of each other, which
 * is the ragged balance the reference has anyway.
 *
 * ponytail: round-robin, no measurement. If one column visibly outruns the
 * other on a real catalogue, feed measured heights in and pack shortest-first.
 */
export function splitColumns<T>(items: readonly T[], columns: number): T[][] {
  const count = Math.max(1, Math.floor(columns));
  const buckets: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => buckets[index % count].push(item));
  return buckets;
}
