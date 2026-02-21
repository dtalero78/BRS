import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface FlowOptionProps {
  letter: string;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const badgeColorClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-500',
};

export default function FlowOption({
  letter,
  title,
  description,
  href,
  onClick,
  badge,
  badgeColor = 'blue',
  icon: Icon,
  disabled = false,
}: FlowOptionProps) {
  const content = (
    <>
      {/* Letter circle */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
        {letter}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0 ml-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />}
          <span className="text-base font-medium text-gray-900">{title}</span>
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>

      {/* Right side: badge + arrow */}
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        {badge && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeColorClasses[badgeColor]}`}>
            {badge}
          </span>
        )}
        <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
      </div>
    </>
  );

  const baseClasses = `group flex items-center w-full border-2 rounded-xl p-4 sm:p-5 transition-all duration-200 ${
    disabled
      ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
      : 'border-gray-200 bg-white hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
  }`;

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`${baseClasses} text-left`}
      disabled={disabled}
    >
      {content}
    </button>
  );
}
