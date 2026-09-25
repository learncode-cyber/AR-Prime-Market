import { useCallback, useEffect, useState } from "react";

/**
 * Arrow-key / Enter / Escape navigation for a filtered dropdown list.
 * - Resets active index when the list length changes (e.g. after filtering)
 * - Scrolls the active item into view via `data-active-item="true"`
 */
export function useListKeyboardNav<T>(
  items: T[],
  opts: {
    enabled: boolean;
    onSelect: (item: T) => void;
    onEscape?: () => void;
  },
) {
  const { enabled, onSelect, onEscape } = opts;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || items.length === 0) {
        if (e.key === "Escape") onEscape?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(items[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onEscape?.();
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(items.length - 1);
      }
    },
    [enabled, items, activeIndex, onSelect, onEscape],
  );

  useEffect(() => {
    if (!enabled) return;
    const el = document.querySelector<HTMLElement>('[data-active-item="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, enabled]);

  return { activeIndex, setActiveIndex, onKeyDown };
}
