import { supabase } from './supabase'

/**
 * Crea una notificación para un usuario específico.
 */
export async function createUserNotification({
  userId,
  projectId = null,
  projectName,
  type, // 'project_invite' | 'role_change' | 'project_kick'
  title,
  message,
  metadata = {},
}) {
  if (!userId) return { error: 'userId is required' }

  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .insert({
        user_id: userId,
        project_id: projectId,
        project_name: projectName || 'Proyecto',
        type,
        title,
        message,
        metadata,
        read: false,
      })
      .select()
      .single()

    if (error) {
      console.warn('Error creating user notification:', error)
    }
    return { data, error }
  } catch (err) {
    console.warn('Notification insert exception:', err)
    return { error: err }
  }
}

/**
 * Marca todas las notificaciones de un usuario como leídas.
 */
export async function markAllNotificationsRead(userId) {
  if (!userId) return
  return await supabase
    .from('user_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}

/**
 * Marca una notificación específica como leída.
 */
export async function markNotificationRead(notificationId) {
  if (!notificationId) return
  return await supabase
    .from('user_notifications')
    .update({ read: true })
    .eq('id', notificationId)
}
