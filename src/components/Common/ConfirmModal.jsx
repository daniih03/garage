import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmModal({
  title = '¿Confirmar eliminación?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  danger = true,
  onConfirm,
  onClose,
}) {
  const cancelBtnRef = useRef(null)

  useEffect(() => {
    cancelBtnRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1100 }}
    >
      <div
        className="modal modal--sm animate-modal-enter"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <div className="modal__header">
          <h2 className="modal__title" id="confirm-modal-title">
            {title}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__form">
          <p
            id="confirm-modal-desc"
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              margin: '6px 0 10px',
            }}
          >
            {message}
          </p>

          <div className="modal__footer">
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
