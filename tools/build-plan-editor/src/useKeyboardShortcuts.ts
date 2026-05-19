import { useEffect } from "react";

export function useKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void,
  onEscape?: () => void
): void {
  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target;
      const isFormControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement;

      if (event.key === "Escape") {
        onEscape?.();
        return;
      }

      if (isFormControl || (!event.ctrlKey && !event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        onRedo();
      } else if (key === "z") {
        event.preventDefault();
        onUndo();
      } else if (key === "y") {
        event.preventDefault();
        onRedo();
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [onUndo, onRedo, onEscape]);
}
