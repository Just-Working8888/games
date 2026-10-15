import './toast.css';

/** Тост; опционально с кнопкой действия (например «Пополнить» при нехватке монет). */
export function Toast({
  message,
  actionLabel,
  onAction,
}: {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`toast ${message ? 'toast--show' : ''}`} role="status">
      <span>{message}</span>
      {message && actionLabel && onAction && (
        <button className="toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
