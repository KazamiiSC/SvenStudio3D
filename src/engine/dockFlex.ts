/**
 * Browser flex-grow values below a total of 1 deliberately leave unallocated
 * free space. Saved split weights are ratios, not absolute flex-grow factors:
 * normalize only the currently visible panels in the same dock zone.
 *
 * A single docked panel must always occupy 100% of its slot. When several
 * panels share a side, retain their saved ratios, regardless of whether a
 * neighbor was moved to another side or temporarily hidden.
 */
export function normalizedDockFlexGrows<T extends string>(
  ids: readonly T[],
  weights: Partial<Record<T, number>>
): Record<T, number> {
  const entries=ids.map(id=>{
    const value=weights[id];
    return [id,typeof value==='number'&&Number.isFinite(value)&&value>0?value:1] as const;
  });
  const sum=entries.reduce((total,[,weight])=>total+weight,0);
  return Object.fromEntries(entries.map(([id,weight])=>[id,weight/sum])) as Record<T,number>;
}
