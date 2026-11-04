import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const sizes = {
    sm: { icon: 'text-3xl', title: 'text-base', desc: 'text-xs', padding: 'p-6' },
    md: { icon: 'text-5xl', title: 'text-lg', desc: 'text-sm', padding: 'p-8' },
    lg: { icon: 'text-6xl', title: 'text-xl', desc: 'text-base', padding: 'p-12' },
  };

  const s = sizes[size];

  return (
    <div className={`glass-card rounded-xl ${s.padding} text-center fade-in`}>
      {icon && <div className={`${s.icon} mb-4 block`}>{icon}</div>}
      <h3 className={`${s.title} font-semibold text-graphite-200 mb-2`}>{title}</h3>
      {description && <p className={`${s.desc} text-graphite-400 mb-4 max-w-md mx-auto`}>{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-violet-accent hover:bg-violet-dark text-white rounded-lg font-medium transition-colors text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
