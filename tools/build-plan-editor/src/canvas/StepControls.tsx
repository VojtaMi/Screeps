interface StepControlsProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
}

export function StepControls({
  currentStep,
  totalSteps,
  onStepChange,
}: StepControlsProps) {
  return (
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
        Step {currentStep} / {totalSteps}
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
  );
}
