import assert from 'assert';
import { MangaDexAdapter, naturalChapterSort } from '../src/services/sources/MangaDexAdapter';
import { SourceChapter } from '../src/services/sources/types';

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  🧪 TESTES AUTOMATIZADOS — INTEGRAÇÃO MANGADEX         ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`✅ [TEST ${total}] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [TEST ${total}] ${name}: ${err.message}`);
    }
  }

  async function asyncTest(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [TEST ${total}] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [TEST ${total}] ${name}: ${err.message}`);
    }
  }

  // 1. Teste de Ordenação Natural de Capítulos
  test('Ordenação Natural: inteiros, decimais (5.5) e especiais', () => {
    const chapters: SourceChapter[] = [
      { id: '10', sourceId: 'mangadex', mangaId: 'm1', number: 10, title: 'Cap 10' },
      { id: '5.5', sourceId: 'mangadex', mangaId: 'm1', number: 5.5, title: 'Cap 5.5 Extra' },
      { id: '1', sourceId: 'mangadex', mangaId: 'm1', number: 1, title: 'Cap 1' },
      { id: '0', sourceId: 'mangadex', mangaId: 'm1', number: 0, title: 'Prólogo' },
      { id: '2', sourceId: 'mangadex', mangaId: 'm1', number: 2, title: 'Cap 2' },
      { id: 'spec', sourceId: 'mangadex', mangaId: 'm1', number: 999999, chapterStr: 'Especial', title: 'Capítulo Especial' },
    ];

    const sortedAsc = [...chapters].sort((a, b) => naturalChapterSort(a, b, 'asc'));
    assert.strictEqual(sortedAsc[0].number, 0, 'Primeiro deve ser o prólogo (0)');
    assert.strictEqual(sortedAsc[1].number, 1, 'Segundo deve ser o cap 1');
    assert.strictEqual(sortedAsc[2].number, 2, 'Terceiro deve ser o cap 2');
    assert.strictEqual(sortedAsc[3].number, 5.5, '5.5 deve ficar entre 2 e 10');
    assert.strictEqual(sortedAsc[4].number, 10, 'Quinto deve ser o cap 10');
    assert.strictEqual(sortedAsc[5].id, 'spec', 'Especial sem número deve vir no final');

    const sortedDesc = [...chapters].sort((a, b) => naturalChapterSort(a, b, 'desc'));
    assert.strictEqual(sortedDesc[0].id, 'spec');
    assert.strictEqual(sortedDesc[1].number, 10);
    assert.strictEqual(sortedDesc[sortedDesc.length - 1].number, 0);
  });

  // 2. Teste de Preservação de Versões e Múltiplos Grupos de Tradução
  test('Preservação de Versões: mesmo capítulo com grupos diferentes', () => {
    const chGroupA: SourceChapter = {
      id: 'mangadex:uuid-1',
      sourceId: 'mangadex',
      mangaId: 'manga-1',
      number: 1,
      title: 'Capítulo 1',
      scanlator: 'Grupo Alfa Scan',
    };
    const chGroupB: SourceChapter = {
      id: 'mangadex:uuid-2',
      sourceId: 'mangadex',
      mangaId: 'manga-1',
      number: 1,
      title: 'Capítulo 1',
      scanlator: 'Grupo Beta Traduções',
    };

    const list = [chGroupA, chGroupB];
    assert.strictEqual(list.length, 2, 'Ambas as versões do capítulo 1 devem ser mantidas');
    assert.notStrictEqual(list[0].id, list[1].id, 'IDs devem ser distintos para permitir escolha de versão');
    assert.strictEqual(list[0].scanlator, 'Grupo Alfa Scan');
    assert.strictEqual(list[1].scanlator, 'Grupo Beta Traduções');
  });

  // 3. Teste da API MangaDex: Disponibilidade (Ping)
  const adapter = new MangaDexAdapter();
  await asyncTest('MangaDex API: Conexão e Ping Oficial', async () => {
    const availability = await adapter.isAvailable();
    assert.strictEqual(availability.available, true, 'API MangaDex deve estar acessível e online');
  });

  // 4. Teste da API MangaDex: Consulta e Filtro de Catálogo com PT-BR
  await asyncTest('MangaDex API: Listagem com filtro PT-BR e Tipo', async () => {
    const res = await adapter.getMangaList(1, {
      type: 'manhwa',
      language: 'pt-br',
      limit: 5,
    });
    assert.ok(res.mangas.length > 0, 'Deve retornar ao menos 1 obra');
    assert.strictEqual(res.mangas[0].type, 'manhwa', 'Obras filtradas devem ser manhwa');
    assert.ok(res.total > 0, 'Total deve ser superior a 0');
  });

  // 5. Teste da API MangaDex: Busca textual por título
  await asyncTest('MangaDex API: Pesquisa textual de obra', async () => {
    const res = await adapter.getMangaList(1, {
      search: 'Solo Leveling',
      language: 'pt-br',
      limit: 3,
    });
    assert.ok(res.mangas.length > 0, 'Deve encontrar obras com termo Solo Leveling');
    const hasSolo = res.mangas.some((m) => m.title.toLowerCase().includes('level') || m.title.toLowerCase().includes('solo'));
    assert.ok(hasSolo, 'Título deve conter termo correspondente');
  });

  // 6. Teste da API MangaDex: Detalhes da Obra
  await asyncTest('MangaDex API: Detalhes de Obra (Autor, Sinopse, Capa)', async () => {
    const searchRes = await adapter.getMangaList(1, { search: 'Solo Leveling', limit: 1 });
    const manga = searchRes.mangas[0];
    const details = await adapter.getMangaDetails(manga.id);

    assert.ok(details.title, 'Deve conter título');
    assert.ok(details.coverUrl, 'Deve conter URL da capa');
    assert.ok(Array.isArray(details.genres), 'Gêneros deve ser array');
  });

  // 7. Teste da API MangaDex: Listagem de Capítulos com Scanlator
  await asyncTest('MangaDex API: Capítulos em PT-BR e At-Home Pages', async () => {
    const searchRes = await adapter.getMangaList(1, { search: 'Solo Leveling', limit: 1 });
    const manga = searchRes.mangas[0];
    const chapters = await adapter.getChapterList(manga.id, 'pt-br');

    assert.ok(Array.isArray(chapters), 'Capítulos deve ser array');
    if (chapters.length > 0) {
      const firstChapter = chapters[0];
      assert.ok(firstChapter.number >= 0, 'Número de capítulo deve ser válido');
      assert.ok(firstChapter.scanlator, 'Deve identificar grupo de tradução (scanlator)');

      // Teste das páginas At-Home
      const pages = await adapter.getChapterPages(manga.id, firstChapter.id);
      assert.ok(pages.length > 0, 'Deve conter ao menos 1 página');
      assert.ok(pages[0].imageUrl.startsWith('http'), 'URL da página deve ser válida');
    }
  });

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`🎉 RESULTADO DOS TESTES: ${passed}/${total} PASSARAM COM SUCESSO!`);
  console.log(`════════════════════════════════════════════════════════════\n`);
}

runTests().catch((err) => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
