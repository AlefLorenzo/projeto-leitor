import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8000;
const APK_PATH = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/manga-offline.apk' || url === '/app-debug.apk' || url === '/download') {
    if (!fs.existsSync(APK_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('APK não encontrado.');
    }

    const stat = fs.statSync(APK_PATH);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="manga-offline.apk"'
    });

    const stream = fs.createReadStream(APK_PATH);
    return stream.pipe(res);
  }

  // HTML Landing Page
  const fileSizeMb = fs.existsSync(APK_PATH) ? (fs.statSync(APK_PATH).size / (1024 * 1024)).toFixed(2) : '0';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Manga Offline - APK</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f111a;
      color: #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #181c2a;
      border: 1px solid #2d3348;
      border-radius: 1.5rem;
      max-width: 440px;
      width: 100%;
      padding: 2rem;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
      display: inline-block;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #f3f4f6;
      margin-bottom: 0.5rem;
    }
    .badge {
      display: inline-block;
      background: rgba(147, 51, 234, 0.2);
      color: #c084fc;
      border: 1px solid #9333ea;
      font-size: 0.8rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 1.5rem;
    }
    .info {
      color: #9ca3af;
      font-size: 0.95rem;
      margin-bottom: 1.75rem;
      line-height: 1.5;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
      font-size: 1.1rem;
      font-weight: 600;
      padding: 1rem;
      border-radius: 0.85rem;
      text-decoration: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn:hover, .btn:active {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
    }
    .meta {
      margin-top: 1.25rem;
      font-size: 0.85rem;
      color: #6b7280;
    }
    .steps {
      margin-top: 2rem;
      text-align: left;
      background: #111420;
      padding: 1rem 1.25rem;
      border-radius: 0.75rem;
      border: 1px solid #232738;
      font-size: 0.85rem;
      color: #9ca3af;
    }
    .steps h3 {
      font-size: 0.9rem;
      color: #e5e7eb;
      margin-bottom: 0.5rem;
    }
    .steps ol {
      padding-left: 1.2rem;
      line-height: 1.6;
    }
    .web-link {
      margin-top: 1.5rem;
      font-size: 0.9rem;
      color: #818cf8;
      text-decoration: none;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📖</div>
    <h1>Manga Offline</h1>
    <span class="badge">Versão Android APK</span>
    <p class="info">Aplicativo leitor de mangás e manhwas com suporte offline, histórico, estatísticas e muito mais.</p>
    
    <a href="/manga-offline.apk" class="btn" download>
      ⬇️ Baixar APK Direto (${fileSizeMb} MB)
    </a>

    <div class="meta">
      Tamanho: ~${fileSizeMb} MB • Arquivo: manga-offline.apk
    </div>

    <div class="steps">
      <h3>📲 Como instalar no celular:</h3>
      <ol>
        <li>Toque no botão acima para baixar o APK.</li>
        <li>Ao abrir o arquivo, se solicitado, autorize a instalação de "Fontes Desconhecidas".</li>
        <li>Toque em <b>Instalar</b> e abra o aplicativo!</li>
      </ol>
    </div>

    <a href="http://${req.headers.host ? req.headers.host.split(':')[0] : 'localhost'}:5173" class="web-link">
      🌐 Acessar Versão Web no Navegador &rarr;
    </a>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de download do APK rodando em http://0.0.0.0:${PORT}`);
});
