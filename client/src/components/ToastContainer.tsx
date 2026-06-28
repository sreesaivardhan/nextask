import { useToastStore } from '../stores/toastStore';

export function ToastContainer(): React.ReactElement | null {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-surface border border-strong border-l-2 border-l-status-danger';
      case 'success':
        return 'bg-surface border border-strong border-l-2 border-l-status-success';
      default:
        return 'bg-surface border border-strong border-l-2 border-l-primary';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center justify-between min-w-[300px] max-w-md p-4 rounded-xl shadow-floating text-primary ${getToastStyles(toast.type)}`}
        >
          <span className="text-sm leading-snug">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-4 text-muted hover:text-primary focus:outline-none shrink-0 transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
