import { useState, useEffect } from "react";

interface TerrainSnapshot {
  room: string;
  shard: string;
  terrain: string;
}

export function useTerrain(roomName: string): {
  terrain: string;
  terrainShard: string;
} {
  const [terrain, setTerrain] = useState<string>("");
  const [terrainShard, setTerrainShard] = useState<string>("");

  useEffect(() => {
    if (!roomName) {
      setTerrain("");
      setTerrainShard("");
      return;
    }

    loadTerrain(roomName);
  }, [roomName]);

  async function loadTerrain(room: string) {
    try {
      const response = await fetch(`/api/terrain/${room}`);
      if (response.ok) {
        const data: TerrainSnapshot = await response.json();
        setTerrain(data.terrain);
        setTerrainShard(data.shard);
      } else {
        setTerrain("");
        setTerrainShard("");
      }
    } catch (error) {
      console.error("Failed to load terrain:", error);
      setTerrain("");
      setTerrainShard("");
    }
  }

  return { terrain, terrainShard };
}
