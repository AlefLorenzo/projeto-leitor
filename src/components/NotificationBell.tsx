import { useState, useEffect } from 'react';
import { AppNotification } from '../types';
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearNotifications, getUnreadCount } from '../services/settings';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const notifs = await getNotifications();
    setNotifications(notifs);
    setUnreadCount(getUnreadCount(notifs));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await loadNotifications();
  };

  const handleClearAll = async () => {
    await clearNotifications();
    await loadNotifications();
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    await loadNotifications();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-success bg-success/10';
      case 'error': return 'text-error bg-error/10';
      case 'warning': return 'text-warning bg-warning/10';
      default: return 'text-info bg-info/10';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-graphite-800/50 transition-colors"
        aria-label="Notificações"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-violet-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-80 glass-card rounded-xl shadow-2xl z-50 fade-in overflow-hidden">
            <div className="p-3 border-b border-graphite-700/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-graphite-100">Notificações</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-violet-light hover:text-violet-accent"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-graphite-500 hover:text-error"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="text-3xl mb-2 block">🔕</span>
                  <p className="text-sm text-graphite-400">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-graphite-700/20">
                  {notifications.map(notif => (
                    <button
                      key={notif.id}
                      onClick={() => handleMarkRead(notif.id)}
                      className={`w-full text-left p-3 hover:bg-graphite-800/30 transition-colors ${
                        !notif.read ? 'bg-violet-accent/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${getTypeColor(notif.type)}`}>
                          {getTypeIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-graphite-200 mb-0.5">{notif.title}</p>
                          <p className="text-xs text-graphite-400 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-graphite-500 mt-1">
                            {new Date(notif.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-violet-accent flex-shrink-0 mt-1"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
