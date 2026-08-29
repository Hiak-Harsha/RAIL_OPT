import { useState, useCallback } from "react";
import type { Train } from "../types/railway";
import type { SelectedRailwayEntity } from "../components/NXPanel/NXTrackCanvas";

export function useEntitySelection() {
  const [selectedEntity, setSelectedEntity] = useState<SelectedRailwayEntity | null>(null);
  const [focusedTrainId, setFocusedTrainId] = useState<string | null>(null);

  const handleSelectEntity = useCallback((entity: SelectedRailwayEntity | null) => {
    setSelectedEntity(entity);
    if (entity && entity.type === "TRAIN") {
      setFocusedTrainId(entity.id);
    }
  }, []);

  const handleSelectTrain = useCallback((train: Train) => {
    setSelectedEntity({ type: "TRAIN", id: train.train_id, data: train });
    setFocusedTrainId(train.train_id);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedEntity(null);
    setFocusedTrainId(null);
  }, []);

  return {
    selectedEntity,
    focusedTrainId,
    setSelectedEntity,
    setFocusedTrainId,
    handleSelectEntity,
    handleSelectTrain,
    handleClearSelection
  };
}
