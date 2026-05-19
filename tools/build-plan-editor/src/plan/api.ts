import { BuildPlansData } from "../types";

interface ApiResponse {
  plans: BuildPlansData;
  availableTerrains: string[];
}

export async function loadPlans(): Promise<{
  plans: BuildPlansData;
  initialRoom: string;
  initialStep: number;
}> {
  const response = await fetch("/api/build-plans");
  const data: ApiResponse = await response.json();
  const roomNames = Object.keys(data.plans);
  const initialRoom = roomNames[0] || "";
  const initialStep = initialRoom ? data.plans[initialRoom].plan.length : 0;
  return { plans: data.plans, initialRoom, initialStep };
}

export async function savePlans(
  plans: BuildPlansData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/build-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans }),
    });

    if (response.ok) {
      return { ok: true };
    } else {
      const error = await response.json();
      return { ok: false, error: error.error || "Unknown error" };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
