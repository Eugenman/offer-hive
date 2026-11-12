/**
 * Ref callback for a table inside a sideways-scrolling container: marks the table with
 * `data-scrolled` while it is scrolled away from the left edge, so pinned columns can show a shadow.
 */
export function trackHorizontalScroll(table: HTMLTableElement | null) {
  if (!table) return;
  // The scrolling element is not always the table's direct parent: the page wraps the table in its
  // own scroller, and the inner container is set to `overflow: visible`.
  const container = (() => {
    for (let node = table.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === "auto" || style.overflowX === "scroll") return node;
    }
    return table.parentElement;
  })();
  if (!container) return;
  const update = () => table.toggleAttribute("data-scrolled", container.scrollLeft > 0);
  update();
  container.addEventListener("scroll", update, { passive: true });
  return () => container.removeEventListener("scroll", update);
}
