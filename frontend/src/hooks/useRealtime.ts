import { useEffect, useId, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import type { LeaderboardEntry } from "../api.js";

export interface RatingUpdate {
  userId: string;
  username: string;
  timeControl: string;
  rating: number;
  delta: number;
}

export function useRealtime(
  entries: LeaderboardEntry[],
  activeTab: string,
  onUpdate: (update: RatingUpdate) => void
): void {
  const id = useId();
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const channel = supabase
      .channel(`ratings-${activeTab}-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Rating",
          filter: `timeControl=eq.${activeTab}`,
        },
        (payload) => {
          const newRow = payload.new as {
            userId: string;
            timeControl: string;
            rating: number;
          };
          const oldRow = payload.old as { rating?: number };
          const entry = entriesRef.current.find((e) => e.userId === newRow.userId);
          if (!entry) return;
          const delta = newRow.rating - (oldRow.rating ?? newRow.rating);
          onUpdateRef.current({
            userId: newRow.userId,
            username: entry.username,
            timeControl: newRow.timeControl,
            rating: newRow.rating,
            delta,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, id]);
}
