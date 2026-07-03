import { useEffect, useId, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  getDebriefPrompt,
  submitDebrief,
  type DebriefAnswers,
  type DebriefPromptInfo,
} from "../api.js";

interface DebriefModalProps {
  userId: string;
  onSubmitted: () => void;
}

const EMPTY_ANSWERS: DebriefAnswers = {
  opening: "",
  phase: "middlegame",
  losingMoment: "",
  cause: "blunder",
  hadPlan: "no",
  tooFast: "no",
  emotion: "calm",
  nextTime: "",
};

export default function DebriefModal({ userId, onSubmitted }: DebriefModalProps) {
  const channelId = useId();
  const [prompt, setPrompt] = useState<DebriefPromptInfo | null>(null);
  const [answers, setAnswers] = useState<DebriefAnswers>(EMPTY_ANSWERS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDebriefPrompt()
      .then((p) => setPrompt(p))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`debrief-${userId}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "DebriefPrompt",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          setPrompt(payload.new as DebriefPromptInfo);
          setAnswers(EMPTY_ANSWERS);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelId]);

  if (!prompt) return null;

  const set = (key: keyof DebriefAnswers) => (value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    if (!prompt) return;
    setSaving(true);
    try {
      await submitDebrief(prompt.gameId, answers);
      setPrompt(null);
      setAnswers(EMPTY_ANSWERS);
      onSubmitted();
    } catch {
      // leave the modal open so the player can retry
    } finally {
      setSaving(false);
    }
  }

  const text = (
    n: number,
    label: string,
    key: keyof DebriefAnswers,
    placeholder: string
  ) => (
    <label className="block text-sm">
      <span className="text-gray-300">
        {n}. {label}
      </span>
      <input
        type="text"
        value={answers[key]}
        onChange={(e) => set(key)(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-gray-100"
      />
    </label>
  );

  const select = (
    n: number,
    label: string,
    key: keyof DebriefAnswers,
    options: Array<[string, string]>
  ) => (
    <label className="block text-sm">
      <span className="text-gray-300">
        {n}. {label}
      </span>
      <select
        value={answers[key]}
        onChange={(e) => set(key)(e.target.value)}
        className="mt-1 w-full rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-gray-100"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-label="Post-game debrief"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-5"
      >
        <h2 className="text-lg font-bold">Quick debrief</h2>
        <p className="text-gray-400 text-xs mt-1 mb-4">
          You just lost a game. 90 seconds now saves rating points later.{" "}
          <a
            href={prompt.gameUrl}
            target="_blank"
            rel="noreferrer"
            className="text-green-400 hover:underline"
          >
            Review the game
          </a>
        </p>
        <div className="space-y-3">
          {text(1, "What opening did you play?", "opening", "e.g. Sicilian Defense")}
          {select(2, "Where did it go wrong?", "phase", [
            ["opening", "Opening"],
            ["middlegame", "Middlegame"],
            ["endgame", "Endgame"],
          ])}
          {text(3, "What was the losing moment?", "losingMoment", "e.g. hung a knight on move 24")}
          {select(4, "What kind of mistake was it?", "cause", [
            ["blunder", "Blunder"],
            ["positional", "Positional drift"],
            ["time", "Time pressure"],
            ["opponent", "Opponent played well"],
          ])}
          {select(5, "Did you have a plan in the position?", "hadPlan", [
            ["no", "No"],
            ["yes", "Yes"],
          ])}
          {select(6, "Were you moving too fast?", "tooFast", [
            ["no", "No"],
            ["yes", "Yes"],
          ])}
          {select(7, "How did you feel before the game?", "emotion", [
            ["calm", "Calm"],
            ["tilted", "Tilted"],
            ["tired", "Tired"],
            ["distracted", "Distracted"],
          ])}
          {text(8, "One thing to do differently next game?", "nextTime", "e.g. check for captures before moving")}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setPrompt(null)}
            className="text-sm px-3 py-1.5 rounded text-gray-400 hover:text-gray-200"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Save debrief"}
          </button>
        </div>
      </div>
    </div>
  );
}
