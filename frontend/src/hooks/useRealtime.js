import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
export function useRealtime(entries, activeTab, onUpdate) {
    const entriesRef = useRef(entries);
    entriesRef.current = entries;
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;
    useEffect(() => {
        const channel = supabase
            .channel(`ratings-${activeTab}`)
            .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "Rating",
            filter: `timeControl=eq.${activeTab}`,
        }, (payload) => {
            const newRow = payload.new;
            const oldRow = payload.old;
            const entry = entriesRef.current.find((e) => e.userId === newRow.userId);
            if (!entry)
                return;
            const delta = newRow.rating - (oldRow.rating ?? newRow.rating);
            onUpdateRef.current({
                userId: newRow.userId,
                username: entry.username,
                timeControl: newRow.timeControl,
                rating: newRow.rating,
                delta,
            });
        })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab]);
}
