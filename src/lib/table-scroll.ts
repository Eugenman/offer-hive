/**
 * Ref callback for a table inside a sideways-scrolling container: marks the table with
 * `data-scrolled` while it is scrolled away from the left edge, so pinned columns can show a shadow.
 */
export function trackHorizontalScroll(table: HTMLTableElement | null) {
  const container = table?.parentElement;
  if (!table || !container) return;
  const update = () => table.toggleAttribute("data-scrolled", container.scrollLeft > 0);
  update();
  container.addEventListener("scroll", update, { passive: true });
  return () => container.removeEventListener("scroll", update);
}
