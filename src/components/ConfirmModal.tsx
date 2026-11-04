import { ReactNode } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  icon?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
  icon,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'bg-error/20 border-error/30 text-error hover:bg-error/30',
      icon: '🗑️',
    },
    warning: {
      button: 'bg-warning/20 border-warning/30 text-warning hover:bg-warning/30',
      icon: '⚠️',
    },
    info: {
      button: 'bg-info/20 border-info/30 text-info hover:bg-info/30',
      icon: 'ℹ️',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
      <div className="glass-card rounded-xl p-6 max-w-md w-full slide-up shadow-2xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl flex-shrink-0">{icon || style.icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-graphite-100 mb-2">{title}</h3>
            <p className="text-sm text-graphite-300 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${style.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
