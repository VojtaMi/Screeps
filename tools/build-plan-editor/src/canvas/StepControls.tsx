import { useEffect, useState } from "react";

interface StepControlsProps {
  currentStep: number;
  totalSteps: number;
  currentRcl: number;
  onStepChange: (step: number) => void;
}

export function StepControls({
  currentStep,
  totalSteps,
  currentRcl,
  onStepChange,
}: StepControlsProps) {
  const [draft, setDraft] = useState(String(currentStep));

  // Keep the input in sync when the step changes from elsewhere (buttons, etc.).
  useEffect(() => {
    setDraft(String(currentStep));
  }, [currentStep]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(currentStep));
      return;
    }
    const clamped = Math.min(totalSteps, Math.max(0, parsed));
    onStepChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="map-step-stack">
    <div className="map-step-controls">
      <button
        type="button"
        onClick={() => onStepChange(0)}
        disabled={currentStep === 0}
        title="First step"
      >
        &lt;&lt;
      </button>
      <button
        type="button"
        onClick={() => onStepChange(Math.max(0, currentStep - 1))}
        disabled={currentStep === 0}
        title="Previous step"
      >
        &lt;
      </button>
      <div className="map-step-display">
        Step{" "}
        <input
          type="number"
          className="map-step-input"
          min={0}
          max={totalSteps}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(String(currentStep));
              e.currentTarget.blur();
            }
          }}
          title="Jump to step"
        />{" "}
        / {totalSteps}
      </div>
      <button
        type="button"
        onClick={() => onStepChange(Math.min(totalSteps, currentStep + 1))}
        disabled={currentStep === totalSteps}
        title="Next step"
      >
        &gt;
      </button>
      <button
        type="button"
        onClick={() => onStepChange(totalSteps)}
        disabled={currentStep === totalSteps}
        title="Last step"
      >
        &gt;&gt;
      </button>
    </div>
      <div className="map-step-rcl">RCL {currentRcl}</div>
    </div>
  );
}
