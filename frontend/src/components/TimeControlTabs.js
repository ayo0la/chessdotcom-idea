import { jsx as _jsx } from "react/jsx-runtime";
const TABS = ["bullet", "blitz", "rapid", "classical"];
export default function TimeControlTabs({ active, onChange }) {
    return (_jsx("div", { className: "flex gap-1 mb-4", children: TABS.map((tc) => (_jsx("button", { onClick: () => onChange(tc), className: `px-4 py-1.5 rounded text-sm font-medium capitalize ${active === tc
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`, children: tc }, tc))) }));
}
