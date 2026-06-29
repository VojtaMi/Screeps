import { BuildPlansData } from "../types";
import {
  type ValidationError,
  validateRoomPlan,
  validateSameTile,
} from "./validationCore.mjs";

export function validatePlans(
  plans: BuildPlansData,
  selectedRoom: string,
  terrain: string
): ValidationError[] {
  if (!selectedRoom) return [];

  const errors: ValidationError[] = [];
  const plan = plans[selectedRoom]?.plan ?? [];

  errors.push(...validateRoomPlan(plan, terrain));

  return errors;
}

export { validateSameTile };
