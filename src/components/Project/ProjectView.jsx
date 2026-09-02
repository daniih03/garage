import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import MilestoneBar from './MilestoneBar'
import Board from '../Board/Board'

export default function ProjectView({ project, activeMilestone, onMilestoneChange }) {
  const [milestones, setMilestones] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetchMilestones()

    const channel = supabase
      .channel(`milestones-${project.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `project_id=eq.${project.id}` },
        handleChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [project.id])

  async function fetchMilestones() {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('number', { ascending: true })

    if (!error) {
      setMilestones(data ?? [])
      // Auto-select the first milestone if none is active
      if (data?.length > 0 && !activeMilestone) {
        onMilestoneChange(data[0])
      }
    }
    setLoading(false)
  }

  function handleChange({ eventType, new: next, old: prev }) {
    setMilestones(current => {
      switch (eventType) {
        case 'INSERT': {
          const updated = [...current, next].sort((a, b) => a.number - b.number)
          // Auto-select newly created milestone if nothing active
          if (!activeMilestone) onMilestoneChange(next)
          return updated
        }
        case 'UPDATE': return current.map(m => m.id === next.id ? next : m)
        case 'DELETE': {
          const remaining = current.filter(m => m.id !== prev.id)
          // If deleted milestone was active, switch to first available
          if (activeMilestone?.id === prev.id) {
            onMilestoneChange(remaining[0] ?? null)
          }
          return remaining
        }
        default: return current
      }
    })
  }

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="project-view animate-fade-up">
      <MilestoneBar
        project={project}
        milestones={milestones}
        activeMilestone={activeMilestone}
        onSelectMilestone={onMilestoneChange}
      />

      {milestones.length === 0 ? (
        <div className="project-empty animate-fade-up">
          <div className="project-empty__icon">🏁</div>
          <h2 className="project-empty__title">Sin hitos todavía</h2>
          <p className="project-empty__desc">
            Crea el primer hito para empezar a añadir tarjetas al tablero.
          </p>
        </div>
      ) : activeMilestone ? (
        <Board project={project} milestone={activeMilestone} />
      ) : null}
    </div>
  )
}
