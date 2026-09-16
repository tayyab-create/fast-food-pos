import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Whether a popup anchored below `anchorRef` should open upward instead,
 * because it wouldn't fit between the anchor and the bottom of the nearest
 * scrolling ancestor (or the viewport). Measured once each time `open`
 * becomes true (and again when `deps` change), from the anchor rather than
 * the popup, so the answer is stable once the popup has flipped.
 */
export function useFlipUp(
  anchorRef: RefObject<HTMLElement | null>,
  popupRef: RefObject<HTMLElement | null>,
  open: boolean,
  deps: unknown[] = [],
): boolean {
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !popupRef.current) return;
    let clip: HTMLElement | null = anchorRef.current.parentElement;
    while (clip && !/(auto|scroll)/.test(getComputedStyle(clip).overflowY)) clip = clip.parentElement;
    const limit = Math.min(clip ? clip.getBoundingClientRect().bottom : Infinity, window.innerHeight);
    const anchorBottom = anchorRef.current.getBoundingClientRect().bottom;
    setFlip(anchorBottom + 4 + popupRef.current.offsetHeight > limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's cue to re-measure
  }, [open, ...deps]);
  return open && flip;
}
