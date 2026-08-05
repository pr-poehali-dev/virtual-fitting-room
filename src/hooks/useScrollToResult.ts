import { useRef, useCallback } from 'react';

const EXTRA_GAP = 16;

const getHeaderOffset = () => {
  const header = document.querySelector('header');
  if (!header) return EXTRA_GAP;
  const styles = window.getComputedStyle(header);
  if (styles.position !== 'sticky' && styles.position !== 'fixed') return EXTRA_GAP;
  return header.getBoundingClientRect().height + EXTRA_GAP;
};

const isMostlyVisible = (el: HTMLElement, headerOffset: number) => {
  const rect = el.getBoundingClientRect();
  const viewportTop = headerOffset;
  const viewportBottom = window.innerHeight;
  if (rect.bottom <= viewportTop || rect.top >= viewportBottom) return false;
  const visible = Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop);
  const needed = Math.min(rect.height, viewportBottom - viewportTop) * 0.5;
  return visible >= needed;
};

export function useScrollToResult<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const scrollToResult = useCallback((options?: { force?: boolean; delay?: number }) => {
    const delay = options?.delay ?? 80;
    window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const headerOffset = getHeaderOffset();
      if (!options?.force && isMostlyVisible(el, headerOffset)) return;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }, delay);
  }, []);

  return { resultRef: ref, scrollToResult };
}

export default useScrollToResult;
