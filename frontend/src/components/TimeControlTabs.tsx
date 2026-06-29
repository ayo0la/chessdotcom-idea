const TABS = ["bullet", "blitz", "rapid", "classical"] as const;
export type TimeControl = (typeof TABS)[number];

interface Props {
  active: TimeControl;
  onChange: (tc: TimeControl) => void;
}

export default function TimeControlTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-4">
      {TABS.map((tc) => (
        <button
          key={tc}
          onClick={() => onChange(tc)}
          className={`px-4 py-1.5 rounded text-sm font-medium capitalize ${
            active === tc
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {tc}
        </button>
      ))}
    </div>
  );
}
