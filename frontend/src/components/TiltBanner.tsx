import { useEffect, useId, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { getTiltStatus, type TiltWarning } from "../api.js";

interface TiltBannerProps {
  userId: string;
}

export default function TiltBanner({ userId }: TiltBannerProps) {
  const channelId = useId();
  const [warning, setWarning] = useState<TiltWarning | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getTiltStatus()
      .then((w) => setWarning(w))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`tilt-${userId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "TiltEvent",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as TiltWarning;
          setWarning(row);
          setDismissed(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelId]);

  if (!warning || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-card border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 shadow-[0_0_24px_rgba(245,158,11,0.15)] backdrop-blur-sm animate-rise"
    >
      <span aria-hidden className="text-lg leading-none">⚠️</span>
      <div className="flex-1 text-sm">
        <p className="font-display font-semibold text-amber-300">
          Tilt warning: {warning.lossCount} losses in the last 45 minutes
        </p>
        <p className="mt-0.5 text-amber-100/80">{warning.suggestion}</p>
      </div>
      <button
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="rounded-lg px-2 text-lg leading-none text-amber-300/70 transition-colors hover:text-amber-200"
      >
        ×
      </button>
    </div>
  );
}
