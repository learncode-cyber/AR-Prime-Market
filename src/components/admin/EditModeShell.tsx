import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Ctx = {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  lock: () => void;
  unlock: () => void;
};

const EditModeContext = createContext<Ctx | null>(null);

/**
 * Hook to read edit-mode state inside an EditModeProvider.
 * Falls back to "always editable" when used outside a provider so legacy
 * components keep working.
 */
export function useEditMode(): Ctx {
  const ctx = useContext(EditModeContext);
  if (ctx) return ctx;
  return { editMode: true, setEditMode: () => {}, lock: () => {}, unlock: () => {} };
}

export function EditModeProvider({
  children,
  defaultEdit = false,
}: {
  children: ReactNode;
  defaultEdit?: boolean;
}) {
  const [editMode, setEditMode] = useState(defaultEdit);
  return (
    <EditModeContext.Provider
      value={{
        editMode,
        setEditMode,
        lock: () => setEditMode(false),
        unlock: () => setEditMode(true),
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

/**
 * Header button used to toggle edit mode on a config page/section.
 * Place at the top-right of the section header.
 */
export function EditModeToggle({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "default";
}) {
  const { editMode, setEditMode } = useEditMode();
  return (
    <Button
      type="button"
      size={size}
      variant={editMode ? "secondary" : "default"}
      onClick={() => setEditMode(!editMode)}
      className={cn("gap-1.5", className)}
    >
      {editMode ? (
        <>
          <Lock className="w-3.5 h-3.5" /> View Only
        </>
      ) : (
        <>
          <Pencil className="w-3.5 h-3.5" /> পরিবর্তন করুন
        </>
      )}
    </Button>
  );
}

/**
 * Wraps form content. When edit mode is off, the native `<fieldset disabled>`
 * disables all inputs, selects, switches, and buttons inside (including the
 * Save button) and applies a muted/grayed-out appearance — fields remain
 * fully visible.
 */
export function EditModeFieldset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { editMode } = useEditMode();
  return (
    <fieldset
      disabled={!editMode}
      className={cn(
        "min-w-0 border-0 p-0 m-0",
        !editMode && "opacity-60 cursor-not-allowed [&_*]:!cursor-not-allowed",
        className,
      )}
      aria-disabled={!editMode}
    >
      {children}
    </fieldset>
  );
}
