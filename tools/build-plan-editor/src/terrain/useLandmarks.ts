import { useEffect, useState } from "react";
import { RoomLandmark } from "../types";

interface LandmarkSnapshot {
  room: string;
  shard: string;
  landmarks: RoomLandmark[];
}

export function useLandmarks(roomName: string): {
  landmarks: RoomLandmark[];
  landmarkShard: string;
} {
  const [landmarks, setLandmarks] = useState<RoomLandmark[]>([]);
  const [landmarkShard, setLandmarkShard] = useState<string>("");

  useEffect(() => {
    if (!roomName) {
      setLandmarks([]);
      setLandmarkShard("");
      return;
    }

    loadLandmarks(roomName);
  }, [roomName]);

  async function loadLandmarks(room: string) {
    try {
      const response = await fetch(`/api/landmarks/${room}`);
      if (response.ok) {
        const data: LandmarkSnapshot = await response.json();
        setLandmarks(data.landmarks);
        setLandmarkShard(data.shard);
      } else {
        setLandmarks([]);
        setLandmarkShard("");
      }
    } catch (error) {
      console.error("Failed to load landmarks:", error);
      setLandmarks([]);
      setLandmarkShard("");
    }
  }

  return { landmarks, landmarkShard };
}
