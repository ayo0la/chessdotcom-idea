interface Props {
  delta: number;
}

export default function DeltaBadge({ delta }: Props) {
  const isPositive = delta >= 0;
  return (
    <span
      className={`text-xs font-semibold animate-fade-out ${
        isPositive ? "text-green-400" : "text-red-400"
      }`}
    >
      {isPositive ? `+${delta}` : `${delta}`}
    </span>
  );
}
