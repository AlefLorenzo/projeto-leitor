import { AppNotification, AppSettings } from '../types';
import { getDB, generateId } from './database';

const DEFAULT_SETTINGS: AppSettings = {
  readerMode: 'rtl',
  zoomLevel: 1,
  brightness: 100,
  showPageNumber: true,
  keepScreenOn: false,
  immersiveMode: false,
  autoSaveProgress: true,
  downloadWifiOnly: true,
  maxConcurrentDownloads: 2,
  maxStorageMB: 5000,
  updateIntervalHours: 12,
  autoUpdate: true,
  notificationsEnabled: true,
  language: 'pt-BR',
  theme: 'dark',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('settings')) return DEFAULT_SETTINGS;
  
  try {
    const saved = await db.get('settings', 'app-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  
  const db = await getDB();
  if (db.objectStoreNames.contains('settings')) {
    await db.put('settings', { id: 'app-settings', ...updated });
  }
  
  return updated;
}

// Notifications
export async function getNotifications(): Promise<AppNotification[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('notifications')) return [];
  
  try {
    const all = await db.getAll('notifications');
    return all.sort((a: AppNotification, b: AppNotification) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function addNotification(
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<AppNotification> {
  const notification: AppNotification = {
    id: generateId(),
    title,
    message,
    type,
    createdAt: Date.now(),
    read: false,
  };
  
  const db = await getDB();
  if (db.objectStoreNames.contains('notifications')) {
    await db.add('notifications', notification);
  }
  
  // Try browser notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '/icon.png' });
  }
  
  return notification;
}

export async function markNotificationRead(id: string) {
  const db = await getDB();
  if (!db.objectStoreNames.contains('notifications')) return;
  
  const notification = await db.get('notifications', id);
  if (notification) {
    notification.read = true;
    await db.put('notifications', notification);
  }
}

export async function markAllNotificationsRead() {
  const db = await getDB();
  if (!db.objectStoreNames.contains('notifications')) return;
  
  const all = await db.getAll('notifications');
  const tx = db.transaction('notifications', 'readwrite');
  for (const notification of all) {
    notification.read = true;
    await tx.store.put(notification);
  }
  await tx.done;
}

export async function clearNotifications() {
  const db = await getDB();
  if (!db.objectStoreNames.contains('notifications')) return;
  await db.clear('notifications');
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function getUnreadCount(notifications: AppNotification[]): number {
  return notifications.filter(n => !n.read).length;
}
