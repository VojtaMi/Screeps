import { useState } from "react";
import { BuildPlansData } from "../types";
import { savePlans } from "../plan/api";

interface ActionsPanelProps {
  plans: BuildPlansData;
  hasValidationErrors: boolean;
}

export function ActionsPanel({
  plans,
  hasValidationErrors,
}: ActionsPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage("Applying...");

    const result = await savePlans(plans);

    if (result.ok) {
      setSaveMessage("Saved successfully!");
      setTimeout(() => setSaveMessage(""), 3000);
    } else {
      setSaveMessage(`Save failed: ${result.error}`);
    }

    setIsSaving(false);
  }

  return (
    <div className="build-plan-panel panel">
      <h2>Actions</h2>
      <button
        onClick={handleSave}
        disabled={isSaving || hasValidationErrors}
        className="save-btn"
      >
        {isSaving ? "Applying..." : "Apply Build Plan"}
      </button>
      {saveMessage && <p className="save-message">{saveMessage}</p>}
    </div>
  );
}
