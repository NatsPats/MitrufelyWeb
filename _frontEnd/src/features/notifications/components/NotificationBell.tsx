import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Package } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useNotificationsQuery, useUnreadNotificationsCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: notifications } = useNotificationsQuery()
  const { data: unreadData } = useUnreadNotificationsCount()
  const markAsRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = unreadData?.unread_count || 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNotificationClick = (notif: any) => {
    if (!notif.is_read) {
      markAsRead.mutate(notif.id_notification)
    }
    setIsOpen(false)
    if (notif.related_entity_id && notif.related_entity_type === 'ORDER') {
      navigate(`/mi-cuenta/pedidos/${notif.related_entity_id}`)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-white shadow-sm border border-[#5c0f1b]/10 text-[#5c0f1b] hover:bg-[#5c0f1b]/5 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5 group-hover:text-[#ff7a45] transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff7a45] text-[10px] font-black text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#5c0f1b]/10 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="font-black text-[#2a1115] text-sm">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-bold text-[#5c0f1b] hover:text-[#ff7a45] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Marcar leídas
                </button>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {(!notifications || notifications.length === 0) ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-sm font-medium text-stone-400">No tienes notificaciones nuevas</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {notifications.map((notif: any) => (
                    <div
                      key={notif.id_notification}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-4 hover:bg-stone-50 transition-colors cursor-pointer flex gap-3 ${!notif.is_read ? 'bg-[#ff7a45]/5' : ''}`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? 'bg-white shadow-sm border border-[#ff7a45]/20' : 'bg-stone-100'}`}>
                        <Package className={`h-5 w-5 ${!notif.is_read ? 'text-[#ff7a45]' : 'text-stone-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm mb-0.5 line-clamp-2 ${!notif.is_read ? 'font-black text-[#2a1115]' : 'font-semibold text-[#2a1115]/70'}`}>
                          {notif.message}
                        </p>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          {new Date(notif.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 rounded-full bg-[#ff7a45] shrink-0 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
