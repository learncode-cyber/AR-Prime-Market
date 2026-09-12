// Shared coordinator for the bottom-right AI/contact FAB stack.
// Other components (WhatsApp FAB, Raiyan emoji FAB, greeting bubble) subscribe
// to know when the AI panel is open so they can hide to prevent overlap.
// Also exposes a sticky-offset hook that lifts the stack above the footer
// Subscribe section so floating buttons never sit on top of inputs.

import { useEffect, useState } from "react";

type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();
let aiOpenState = false;

export function setAiOpen(open: boolean) {
  aiOpenState = open;
  listeners.forEach((l) => l(open));
}

export function useAiOpen(): boolean {
  const [open, setOpen] = useState(aiOpenState);
  useEffect(() => {
    listeners.add(setOpen);
    setOpen(aiOpenState);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);
  return open;
}
