import { Network } from '@capacitor/network';
import { ConnectionStatus, ConnectionNetworkType, OnlineReadingNetworkPreference } from '../types';
import { isCapacitorNative } from './platform';

/**
 * Normaliza o tipo de conexão recebido do Capacitor ou de navigator.connection
 */
function normalizeConnectionType(rawType: string | undefined): ConnectionNetworkType {
  if (!rawType) return 'unknown';
  const t = rawType.toLowerCase().trim();
  if (t === 'wifi') return 'wifi';
  if (t === 'cellular' || t === '2g' || t === '3g' || t === '4g' || t === '5g') return 'cellular';
  if (t === 'ethernet') return 'ethernet';
  if (t === 'none') return 'none';
  return 'unknown';
}

/**
 * Obtém o status da conexão utilizando a estratégia tripla:
 * 1. Nível nativo Android (@capacitor/network)
 * 2. Nível browser/WebView (navigator.connection)
 * 3. Regra de segurança: se incerto, tipo = 'unknown' (NUNCA assume Wi-Fi silenciosamente)
 */
export async function getCurrentNetworkStatus(): Promise<ConnectionStatus> {
  // 1. Tentar nível nativo via Capacitor Network
  try {
    const status = await Network.getStatus();
    const normalized = normalizeConnectionType(status.connectionType);

    if (status.connected) {
      return {
        connected: true,
        connectionType: normalized,
        isWifi: normalized === 'wifi',
        isCellular: normalized === 'cellular',
        isEthernet: normalized === 'ethernet',
      };
    } else {
      return {
        connected: false,
        connectionType: 'none',
        isWifi: false,
        isCellular: false,
        isEthernet: false,
      };
    }
  } catch (err) {
    // Falha ao consultar plugin nativo, prossegue para fallback
  }

  // 2. Fallback: navigator.connection (Web/Desktop/WebView)
  if (typeof navigator !== 'undefined') {
    const isOnline = navigator.onLine !== false;
    if (!isOnline) {
      return {
        connected: false,
        connectionType: 'none',
        isWifi: false,
        isCellular: false,
        isEthernet: false,
      };
    }

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn && conn.type) {
      const normalized = normalizeConnectionType(conn.type);
      return {
        connected: true,
        connectionType: normalized,
        isWifi: normalized === 'wifi',
        isCellular: normalized === 'cellular',
        isEthernet: normalized === 'ethernet',
      };
    }

    // Se temos internet mas não há API para confirmar o tipo específico de rede,
    // marcamos como 'unknown' por segurança estrita.
    return {
      connected: true,
      connectionType: 'unknown',
      isWifi: false,
      isCellular: false,
      isEthernet: false,
    };
  }

  // 3. Fallback de segurança absoluta
  return {
    connected: false,
    connectionType: 'unknown',
    isWifi: false,
    isCellular: false,
    isEthernet: false,
  };
}

/**
 * Avalia se a leitura online pode prosseguir conforme a preferência do usuário:
 * - wifi_only: Permite SOMENTE com Wi-Fi ou Ethernet confirmado.
 * - ask_cellular: Solicita autorização se for dados móveis ou tipo desconhecido.
 * - disabled: Bloqueia leitura online.
 */
export async function canProceedWithOnlineReading(
  preference: OnlineReadingNetworkPreference,
  hasSessionCellularAuth: boolean = false
): Promise<{ allowed: boolean; needsCellularAuth?: boolean; reason?: string; status: ConnectionStatus }> {
  const status = await getCurrentNetworkStatus();

  if (!status.connected || status.connectionType === 'none') {
    return {
      allowed: false,
      reason: 'Sem conexão com a internet. Verifique sua conexão para ler online ou utilize seus capítulos baixados offline.',
      status,
    };
  }

  if (preference === 'disabled') {
    return {
      allowed: false,
      reason: 'A leitura online está desativada nas configurações. Altere para "Somente Wi-Fi" ou "Perguntar antes" nas Configurações.',
      status,
    };
  }

  // Wi-Fi ou Ethernet confirmado: sempre permitido
  if (status.isWifi || status.isEthernet) {
    return {
      allowed: true,
      status,
    };
  }

  // Dados móveis ou tipo desconhecido no modo wifi_only: estritamente bloqueado
  if (preference === 'wifi_only') {
    const isMobile = status.isCellular;
    return {
      allowed: false,
      reason: isMobile
        ? 'Conectado via dados móveis. A leitura online está configurada para "Somente Wi-Fi" para evitar consumo do seu plano de dados.'
        : 'Tipo de rede não pôde ser confirmado como Wi-Fi. Por segurança, a leitura online está pausada no modo "Somente Wi-Fi".',
      status,
    };
  }

  // Modo ask_cellular
  if (preference === 'ask_cellular') {
    if (hasSessionCellularAuth) {
      return {
        allowed: true,
        status,
      };
    }
    return {
      allowed: false,
      needsCellularAuth: true,
      reason: status.isCellular
        ? 'Você está conectado via dados móveis. Deseja autorizar o uso da rede móvel para ler este capítulo?'
        : 'Sua rede atual não foi confirmada como Wi-Fi. Deseja autorizar o carregamento pela internet?',
      status,
    };
  }

  return {
    allowed: false,
    reason: 'Conexão incompatível com a configuração atual.',
    status,
  };
}

/**
 * Inscreve um ouvinte para alterações de conectividade em tempo real
 */
export function subscribeNetworkStatus(callback: (status: ConnectionStatus) => void): () => void {
  let active = true;

  const update = async () => {
    if (!active) return;
    const status = await getCurrentNetworkStatus();
    callback(status);
  };

  // 1. Ouvinte nativo do Capacitor
  let capacitorHandle: any = null;
  try {
    Network.addListener('networkStatusChange', () => {
      update();
    }).then(h => {
      capacitorHandle = h;
    }).catch(() => {});
  } catch {}

  // 2. Ouvintes padrão do navegador
  const onOnline = () => update();
  const onOffline = () => update();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // 3. Ouvinte da Network Information API se disponível
  const conn = typeof navigator !== 'undefined'
    ? ((navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection)
    : null;

  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', update);
  }

  return () => {
    active = false;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (conn && typeof conn.removeEventListener === 'function') {
      conn.removeEventListener('change', update);
    }
    if (capacitorHandle && typeof capacitorHandle.remove === 'function') {
      capacitorHandle.remove();
    }
  };
}
