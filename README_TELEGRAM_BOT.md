# 🤖 Manga Offline + Telegram Bot - Solução Completa

## 🎯 O Que Você Tem Agora

Uma solução completa para gerenciar sua biblioteca de mangás:

```
📱 Telegram → 🤖 Bot → 📁 Organiza → 📊 Catálogo → 🌐 Git → 📲 App
```

### Fluxo Completo

1. **Você** envia um arquivo (CBZ/ZIP/imagem) para o bot no Telegram
2. **Bot** recebe, organiza e atualiza o catálogo
3. **Git** recebe o commit automaticamente
4. **App** lê o catálogo e exibe as obras
5. **Você** importa as obras do Telegram para a biblioteca local

---

## 📦 O Que Foi Criado

### 1. Bot do Telegram Completo
- ✅ `telegram-bot/bot.js` - Código do bot
- ✅ `telegram-bot/package.json` - Dependências
- ✅ `telegram-bot/.env.example` - Template de configuração
- ✅ `telegram-bot/install.sh` - Script de instalação
- ✅ `telegram-bot/README.md` - Documentação completa

### 2. Integração com o App
- ✅ `src/services/telegramCatalog.ts` - Serviço para ler catálogo
- ✅ `src/pages/TelegramPage.tsx` - Página do Telegram no app
- ✅ `public/catalog/catalog.json` - Catálogo vazio inicial
- ✅ Sidebar atualizada com botão "Telegram"

### 3. Documentação
- ✅ `TELEGRAM_QUICK_START.md` - Guia rápido (5 minutos)
- ✅ `telegram-bot/README.md` - Documentação completa do bot

---

## 🚀 Como Usar (Resumo)

### Passo 1: Criar o Bot (2 min)
1. Telegram → @BotFather → `/newbot`
2. Nome: "Manga Offline Bot"
3. Username: "manga_offline_bot"
4. Copie o token

### Passo 2: Configurar (1 min)
```bash
cd telegram-bot
chmod +x install.sh
./install.sh
nano .env  # Cole o token
```

### Passo 3: Iniciar (30 seg)
```bash
npm start
```

### Passo 4: Usar
1. Telegram → Seu bot → `/start`
2. Envie um arquivo CBZ/ZIP/imagem
3. Responda com o nome da obra
4. Pronto! ✅

---

## 📱 No App

### Página Telegram
- Veja todas as obras enviadas pelo bot
- Estatísticas (total de obras, capítulos, páginas)
- Busca por título ou gênero
- Clique para importar para a biblioteca local

### Fluxo de Importação
1. Envie obra pelo Telegram
2. Obra aparece na página "Telegram" do app
3. Clique na obra
4. Importe para a biblioteca local
5. Leia offline! 📚

---

## 🔄 Rodando 24/7

### Opção 1: Seu Computador (Testes)
```bash
nohup npm start &
```

### Opção 2: VPS (Recomendado)
```bash
# No VPS (DigitalOcean, Hetzner, etc)
git clone seu-repositorio
cd manga-offline/telegram-bot
npm install
npm install -g pm2
pm2 start bot.js --name manga-bot
pm2 save
pm2 startup
```

### Opção 3: Raspberry Pi (Casa)
Perfeito para rodar em casa com baixo consumo de energia.

---

## 📊 Estrutura de Arquivos

```
manga-offline/
├── telegram-bot/              # Bot do Telegram
│   ├── bot.js                 # Código principal
│   ├── package.json           # Dependências
│   ├── .env                   # Token (NÃO comitar!)
│   ├── .env.example           # Template
│   ├── install.sh             # Script de instalação
│   ├── README.md              # Documentação
│   └── downloads/             # Arquivos baixados
│       └── nome-da-obra/
│           ├── arquivo.cbz
│           └── metadata.json
│
├── public/
│   └── catalog/
│       └── catalog.json       # Catálogo atualizado pelo bot
│
├── src/
│   ├── services/
│   │   └── telegramCatalog.ts # Serviço para ler catálogo
│   └── pages/
│       └── TelegramPage.tsx   # Página do Telegram
│
├── TELEGRAM_QUICK_START.md    # Guia rápido
└── README.md                  # Este arquivo
```

---

## 🎯 Funcionalidades

### Bot do Telegram
- ✅ Recebe arquivos CBZ, ZIP, imagens
- ✅ Organiza automaticamente em pastas
- ✅ Atualiza catálogo JSON
- ✅ Faz commit e push para Git
- ✅ Comandos: `/start`, `/list`, `/status`, `/help`
- ✅ Restrição de acesso por Chat ID (opcional)

### App
- ✅ Página "Telegram" com todas as obras
- ✅ Estatísticas do catálogo
- ✅ Busca por título/gênero
- ✅ Visualização em grid
- ✅ Integração com biblioteca local
- ✅ Atualização automática do catálogo

---

## 🔐 Segurança

### Proteger o Token
- ✅ `.gitignore` configurado para não comitar `.env`
- ✅ Nunca compartilhe o token
- ✅ Regenere se vazar

### Restringir Acesso
Adicione seu Chat ID no `.env`:
```env
TELEGRAM_CHAT_ID=seu_chat_id
```

Obtenha em: @userinfobot

---

## 📖 Documentação

- **[TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md)** - Guia rápido (5 min)
- **[telegram-bot/README.md](./telegram-bot/README.md)** - Documentação completa
- **[README.md](./README.md)** - Documentação do app

---

## 🐛 Problemas Comuns

### Bot não responde
```bash
# Verifique se está rodando
ps aux | grep bot.js

# Reinicie
npm start
```

### Token inválido
```bash
# Verifique o .env
cat telegram-bot/.env

# Teste o token
curl https://api.telegram.org/botSEU_TOKEN/getMe
```

### Catálogo não atualiza
```bash
# Verifique permissões
ls -la public/catalog/

# Verifique logs do bot
pm2 logs manga-bot
```

---

## 🎉 Exemplo de Uso

### Cenário: Adicionando Solo Leveling

1. **No Telegram:**
   ```
   Você: [envia solo-leveling-001.cbz]
   Bot: ✅ Arquivo recebido!
        📝 Qual o nome da obra?
   
   Você: Solo Leveling
   Bot: ✅ Obra adicionada!
        📚 Catálogo atualizado
        🔄 Enviado para o Git
   ```

2. **No App:**
   - Abra a página "Telegram"
   - Veja "Solo Leveling" na lista
   - Clique para importar
   - Leia offline! 📚

---

## 📊 Estatísticas

O bot mantém estatísticas em `public/catalog/catalog.json`:

```json
{
  "mangas": [...],
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

O app exibe:
- Total de obras
- Total de capítulos
- Total de páginas
- Data da última atualização

---

## 🔄 Atualizações

### Atualizar o Bot
```bash
git pull
cd telegram-bot
npm install
pm2 restart manga-bot
```

### Atualizar o App
```bash
git pull
npm install
npm run build
# Rebuild do APK se necessário
```

---

## 🎯 Próximos Passos

1. ✅ Criar o bot no Telegram (@BotFather)
2. ✅ Configurar o token no `.env`
3. ✅ Iniciar o bot (`npm start`)
4. ✅ Testar enviando uma obra
5. ✅ Verificar no app (página "Telegram")
6. ✅ Configurar para rodar 24/7
7. ✅ Aproveite! 🎉

---

## 💡 Dicas

### Organize Suas Obras
- Use nomes descritivos: `obra-capitulo-001.cbz`
- Envie capas separadas (imagens)
- Mantenha o catálogo organizado

### Backup
- O Git já faz backup automático
- Faça backup do `.env` em local seguro
- Backup do `telegram-bot/downloads/`

### Performance
- Use PM2 para manter o bot rodando
- Configure logs rotativos
- Monitore o uso de disco

---

## 📞 Suporte

### Problemas com o Bot?
1. Verifique os logs: `pm2 logs manga-bot`
2. Teste o token: `curl https://api.telegram.org/botTOKEN/getMe`
3. Consulte: `telegram-bot/README.md`

### Problemas com o App?
1. Verifique se o catálogo existe: `public/catalog/catalog.json`
2. Recarregue a página
3. Consulte: `GUIA_RAPIDO.md`

---

## ✅ Checklist Final

- [ ] Bot criado no Telegram (@BotFather)
- [ ] Token copiado e salvo
- [ ] `.env` configurado
- [ ] Dependências instaladas (`npm install`)
- [ ] Bot iniciado (`npm start`)
- [ ] Testado com `/start`
- [ ] Primeira obra enviada
- [ ] Aparece no app (página "Telegram")
- [ ] Configurado para rodar 24/7 (PM2/nohup)

---

**Status:** ✅ Tudo pronto!

**Próximo:** Crie o bot no Telegram e comece a enviar suas obras! 🚀📱📚
