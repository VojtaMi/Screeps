interface ValidationError {
  step: number;
  message: string;
}

interface ValidationErrorsProps {
  errors: ValidationError[];
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="build-plan-panel panel error-panel">
      <h2>Validation Errors</h2>
      <ul>
        {errors.slice(0, 5).map((error, i) => (
          <li key={i}>
            Step {error.step}: {error.message}
          </li>
        ))}
        {errors.length > 5 && (
          <li>... and {errors.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}
