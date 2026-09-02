import { useState, useRef, useEffect } from 'react'

export default function FilterPopover({
  label,
  icon,
  value,
  options,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find(o => o.id === value) || options[0]
  const isActive = value !== 'all'

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      const onKey = e => e.key === 'Escape' && setIsOpen(false)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', onKey)
      }
    }
  }, [isOpen])

  function handleSelect(optId) {
    onChange(optId)
    setIsOpen(false)
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange('all')
  }

  return (
    <div className="filter-popover-container" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`filter-popover-trigger${isActive ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Icon */}
        <span className="filter-popover-icon" aria-hidden="true">
          {icon}
        </span>

        {/* Label */}
        <span className="filter-popover-label">{label}:</span>

        {/* Value badge */}
        <span
          className="filter-popover-value"
          style={isActive && selectedOption.color ? { color: selectedOption.color, backgroundColor: `${selectedOption.color}1A` } : {}}
        >
          {isActive && selectedOption.color && (
            <span
              className="filter-popover-dot"
              style={{ backgroundColor: selectedOption.color }}
              aria-hidden="true"
            />
          )}
          {selectedOption.shortLabel || selectedOption.label}
        </span>

        {/* Clear mini button if active */}
        {isActive && (
          <span
            role="button"
            tabIndex={0}
            className="filter-popover-remove"
            onClick={handleClear}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') handleClear(e)
            }}
            title="Quitar este filtro"
            aria-label={`Quitar filtro ${label}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        )}

        {/* Chevron arrow */}
        <svg
          className={`filter-popover-chevron${isOpen ? ' is-rotated' : ''}`}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div className="filter-popover-menu" role="listbox" aria-label={label}>
          <div className="filter-popover-menu__header">
            Filtrar por {label.toLowerCase()}
          </div>
          <div className="filter-popover-menu__list">
            {options.map(opt => {
              const isOptionSelected = opt.id === value
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isOptionSelected}
                  className={`filter-popover-item${isOptionSelected ? ' is-selected' : ''}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  {/* Dot / Indicator */}
                  {opt.color ? (
                    <span
                      className="filter-popover-item__dot"
                      style={{ backgroundColor: opt.color }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="filter-popover-item__dot filter-popover-item__dot--all" aria-hidden="true" />
                  )}

                  {/* Label */}
                  <span className="filter-popover-item__label">
                    {opt.label}
                  </span>

                  {/* Checkmark */}
                  {isOptionSelected && (
                    <svg
                      className="filter-popover-item__check"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={opt.color || 'var(--accent)'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
