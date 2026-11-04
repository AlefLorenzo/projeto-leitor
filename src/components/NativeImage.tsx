import { useState, useEffect, useRef } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import { isCapacitorNative, APP_USER_AGENT } from '../services/platform';

interface NativeImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Componente de imagem que garante o carregamento em APK Android.
 *
 * No APK (WebView em https://localhost):
 *   - Servidores de imagens do MangaDex (uploads.mangadex.org) bloqueiam
 *     requisições com User-Agent 'Mozilla/5.0' com HTTP 403 Forbidden!
 *   - Este componente usa CapacitorHttp.get() para buscar a imagem via camada
 *     Java nativa com o User-Agent oficial MangaOfflineApp/1.0.0 (retorna HTTP 200)
 *     e exibe como data URL base64.
 *
 * No browser dev (localhost:5173):
 *   - Usa a tag <img> padrão normalmente (sem overhead).
 */
export function NativeImage({
  src,
  fallbackSrc,
  alt,
  className,
  style,
  onLoad,
  onError,
}: NativeImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setDisplaySrc(undefined);

    if (!src) {
      setLoading(false);
      return;
    }

    // No browser dev ou para data URLs / blob URLs / caminhos locais, usar URL direta
    if (!isCapacitorNative() || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
      setDisplaySrc(src);
      setLoading(false);
      return;
    }

    // No APK nativo — buscar via CapacitorHttp com User-Agent autorizado
    let cancelled = false;

    async function fetchNative(url: string): Promise<string | null> {
      try {
        const response = await CapacitorHttp.get({
          url,
          responseType: 'blob',
          headers: {
            'User-Agent': APP_USER_AGENT,
            'Referer': 'https://mangadex.org/',
            'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
          },
        });

        if (response.status !== 200 || !response.data) return null;

        const rawData = typeof response.data === 'string' ? response.data : '';
        if (!rawData) return null;

        return rawData.startsWith('data:')
          ? rawData
          : `data:image/jpeg;base64,${rawData.replace(/[\r\n\s]/g, '')}`;
      } catch {
        return null;
      }
    }

    async function loadNative() {
      // Primeira tentativa com URL original
      const dataUrl = await fetchNative(src!);
      if (cancelled || !isMounted.current) return;

      if (dataUrl) {
        setDisplaySrc(dataUrl);
        setLoading(false);
        return;
      }

      // Segunda tentativa com fallback
      if (fallbackSrc && fallbackSrc !== src) {
        const fbUrl = await fetchNative(fallbackSrc);
        if (cancelled || !isMounted.current) return;
        if (fbUrl) {
          setDisplaySrc(fbUrl);
          setLoading(false);
          return;
        }
      }

      // Último recurso: URL direta
      if (!cancelled && isMounted.current) {
        setDisplaySrc(fallbackSrc || src);
        setLoading(false);
      }
    }

    loadNative();
    return () => { cancelled = true; };
  }, [src, fallbackSrc]);

  if (loading && !displaySrc) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>📖</span>
      </div>
    );
  }

  if (!displaySrc) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>📕</span>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={() => {
        if (fallbackSrc && displaySrc !== fallbackSrc) {
          setDisplaySrc(fallbackSrc);
        } else {
          onError?.();
        }
      }}
    />
  );
}
