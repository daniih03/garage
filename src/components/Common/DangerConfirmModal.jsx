import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function DangerConfirmModal({
  title = '¿Eliminar elemento?',
  targetName = '',
  targetType = 'elemento',
  message = 'Esta acción es irreversible y destruirá todos los datos asociados.',
  confirmText = 'Eliminar definitivamente',
  onConfirm,
  onClose,
}) {
  const [agreed, setAgreed] = useState(false)
  const [inputText, setInputText] = useState('')
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  const REQUIRED_WORD = 'CONFIRM'
  const isMatch = inputText.trim().toUpperCase() === REQUIRED_WORD
  const isReady = agreed && isMatch

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (agreed && inputRef.current) {
      inputRef.current.focus()
    }
  }, [agreed])

  function handlePaste(e) {
    e.preventDefault()
    setPasteBlocked(true)
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  function handleDrop(e) {
    e.preventDefault()
    setPasteBlocked(true)
  }

  function handleInputChange(e) {
    // Force uppercase
    setInputText(e.target.value.toUpperCase())
    if (pasteBlocked) setPasteBlocked(false)
  }

  function handleProceed() {
    if (!isReady) return
    onConfirm()
    onClose()
  }

  return createPortal(
    <div
      className="modal-overlay danger-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 100010 }}
    >
      <div
        className="modal modal--sm danger-modal animate-modal-enter"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="danger-modal-title"
      >
        {/* ── Warning Hazard Stripes Bar ── */}
        <div className="danger-hazard-stripes" aria-hidden="true" />

        {/* ── Header ── */}
        <div className="modal__header danger-modal__header">
          <div className="danger-header-badge">
            <span className="danger-pulse-icon" aria-hidden="true">⚠️</span>
            <span className="danger-badge-text">ZONA DE PELIGRO CRÍTICO</span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="modal__form danger-modal__form">
          <h2 className="danger-modal__title" id="danger-modal-title">{title}</h2>

          {targetName && (
            <div className="danger-target-box">
              <span className="danger-target-label">
                {targetType.toUpperCase()}:
              </span>
              <strong className="danger-target-name">{targetName}</strong>
            </div>
          )}

          <p className="danger-modal__desc">{message}</p>

          {/* ── Step 1: Tick confirmation ── */}
          <label className="danger-checkbox-label">
            <input
              type="checkbox"
              className="danger-checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="danger-checkbox-text">
              Entiendo que esta acción es <strong>permanente</strong> y destruirá los datos sin posibilidad de recuperación.
            </span>
          </label>

          {/* ── Step 2: Slide-in verification input ── */}
          <div className={`danger-slide-section${agreed ? ' is-visible' : ''}`}>
            <p className="danger-input-instruction">
              Para desbloquear la eliminación, escribe <code>{REQUIRED_WORD}</code> a continuación:
            </p>

            <div className={`danger-input-wrapper${shake ? ' is-shaking' : ''}`}>
              <input
                ref={inputRef}
                type="text"
                className={`danger-input${isMatch ? ' is-valid' : ''}`}
                value={inputText}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onDrop={handleDrop}
                placeholder="Escribe CONFIRM aquí…"
                disabled={!agreed}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />

              {/* Status indicator letters */}
              <div className="danger-letters-preview" aria-hidden="true">
                {REQUIRED_WORD.split('').map((char, index) => {
                  const typed = inputText[index]
                  const isCharMatch = typed === char
                  return (
                    <span
                      key={index}
                      className={`danger-char${isCharMatch ? ' is-matched' : typed ? ' is-error' : ''}`}
                    >
                      {char}
                    </span>
                  )
                })}
              </div>
            </div>

            {pasteBlocked && (
              <div className="danger-paste-warning" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                <span>No se permite pegar del portapapeles. Escríbelo manualmente.</span>
              </div>
            )}
          </div>

          {/* ── Footer / Actions ── */}
          <div className="modal__footer danger-modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`btn btn--danger-critical${isReady ? ' is-armed' : ' is-locked'}`}
              disabled={!isReady}
              onClick={handleProceed}
            >
              {!isReady ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Bloqueado
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  {confirmText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
