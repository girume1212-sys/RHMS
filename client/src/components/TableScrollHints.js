import { useEffect } from 'react';

// Renders nothing. Watches every `.table-footer` on the page, finds the
// horizontal scroll container its table lives in, and toggles
// `data-hscroll="true"` on the footer while that container actually
// overflows. CSS shows a small ↔ indicator pill in the footer only then,
// so users can discover horizontal scrolling without anything covering
// table content. Visual-only: no data, pagination, sorting, filtering,
// API, or permission behavior is touched.

function isHScroller(el) {
  if (!el || el.nodeType !== 1) return false;
  const ox = getComputedStyle(el).overflowX;
  return ox === 'auto' || ox === 'scroll';
}

function findScrollContainer(footer) {
  if (!footer || !footer.parentElement) return null;
  const parent = footer.parentElement;
  const cards = [];
  const prev = footer.previousElementSibling;
  if (prev && prev.matches && prev.matches('.table-card, .table-scroll')) cards.push(prev);
  parent.querySelectorAll('.table-card, .table-scroll').forEach((el) => {
    if (!cards.includes(el)) cards.push(el);
  });
  for (const el of cards) {
    if (!isHScroller(el)) continue;
    // Viewport-style nesting (e.g. DatabaseTables max-height div scrolls
    // instead of the card itself): prefer the inner scroller that overflows.
    let inner = null;
    el.querySelectorAll('div').forEach((d) => {
      if (!inner && isHScroller(d) && d.scrollWidth > d.clientWidth + 4) inner = d;
    });
    if (inner) return inner;
    return el;
  }
  // Direct parent is itself the scroller (footer nested inside the
  // scroll wrapper, e.g. Settings status table).
  if (isHScroller(parent)) return parent;
  // Fallback: previous siblings with inline-style scroll wrappers.
  let sib = footer.previousElementSibling;
  while (sib) {
    if (isHScroller(sib)) return sib;
    sib = sib.previousElementSibling;
  }
  return null;
}

export default function TableScrollHints() {
  useEffect(() => {
    const observed = new Set();
    let raf = 0;
    let ro = null;

    const refresh = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ro) {
          observed.forEach((el) => {
            if (!el.isConnected) {
              ro.unobserve(el);
              observed.delete(el);
            }
          });
        }
        document.querySelectorAll('.table-footer').forEach((footer) => {
          const container = findScrollContainer(footer);
          if (!container) {
            footer.removeAttribute('data-hscroll');
            return;
          }
          if (ro && !observed.has(container)) {
            observed.add(container);
            ro.observe(container);
          }
          if (container.scrollWidth > container.clientWidth + 4) {
            footer.setAttribute('data-hscroll', 'true');
          } else {
            footer.removeAttribute('data-hscroll');
          }
        });
      });
    };

    ro = new ResizeObserver(refresh);
    const mo = new MutationObserver(refresh);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    refresh();

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      document.querySelectorAll('.table-footer[data-hscroll]').forEach((f) => {
        f.removeAttribute('data-hscroll');
      });
    };
  }, []);

  return null;
}
