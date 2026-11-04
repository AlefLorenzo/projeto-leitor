@echo off
title Manga Offline - Status da Extracao
chcp 65001 >nul
cls

echo ========================================================
echo         STATUS DA EXTRACAO DOS CAPITULOS
echo ========================================================
echo.

node -e "const fs = require('fs'); const path = require('path'); const lib = path.join(__dirname, 'library'); if (fs.existsSync(lib)) { const items = fs.readdirSync(lib, { withFileTypes: true }).filter(d => d.isDirectory()); for (const item of items) { const p = path.join(lib, item.name); const sub = fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).length; console.log('  📖 ' + item.name.padEnd(45) + ' : ' + String(sub).padStart(3) + ' capitulos prontos'); } } const progFile = path.join(__dirname, 'telegram-bot', 'download-progress.json'); if (fs.existsSync(progFile)) { try { const p = JSON.parse(fs.readFileSync(progFile, 'utf-8')); console.log('\n--- Progresso Atual do Download ---'); console.log('Obra: ' + (p.currentManga || '-') + ' | Capitulo: ' + (p.chapter || '-') + ' (' + (p.progress || '-') + ') | Baixado: ' + (p.chapterProgress || 0) + '% (' + (p.downloadedMb || 0) + '/' + (p.totalMb || 0) + ' MB)'); } catch(e){} }"

echo.
echo ========================================================
pause
