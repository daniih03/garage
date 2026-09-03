import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { parseProjectCSV } from '../../lib/csvExportImport'

export default function ImportProjectModal({ project, onImportSuccess, onClose }) {
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const fileInputRef = useRef(null)

  function handleFileSelected(e) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setError('')

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor selecciona un archivo con extensión .csv')
      return
    }

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const text = event.target?.result
        if (!text) {
          setError('El archivo CSV está vacío.')
          setParsedData(null)
          return
        }

        const data = parseProjectCSV(text)
        if (!data.milestones || data.milestones.length === 0) {
          setError('No se encontraron hitos válidos en el archivo CSV.')
          setParsedData(null)
          return
        }

        setParsedData(data)
      } catch (err) {
        setError('Error al procesar el archivo CSV: ' + err.message)
        setParsedData(null)
      }
    }

    reader.onerror = () => {
      setError('Error al leer el archivo.')
      setParsedData(null)
    }

    reader.readAsText(selectedFile, 'UTF-8')
  }

  async function handleImport() {
    if (!parsedData || importing) return
    setImporting(true)
    setError('')

    try {
      const { data: authData } = await supabase.auth.getUser()
      const currentUserId = authData?.user?.id ?? null

      // 1. Obtener hitos existentes del proyecto en Supabase
      setProgressMsg('Comprobando hitos existentes...')
      const { data: existingMilestones, error: mError } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', project.id)

      if (mError) throw mError

      const milestoneMap = new Map() // number -> milestone record en DB
      for (const m of existingMilestones || []) {
        milestoneMap.set(m.number, m)
      }

      // 2. Crear los hitos faltantes o actualizar los existentes
      for (const mData of parsedData.milestones) {
        setProgressMsg(`Procesando Hito #${mData.number}: ${mData.title}...`)

        let dbMilestone = milestoneMap.get(mData.number)
        if (!dbMilestone) {
          // Insertar hito
          const { data: insertedM, error: insError } = await supabase
            .from('milestones')
            .insert({
              project_id: project.id,
              number: mData.number,
              title: mData.title || `Hito ${mData.number}`,
            })
            .select('*')
            .single()

          if (insError) throw insError
          dbMilestone = insertedM
          milestoneMap.set(mData.number, dbMilestone)
        }

        // 3. Obtener tarjetas existentes de este hito
        const { data: existingCards, error: cError } = await supabase
          .from('cards')
          .select('id, card_number, position')
          .eq('project_id', project.id)
          .eq('milestone_id', dbMilestone.id)

        if (cError) throw cError

        const existingCardNumbers = new Set((existingCards || []).map(c => c.card_number))
        let maxCardNumber = (existingCards || []).reduce((max, c) => Math.max(max, c.card_number || 0), 0)
        let maxPos = (existingCards || []).reduce((max, c) => Math.max(max, c.position || 0), 0)

        // 4. Insertar tarjetas del hito
        for (const cardData of mData.cards) {
          let cardNum = cardData.card_number
          if (!cardNum || existingCardNumbers.has(cardNum)) {
            maxCardNumber += 1
            cardNum = maxCardNumber
          } else {
            maxCardNumber = Math.max(maxCardNumber, cardNum)
          }
          existingCardNumbers.add(cardNum)

          maxPos += 1
          const msPad = String(mData.number).padStart(2, '0')
          const displayId = `${project.repo_acronym}-${msPad}-${String(cardNum).padStart(3, '0')}`

          const payload = {
            project_id: project.id,
            milestone_id: dbMilestone.id,
            card_number: cardNum,
            display_id: displayId,
            title: cardData.title,
            description: cardData.description || null,
            status: cardData.status || 'todo',
            primary_type: cardData.primary_type || null,
            secondary_type: cardData.secondary_type || null,
            priority: cardData.priority || null,
            position: maxPos,
            created_by: currentUserId,
            created_at: cardData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const { error: insCardError } = await supabase.from('cards').insert(payload)
          if (insCardError) throw insCardError
        }
      }

      setProgressMsg('¡Importación completada con éxito!')
      setTimeout(() => {
        onImportSuccess?.()
      }, 600)
    } catch (err) {
      console.error('Error importando proyecto:', err)
      setError('Error durante la importación: ' + (err.message || err))
      setImporting(false)
      setProgressMsg('')
    }
  }

  const totalCards = parsedData?.milestones?.reduce((acc, m) => acc + (m.cards?.length || 0), 0) ?? 0

  return createPortal(
    <div className="modal-overlay" onClick={e => !importing && e.target === e.currentTarget && onClose()}>
      <div className="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--accent)' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <h2 className="modal__title" id="import-modal-title">Importar proyecto desde CSV</h2>
          </div>
          <button type="button" className="modal__close" onClick={onClose} disabled={importing} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__scrollable" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <p className="form-error" role="alert">{error}</p>}

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Selecciona un archivo <strong>.csv</strong> exportado previamente desde Garage.
            Se importarán los hitos y tarjetas con sus estados, tipos, prioridades y fechas al proyecto actual (<strong>{project.repo_name}</strong>).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
            disabled={importing}
          />

          <div
            className="import-dropzone"
            onClick={() => !importing && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, color: 'var(--accent)' }} aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {file ? file.name : 'Haz clic para seleccionar el archivo .csv'}
              </span>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Archivos exportados de Garage (.csv)'}
              </p>
            </div>
          </div>

          {/* Vista previa tras parsear */}
          {parsedData && (
            <div className="import-preview-box">
              <div className="import-preview-header">
                <span className="import-preview-title">Resumen detectado:</span>
                {parsedData.meta?.repo_name && (
                  <span className="import-preview-source">
                    Origen: <strong>{parsedData.meta.repo_name}</strong>
                  </span>
                )}
              </div>
              <div className="import-preview-stats">
                <div className="import-stat-chip">
                  <span className="import-stat-val">{parsedData.milestones.length}</span>
                  <span className="import-stat-lbl">Hitos</span>
                </div>
                <div className="import-stat-chip">
                  <span className="import-stat-val">{totalCards}</span>
                  <span className="import-stat-lbl">Tarjetas</span>
                </div>
              </div>

              <div className="import-preview-list">
                {parsedData.milestones.map(m => (
                  <div key={m.number} className="import-preview-item">
                    <span className="import-preview-item-num">#{m.number}</span>
                    <span className="import-preview-item-title">{m.title}</span>
                    <span className="import-preview-item-cards">{m.cards.length} tarjetas</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importing && (
            <div className="import-progress-box">
              <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>{progressMsg || 'Importando...'}</span>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={importing}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleImport}
            disabled={!parsedData || importing}
          >
            {importing ? 'Importando…' : `Importar ${totalCards > 0 ? `(${totalCards} tarjetas)` : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
