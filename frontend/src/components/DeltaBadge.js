import { jsx as _jsx } from "react/jsx-runtime";
export default function DeltaBadge({ delta }) {
    const isPositive = delta >= 0;
    return (_jsx("span", { className: `text-xs font-semibold animate-fade-out ${isPositive ? "text-green-400" : "text-red-400"}`, children: isPositive ? `+${delta}` : `${delta}` }));
}
