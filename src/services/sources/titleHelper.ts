/**
 * titleHelper.ts
 *
 * Função centralizada de resolução de títulos para obras do MangaDex.
 *
 * Prioridade de idiomas:
 *  1. Português Brasileiro (pt-br)
 *  2. Português (pt)
 *  3. Título original conforme o idioma da obra (ja-ro, ko-ro, zh-ro para romanizado)
 *  4. Inglês (en)
 *  5. Outros idiomas disponíveis
 *  6. Fallback seguro: 'Título não disponível'
 *
 * Nunca retorna undefined, null, [object Object] ou string vazia.
 */

export interface ResolvedTitle {
  /** Título principal selecionado conforme a prioridade de idiomas. */
  title: string;
  /** Títulos alternativos válidos sem repetição do título principal. */
  altTitles: string[];
  /** Idioma do título selecionado (ex: 'pt-br', 'en', 'ja-ro', 'none'). */
  matchedLanguage: string;
}

/**
 * Garante que um valor de título seja uma string válida.
 * Retorna null se o valor for vazio, undefined, null, [object Object] etc.
 */
function cleanString(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (
    !s ||
    s === 'undefined' ||
    s === 'null' ||
    s === '[object Object]' ||
    s === '{}' ||
    s === '[]'
  ) {
    return null;
  }
  return s;
}

/**
 * Resolve o título preferido e os títulos alternativos de uma obra do MangaDex.
 *
 * @param titleObj     - `attributes.title` retornado pela API: `Record<string, string>`
 * @param altTitlesList - `attributes.altTitles` retornado pela API: `Array<Record<string, string>>`
 * @param originalLanguage - `attributes.originalLanguage` (ex: 'ja', 'ko', 'zh')
 * @returns ResolvedTitle com título, altTitles e o idioma correspondido.
 */
export function resolveMangaTitles(
  titleObj: Record<string, string> | undefined | null,
  altTitlesList: Array<Record<string, string>> | undefined | null,
  originalLanguage?: string
): ResolvedTitle {
  // Mapa: idioma normalizado -> lista de títulos nesse idioma (ordem de aparição)
  const langMap = new Map<string, string[]>();
  // Lista plana de todos os títulos válidos na ordem em que aparecem
  const allCandidates: string[] = [];

  function addCandidate(lang: string, val: unknown): void {
    const cleaned = cleanString(val);
    if (!cleaned) return;
    const normLang = (lang || 'unknown').toLowerCase().trim();
    if (!langMap.has(normLang)) {
      langMap.set(normLang, []);
    }
    langMap.get(normLang)!.push(cleaned);
    allCandidates.push(cleaned);
  }

  // 1. Indexar attributes.title
  if (titleObj && typeof titleObj === 'object' && !Array.isArray(titleObj)) {
    for (const [k, v] of Object.entries(titleObj)) {
      addCandidate(k, v);
    }
  } else if (typeof titleObj === 'string') {
    addCandidate('default', titleObj);
  }

  // 2. Indexar attributes.altTitles
  if (Array.isArray(altTitlesList)) {
    for (const item of altTitlesList) {
      if (typeof item === 'string') {
        addCandidate('unknown', item);
      } else if (item && typeof item === 'object') {
        for (const [k, v] of Object.entries(item)) {
          addCandidate(k, v);
        }
      }
    }
  }

  /**
   * Busca o primeiro título válido em qualquer dos idiomas informados.
   */
  function getFirstFromLangs(...langs: string[]): { val: string; lang: string } | null {
    for (const l of langs) {
      const list = langMap.get(l.toLowerCase());
      if (list && list.length > 0) {
        return { val: list[0], lang: l };
      }
    }
    return null;
  }

  const origLang = (originalLanguage || '').toLowerCase().trim();

  let selectedTitle = '';
  let matchedLanguage = 'none';

  // Prioridade 1: pt-br
  const ptBrMatch = getFirstFromLangs('pt-br', 'pt_br');
  if (ptBrMatch) {
    selectedTitle = ptBrMatch.val;
    matchedLanguage = 'pt-br';
  }

  // Prioridade 2: pt
  if (!selectedTitle) {
    const ptMatch = getFirstFromLangs('pt', 'pt-pt');
    if (ptMatch) {
      selectedTitle = ptMatch.val;
      matchedLanguage = 'pt';
    }
  }

  // Prioridade 3: Título romanizado ou original conforme originalLanguage
  if (!selectedTitle && origLang) {
    // Preferir romanizado (ex: ja-ro, ko-ro, zh-ro) por ser mais legível
    const roMatch = getFirstFromLangs(`${origLang}-ro`, `${origLang}_ro`);
    if (roMatch) {
      selectedTitle = roMatch.val;
      matchedLanguage = roMatch.lang;
    } else {
      const origMatch = getFirstFromLangs(origLang);
      if (origMatch) {
        selectedTitle = origMatch.val;
        matchedLanguage = origLang;
      }
    }
  }

  // Prioridade 4: Inglês
  if (!selectedTitle) {
    const enMatch = getFirstFromLangs('en', 'en-us', 'en-gb');
    if (enMatch) {
      selectedTitle = enMatch.val;
      matchedLanguage = 'en';
    }
  }

  // Prioridade 5: Qualquer idioma disponível
  if (!selectedTitle) {
    for (const cand of allCandidates) {
      const c = cleanString(cand);
      if (c) {
        selectedTitle = c;
        matchedLanguage = 'other';
        break;
      }
    }
  }

  // Fallback seguro final
  if (!selectedTitle) {
    return { title: 'Título não disponível', altTitles: [], matchedLanguage: 'none' };
  }

  // Montar altTitles sem o título selecionado e sem duplicatas
  const seen = new Set<string>();
  seen.add(selectedTitle.toLowerCase());
  const altTitles: string[] = [];
  for (const cand of allCandidates) {
    const c = cleanString(cand);
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      altTitles.push(c);
    }
  }

  return { title: selectedTitle, altTitles, matchedLanguage };
}

/**
 * Verifica se uma obra corresponde a uma consulta de busca.
 * Verifica título principal, altTitles e autor, com normalização de acentos.
 *
 * @param title - Título principal da obra.
 * @param altTitles - Títulos alternativos da obra.
 * @param author - Autor da obra (opcional).
 * @param query - String de busca.
 */
export function matchesMangaQuery(
  title: string,
  altTitles: string[] | undefined,
  author: string | undefined,
  query: string
): boolean {
  if (!query) return true;

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const q = normalize(query);
  if (!q) return true;

  if (normalize(title).includes(q)) return true;
  if (author && normalize(author).includes(q)) return true;
  if (Array.isArray(altTitles)) {
    for (const alt of altTitles) {
      if (typeof alt === 'string' && normalize(alt).includes(q)) return true;
    }
  }
  return false;
}
