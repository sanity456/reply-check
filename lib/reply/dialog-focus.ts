/** Reveal only the trigger Base UI actually restored; never move focus ourselves. */
export function revealRestoredDialogFocus(target: Element | null): void {
  const doc = target?.ownerDocument;
  const view = doc?.defaultView;
  if (!target || !doc || !view) return;

  // Base UI restores focus in a microtask with preventScroll. Wait until that
  // restoration and the closing animation/scroll lock have finished.
  view.requestAnimationFrame(() => {
    if (
      !target.isConnected ||
      doc.activeElement !== target ||
      target === doc.body ||
      target === doc.documentElement ||
      target.closest('[role="dialog"], [inert]') ||
      target.matches(':disabled, [aria-disabled="true"]') ||
      !target.getClientRects().length
    )
      return;

    const rect = target.getBoundingClientRect();
    const viewport = view.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const left = viewport?.offsetLeft ?? 0;
    const height = viewport?.height ?? doc.documentElement.clientHeight;
    const width = viewport?.width ?? doc.documentElement.clientWidth;
    if (
      rect.top < top ||
      rect.bottom > top + height ||
      rect.left < left ||
      rect.right > left + width
    )
      target.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'instant',
      });
  });
}
