import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { markAllNotificationsRead, markNotificationRead } from '../../lib/notifications'

export default function NotificationBell({ user, onOpenProject, onRefreshHome }) {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const dropdownRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!user) return

    fetchNotifications()

    // Realtime channel para notificaciones del usuario
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    // Cerrar al hacer clic fuera
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [user])

  async function fetchNotifications() {
    if (!user) return
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    setNotifications(data || [])
  }

  async function handleToggleOpen() {
    setIsOpen(prev => !prev)
  }

  async function handleMarkAllRead() {
    if (!user || unreadCount === 0) return
    await markAllNotificationsRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleDeleteNotification(e, notifId) {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    await supabase.from('user_notifications').delete().eq('id', notifId)
  }

  async function handleAcceptInvite(notification) {
    if (!notification.project_id || !user) return
    setActionLoading(notification.id)
    try {
      // 1. Activar membresía en base de datos
      await supabase
        .from('project_members')
        .update({ status: 'active' })
        .eq('project_id', notification.project_id)
        .eq('user_id', user.id)

      // 2. Marcar notificación como leída
      await markNotificationRead(notification.id)
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n))
      
      // 3. Notificar a HomePage para mostrar el proyecto inmediatamente
      onRefreshHome?.()
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeclineInvite(notification) {
    if (!notification.project_id || !user) return
    setActionLoading(notification.id)
    try {
      // 1. Eliminar membresía pendiente de la base de datos
      await supabase
        .from('project_members')
        .delete()
        .eq('project_id', notification.project_id)
        .eq('user_id', user.id)

      // 2. Eliminar la notificación
      await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notification.id)

      setNotifications(prev => prev.filter(n => n.id !== notification.id))
      onRefreshHome?.()
    } finally {
      setActionLoading(null)
    }
  }

  function formatTime(iso) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
      if (diffMin < 1) return 'ahora'
      if (diffMin < 60) return `hace ${diffMin}m`
      const diffHours = Math.round(diffMin / 60)
      if (diffHours < 24) return `hace ${diffHours}h`
      const diffDays = Math.round(diffHours / 24)
      return `hace ${diffDays}d`
    } catch {
      return ''
    }
  }

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell-btn${unreadCount > 0 ? ' notif-bell-btn--unread' : ''}`}
        onClick={handleToggleOpen}
        aria-label={`Notificaciones (${unreadCount} sin leer)`}
        title="Notificaciones"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown animate-fade-down" role="dialog" aria-label="Bandeja de notificaciones">
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-dropdown__mark-btn"
                onClick={handleMarkAllRead}
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="notif-dropdown__list">
            {notifications.length === 0 ? (
              <div className="notif-dropdown__empty">
                <span style={{ fontSize: 22 }}>🔔</span>
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map(n => {
                const isInvite = n.type === 'project_invite'
                const isKick = n.type === 'project_kick'
                const isRole = n.type === 'role_change'

                return (
                  <div
                    key={n.id}
                    className={`notif-item${!n.read ? ' notif-item--unread' : ''}`}
                    onClick={() => !n.read && markNotificationRead(n.id)}
                  >
                    <div className="notif-item__icon-wrap">
                      {isInvite && <span className="notif-item__icon notif-item__icon--invite">✉️</span>}
                      {isKick && <span className="notif-item__icon notif-item__icon--kick">⚠️</span>}
                      {isRole && <span className="notif-item__icon notif-item__icon--role">⭐</span>}
                    </div>

                    <div className="notif-item__content">
                      <div className="notif-item__top">
                        <span className="notif-item__title">{n.title}</span>
                        <div className="notif-item__top-right">
                          <span className="notif-item__time">{formatTime(n.created_at)}</span>
                          <button
                            type="button"
                            className="notif-item__delete-btn"
                            onClick={e => handleDeleteNotification(e, n.id)}
                            aria-label="Eliminar notificación"
                            title="Eliminar notificación"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="notif-item__msg">{n.message}</p>

                      {isInvite && !n.read && (
                        <div className="notif-item__actions">
                          <button
                            type="button"
                            className="btn btn--primary btn--sm notif-btn-action"
                            disabled={actionLoading === n.id}
                            onClick={e => {
                              e.stopPropagation()
                              handleAcceptInvite(n)
                            }}
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm notif-btn-action notif-btn-decline"
                            disabled={actionLoading === n.id}
                            onClick={e => {
                              e.stopPropagation()
                              handleDeclineInvite(n)
                            }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
