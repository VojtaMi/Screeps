interface TerrainWarningProps {
  selectedRoom: string;
  hasTerrain: boolean;
}

export function TerrainWarning({
  selectedRoom,
  hasTerrain,
}: TerrainWarningProps) {
  if (!selectedRoom || hasTerrain) {
    return null;
  }

  return (
    <div className="build-plan-panel panel warning-panel">
      <h2>Terrain Missing</h2>
      <p>Natural wall placement cannot be validated for {selectedRoom}.</p>
    </div>
  );
}
