import { useEffect } from 'react';









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
    
    
    let inner = null;
    el.querySelectorAll('div').forEach((d) => {
      if (!inner && isHScroller(d) && d.scrollWidth > d.clientWidth + 4) inner = d;
    });
    if (inner) return inner;
    return el;
  }
  
  
  if (isHScroller(parent)) return parent;
  
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
