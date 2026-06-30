import { useEffect, useState } from "react";
import { BuildPlansData } from "../types";
import { loadPlans as loadPlansAPI } from "./api";

interface SelectedTile {
  x: number;
  y: number;
}

export function usePlan() {
  const [plans, setPlans] = useState<BuildPlansData>({});
  const [pastPlans, setPastPlans] = useState<BuildPlansData[]>([]);
  const [futurePlans, setFuturePlans] = useState<BuildPlansData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);

  useEffect(() => {
    loadInitialPlans();
  }, []);

  async function loadInitialPlans() {
    try {
      const {
        plans: loadedPlans,
        initialRoom,
        initialStep,
      } = await loadPlansAPI();
      setPlans(loadedPlans);
      setSelectedRoom(initialRoom);
      setCurrentStep(initialStep);
    } catch (error) {
      console.error("Failed to load plans:", error);
    }
  }

  function selectRoom(room: string) {
    setSelectedRoom(room);
    setCurrentStep(plans[room]?.plan.length ?? 0);
    clearTransientSelection();
  }

  function clearTransientSelection() {
    setSelectedItemIndex(null);
    setSelectedTile(null);
  }

  function clampStep(nextPlans: BuildPlansData) {
    if (!selectedRoom) {
      return 0;
    }

    return Math.min(currentStep, nextPlans[selectedRoom]?.plan.length ?? 0);
  }

  function commitPlans(nextPlans: BuildPlansData, nextStep?: number) {
    setPastPlans((current) => [...current, plans]);
    setFuturePlans([]);
    setPlans(nextPlans);
    setCurrentStep(nextStep ?? clampStep(nextPlans));
    clearTransientSelection();
  }

  function undoPlans() {
    if (pastPlans.length === 0) {
      return;
    }

    const previousPlans = pastPlans[pastPlans.length - 1];
    setPastPlans((current) => current.slice(0, -1));
    setFuturePlans((current) => [plans, ...current]);
    setPlans(previousPlans);
    setCurrentStep(clampStep(previousPlans));
    clearTransientSelection();
  }

  function redoPlans() {
    if (futurePlans.length === 0) {
      return;
    }

    const nextPlans = futurePlans[0];
    setFuturePlans((current) => current.slice(1));
    setPastPlans((current) => [...current, plans]);
    setPlans(nextPlans);
    setCurrentStep(clampStep(nextPlans));
    clearTransientSelection();
  }

  function deletePlanItem(itemIndex: number) {
    if (!selectedRoom) return;
    const plan = plans[selectedRoom].plan;
    const newPlan = plan.filter((_, i) => i !== itemIndex);

    commitPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    }, Math.min(currentStep, newPlan.length));
  }

  function scheduleDestroyItem(itemIndex: number) {
    if (!selectedRoom) return;
    const plan = plans[selectedRoom].plan;
    const item = plan[itemIndex];
    if (!item || item.action === "destroy") return;

    const destroyStep = {
      x: item.x,
      y: item.y,
      structureType: item.structureType,
      action: "destroy" as const,
    };
    const newPlan = [...plan, destroyStep];

    commitPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    }, newPlan.length);
  }

  return {
    plans,
    selectedRoom,
    selectRoom,
    currentStep,
    setCurrentStep,
    pastPlans,
    futurePlans,
    selectedItemIndex,
    setSelectedItemIndex,
    selectedTile,
    setSelectedTile,
    commitPlans,
    undoPlans,
    redoPlans,
    deletePlanItem,
    scheduleDestroyItem,
  };
}
