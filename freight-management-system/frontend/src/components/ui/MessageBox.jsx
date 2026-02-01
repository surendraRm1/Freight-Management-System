import { useEffect } from 'react';
import { clsx } from 'clsx';

const toneStyles = {
  info: 'bg-blue-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  error: 'bg-red-600 text-white',
};

const MessageBox = ({ message, tone = 'info', onClose }) => {
  useEffect(() => {
    if (!message) return undefined;

    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={clsx(
        'fixed top-5 right-5 z-50 flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl transition transform-gpu',
        toneStyles[tone] ?? toneStyles.info
      )}
      role="alert"
    >
      <span className="text-sm leading-5">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-lg leading-none opacity-70 transition hover:opacity-100"
          aria-label="Close notification"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default MessageBox;

