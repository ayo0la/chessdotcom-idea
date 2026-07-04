const TABS = ["bullet", "blitz", "rapid", "classical"] as const;
export type TimeControl = (typeof TABS)[number];

interface Props {
  active: TimeControl;
  onChange: (tc: TimeControl) => void;
}

export default function TimeControlTabs({ active, onChange }: Props) {
  return (
    <div className="mb-4 inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
      {TABS.map((tc) => (
        <button
          key={tc}
          onClick={() => onChange(tc)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all duration-200 ease-swift sm:px-4 ${
            active === tc
              ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-glow-sm"
              : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200"
          }`}
        >
          {tc}
        </button>
      ))}
    </div>
  );
}
