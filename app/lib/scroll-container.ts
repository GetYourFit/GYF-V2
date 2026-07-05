/**
 * The app scrolls inside <main> (see app-shell.tsx), not the window —
 * consumers that read or control scroll position must target this element.
 */
export const APP_SCROLL_ID = "app-scroll";

export function getScrollContainer(): HTMLElement {
  return document.getElementById(APP_SCROLL_ID) ?? document.documentElement;
}
