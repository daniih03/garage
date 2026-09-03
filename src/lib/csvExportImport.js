/**
 * Utilidades para Exportar e Importar proyectos de Garage en formato CSV
 */

export function escapeCSV(val) {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

export function parseCSV(text) {
  const rows = []
  let currentRow = []
  let currentVal = ''
  let insideQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"'
          i += 2
          continue
        } else {
          insideQuotes = false
          i++
          continue
        }
      } else {
        currentVal += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        insideQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentVal)
        currentVal = ''
        i++
        continue
      } else if (char === '\r') {
        if (nextChar === '\n') i++
        currentRow.push(currentVal)
        currentVal = ''
        rows.push(currentRow)
        currentRow = []
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentVal)
        currentVal = ''
        rows.push(currentRow)
        currentRow = []
        i++
        continue
      } else {
        currentVal += char
        i++
        continue
      }
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal)
    rows.push(currentRow)
  }

  return rows
}

export function generateProjectCSV({ project, milestones, cards }) {
  const lines = []

  // 1. Metadata del proyecto
  lines.push(['RECORD_TYPE', 'KEY', 'VALUE'].map(escapeCSV).join(','))
  lines.push(['PROJECT_META', 'repo_name', project.repo_name || ''].map(escapeCSV).join(','))
  lines.push(['PROJECT_META', 'repo_acronym', project.repo_acronym || ''].map(escapeCSV).join(','))
  lines.push(['PROJECT_META', 'repo_full_name', project.repo_full_name || ''].map(escapeCSV).join(','))
  lines.push(['PROJECT_META', 'description', project.description || ''].map(escapeCSV).join(','))
  lines.push(['PROJECT_META', 'exported_at', new Date().toISOString()].map(escapeCSV).join(','))

  lines.push('')

  // 2. Cabeceras de hitos y tarjetas
  const dataHeaders = [
    'RECORD_TYPE',
    'milestone_number',
    'milestone_title',
    'card_number',
    'display_id',
    'title',
    'description',
    'status',
    'primary_type',
    'secondary_type',
    'priority',
    'position',
    'created_at',
  ]
  lines.push(dataHeaders.map(escapeCSV).join(','))

  const cardsByMilestone = {}
  for (const c of cards || []) {
    if (!cardsByMilestone[c.milestone_id]) {
      cardsByMilestone[c.milestone_id] = []
    }
    cardsByMilestone[c.milestone_id].push(c)
  }

  const sortedMilestones = [...(milestones || [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))

  for (const m of sortedMilestones) {
    lines.push([
      'MILESTONE',
      String(m.number ?? ''),
      m.title || '',
      '', '', '', '', '', '', '', '', '',
      m.created_at || '',
    ].map(escapeCSV).join(','))

    const mCards = [...(cardsByMilestone[m.id] || [])].sort((a, b) => (a.card_number ?? 0) - (b.card_number ?? 0))
    for (const c of mCards) {
      lines.push([
        'CARD',
        String(m.number ?? ''),
        m.title || '',
        String(c.card_number ?? ''),
        c.display_id || '',
        c.title || '',
        c.description || '',
        c.status || 'todo',
        c.primary_type || '',
        c.secondary_type || '',
        c.priority || '',
        String(c.position ?? 0),
        c.created_at || '',
      ].map(escapeCSV).join(','))
    }
  }

  // BOM UTF-8 (\uFEFF) para visualización correcta en Excel
  return '\uFEFF' + lines.join('\r\n')
}

export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function parseProjectCSV(csvString) {
  const cleaned = csvString.charCodeAt(0) === 0xFEFF ? csvString.slice(1) : csvString
  const rows = parseCSV(cleaned)

  const meta = {}
  const milestonesMap = {}
  let headerIndexes = null

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue
    }

    const type = (row[0] || '').trim()

    if (type === 'PROJECT_META') {
      const key = (row[1] || '').trim()
      const val = row[2] !== undefined ? row[2] : ''
      if (key) meta[key] = val
      continue
    }

    if (type === 'RECORD_TYPE') {
      headerIndexes = {}
      for (let c = 0; c < row.length; c++) {
        headerIndexes[row[c].trim()] = c
      }
      continue
    }

    if (type === 'MILESTONE') {
      const mNum = headerIndexes && headerIndexes['milestone_number'] !== undefined
        ? parseInt(row[headerIndexes['milestone_number']], 10)
        : parseInt(row[1], 10)
      const mTitle = headerIndexes && headerIndexes['milestone_title'] !== undefined
        ? row[headerIndexes['milestone_title']]
        : row[2]

      if (!isNaN(mNum)) {
        if (!milestonesMap[mNum]) {
          milestonesMap[mNum] = { number: mNum, title: mTitle || `Hito ${mNum}`, cards: [] }
        } else if (mTitle) {
          milestonesMap[mNum].title = mTitle
        }
      }
      continue
    }

    if (type === 'CARD') {
      const mNum = headerIndexes && headerIndexes['milestone_number'] !== undefined
        ? parseInt(row[headerIndexes['milestone_number']], 10)
        : parseInt(row[1], 10)

      if (isNaN(mNum)) continue

      if (!milestonesMap[mNum]) {
        const mTitle = headerIndexes && headerIndexes['milestone_title'] !== undefined
          ? row[headerIndexes['milestone_title']]
          : row[2]
        milestonesMap[mNum] = { number: mNum, title: mTitle || `Hito ${mNum}`, cards: [] }
      }

      const getCol = (colName, fallbackIdx) => {
        if (headerIndexes && headerIndexes[colName] !== undefined) {
          return row[headerIndexes[colName]] ?? ''
        }
        return row[fallbackIdx] ?? ''
      }

      const card = {
        card_number: parseInt(getCol('card_number', 3), 10) || null,
        display_id: getCol('display_id', 4).trim(),
        title: getCol('title', 5).trim(),
        description: getCol('description', 6),
        status: getCol('status', 7).trim() || 'todo',
        primary_type: getCol('primary_type', 8).trim() || null,
        secondary_type: getCol('secondary_type', 9).trim() || null,
        priority: getCol('priority', 10).trim() || null,
        position: parseInt(getCol('position', 11), 10) || 0,
        created_at: getCol('created_at', 12).trim() || null,
      }

      if (card.title) {
        milestonesMap[mNum].cards.push(card)
      }
    }
  }

  const milestonesList = Object.values(milestonesMap).sort((a, b) => a.number - b.number)

  return {
    meta,
    milestones: milestonesList,
  }
}
