// albus-dock — a tiny external store letting the shared Sheet primitive react
// to Albus being docked, without coupling ui/sheet to the companion React
// context. When Albus is open, peeks go NON-MODAL and shift LEFT so the two
// coexist side-by-side (Monday-style) instead of Albus covering the peek.
//
// It also drives the `--albus-dock` CSS var (the reserved right-edge width),
// which peeks/overlays/main content read to shift/reflow left of the dock.

export const ALBUS_DOCK_WIDTH = 560; // px reserved on the right when Albus is open

let open = false;
const listeners = new Set<() => void>();

// Initialise the CSS var immediately so `right-[var(--albus-dock)]` resolves
// to 0px before Albus is ever opened.
if (typeof document !== "undefined") {
  document.documentElement.style.setProperty("--albus-dock", "0px");
}

export function setAlbusDockOpen(v: boolean) {
  if (v === open) return;
  open = v;
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--albus-dock", v ? `${ALBUS_DOCK_WIDTH}px` : "0px");
  }
  listeners.forEach((l) => l());
}

export function getAlbusDockOpen() {
  return open;
}

export function subscribeAlbusDock(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
