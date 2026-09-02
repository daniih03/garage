import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function ProgressRing({ percent, size = 68, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  const strokeColor = percent === 100 ? '#10B981' : percent > 0 ? '#38BDF8' : '#3F3F46'

  return (
    <div className="progress-ring-container">
      <svg viewBox={`0 0 ${size} ${size}`} className="progress-ring-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            transformOrigin: '50% 50%',
            transform: 'rotate(-90deg)',
          }}
        />
      </svg>
      <div className="progress-ring-text">
        <span className="progress-ring-percent">{percent}%</span>
      </div>
    </div>
  )
}

export default function ProjectCard({ project, onClick, onEdit, onDelete }) {
  const [stats, setStats] = useState({
    milestonesTotal: 0,
    milestonesDone: 0,
    cardsTotal: 0,
    cardsDone: 0,
    percent: 0,
    loading: true,
  })

  useEffect(() => {
    async function fetchStats() {
      const [{ data: mData }, { data: cData }] = await Promise.all([
        supabase
          .from('milestones')
          .select('id, number, title')
          .eq('project_id', project.id),
        supabase
          .from('cards')
          .select('id, milestone_id, status')
          .eq('project_id', project.id),
      ])

      const milestones = mData ?? []
      const cards = cData ?? []

      // 1. Cards statistics
      const totalCards = cards.length
      const doneCards = cards.filter(c => c.status === 'done').length
      const percent = totalCards === 0 ? 0 : Math.round((doneCards / totalCards) * 100)

      // 2. Completed milestones statistics
      // A milestone is complete iff it has > 0 cards and all of them have status === 'done'
      let completedMilestones = 0
      for (const m of milestones) {
        const mCards = cards.filter(c => c.milestone_id === m.id)
        if (mCards.length > 0 && mCards.every(c => c.status === 'done')) {
          completedMilestones++
        }
      }

      setStats({
        milestonesTotal: milestones.length,
        milestonesDone: completedMilestones,
        cardsTotal: totalCards,
        cardsDone: doneCards,
        percent,
        loading: false,
      })
    }

    fetchStats()
  }, [project.id])

  return (
    <div
      className="project-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
            onClick?.()
          }
        }
      }}
      aria-label={`Abrir proyecto ${project.repo_name}`}
    >
      {/* ── LEFT: Project Information ── */}
      <div className="project-card__left">
        <div className="project-card__header">
          <span className="project-card__acronym">{project.repo_acronym}</span>

          <div className="project-card__actions" onClick={e => e.stopPropagation()}>
            <a
              className="project-card__action-btn"
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver ${project.repo_full_name} en GitHub`}
              title="Ver en GitHub"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>

            {onEdit && (
              <button
                type="button"
                className="project-card__action-btn"
                onClick={e => {
                  e.stopPropagation()
                  onEdit(project)
                }}
                aria-label={`Editar proyecto ${project.repo_name}`}
                title="Editar proyecto"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="project-card__action-btn project-card__action-btn--delete"
                onClick={e => {
                  e.stopPropagation()
                  onDelete(project)
                }}
                aria-label={`Eliminar proyecto ${project.repo_name}`}
                title="Eliminar proyecto"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="project-card__body">
          <h3 className="project-card__name">{project.repo_name}</h3>
          <p className="project-card__full-name">{project.repo_full_name}</p>
          {project.description ? (
            <p className="project-card__desc">{project.description}</p>
          ) : (
            <p className="project-card__desc project-card__desc--muted">Sin descripción</p>
          )}
        </div>
      </div>

      {/* ── RIGHT: Summary & Progress Metrics ── */}
      <div className="project-card__right">
        {/* Progress Ring */}
        <div className="project-card__ring-wrapper">
          <ProgressRing percent={stats.percent} />
          <span className="project-card__ring-label">Progreso</span>
        </div>

        {/* Detailed Metrics */}
        <div className="project-card__metrics">
          {/* Milestone metric */}
          <div className="project-card__metric-item">
            <div className="project-card__metric-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="rgba(245, 158, 11, 0.25)" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              Hitos completados
            </div>
            <div className="project-card__metric-value">
              <strong>{stats.milestonesDone}</strong>
              <span className="project-card__metric-total">/ {stats.milestonesTotal}</span>
            </div>
            <div className="project-card__metric-track">
              <div
                className="project-card__metric-fill project-card__metric-fill--milestones"
                style={{
                  width: `${stats.milestonesTotal === 0 ? 0 : Math.round((stats.milestonesDone / stats.milestonesTotal) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* Cards metric */}
          <div className="project-card__metric-item">
            <div className="project-card__metric-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Tarjetas completadas
            </div>
            <div className="project-card__metric-value">
              <strong>{stats.cardsDone}</strong>
              <span className="project-card__metric-total">/ {stats.cardsTotal}</span>
            </div>
            <div className="project-card__metric-track">
              <div
                className="project-card__metric-fill project-card__metric-fill--cards"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
