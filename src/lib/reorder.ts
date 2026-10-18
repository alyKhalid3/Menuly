export function moveId(ids: string[], id: string, direction: "up" | "down") {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  const current = next[index];
  const swapped = next[target];
  if (current === undefined || swapped === undefined) return null;
  next[index] = swapped;
  next[target] = current;
  return next;
}
