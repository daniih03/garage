import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProjectCard({ project, onClick }) {
  const [stats, setStats] = useState({ milestones: 0, cards: 0 })

  useEffect(() => {
    async function fetchStats() {
      const [{ count: m }, { count: c }] = await Promise.all([
        supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id),
        supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id),
      ])
      setStats({ milestones: m ?? 0, cards: c ?? 0 })
    }
    fetchStats()
  }, [project.id])

  return (
    <button
      className="project-card"
      onClick={onClick}
      aria-label={`Abrir proyecto ${project.repo_name}`}
    >
      {/* Top: acronym + GitHub link */}
      <div className="project-card__top">
        <span className="project-card__acronym">{project.repo_acronym}</span>
        <a
          className="project-card__github-link"
          href={project.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          aria-label={`Ver ${project.repo_full_name} en GitHub`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
      </div>

      {/* Body */}
      <div className="project-card__body">
        <h3 className="project-card__name">{project.repo_name}</h3>
        <p className="project-card__full-name">{project.repo_full_name}</p>
        {project.description && (
          <p className="project-card__desc">{project.description}</p>
        )}
      </div>

      {/* Footer stats */}
      <div className="project-card__footer">
        <span className="project-card__stat">
          {/* Milestone icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {stats.milestones} hito{stats.milestones !== 1 ? 's' : ''}
        </span>
        <span className="project-card__stat">
          {/* Cards icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          {stats.cards} tarjeta{stats.cards !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  )
}
