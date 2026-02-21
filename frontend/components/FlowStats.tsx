interface FlowStatsProps {
  stats: Array<{
    label: string;
    value: string | number;
  }>;
}

export default function FlowStats({ stats }: FlowStatsProps) {
  return (
    <div className="mt-10 flex items-center justify-center gap-6 sm:gap-10 text-center">
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-6 sm:gap-10">
          {index > 0 && <div className="w-px h-8 bg-gray-200" />}
          <div>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
