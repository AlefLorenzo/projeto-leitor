# 🚀 Guia Rápido - Bot do Telegram (5 minutos)

## Passo 1: Criar o Bot no Telegram (2 min)

1. Abra o Telegram no celular ou computador
2. Procure por **@BotFather** (bot oficial do Telegram)
3. Envie: `/newbot`
4. Responda com o nome do bot: `Manga Offline Bot`
5. Responda com o username: `manga_offline_bot` (ou outro único)
6. **Copie o token** que aparece (algo como `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Passo 2: Configurar o Bot (1 min)

```bash
# Abra o terminal na pasta do projeto
cd telegram-bot

# Execute o script de instalação
chmod +x install.sh
./install.sh
```

Ou manualmente:

```bash
cd telegram-bot
npm install
cp .env.example .env
```

## Passo 3: Adicionar o Token (1 min)

Edite o arquivo `telegram-bot/.env`:

```bash
nano .env  # ou use seu editor
```

Cole o token:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

Salve (Ctrl+O, Enter, Ctrl+X no nano)

## Passo 4: Iniciar o Bot (30 seg)

```bash
npm start
```

Você verá:
```
🤖 Bot do Telegram iniciado!
📁 Aguardando arquivos...
```

## Passo 5: Testar (1 min)

1. Abra o Telegram
2. Procure pelo seu bot (o username que você criou)
3. Envie: `/start`
4. Envie um arquivo CBZ, ZIP ou imagem
5. Responda com o nome da obra
6. Pronto! ✅

## 🎉 Pronto!

O bot está funcionando! Agora você pode:

- ✅ Enviar obras do celular diretamente para o app
- ✅ Ver as obras na página "Telegram" do app
- ✅ O catálogo atualiza automaticamente

## 🔄 Manter Rodando 24/7

### Opção Simples (seu computador)
```bash
# Usar nohup para manter rodando
nohup npm start &
```

### Opção Profissional (VPS/Raspberry Pi)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar com PM2
pm2 start bot.js --name manga-bot

# Salvar configuração
pm2 save
pm2 startup
```

## 📱 Próximos Passos

1. Teste enviando várias obras
2. Verifique se aparecem no app (página "Telegram")
3. Configure para rodar 24/7
4. Aproveite! 🎉

---

**Problemas?** Consulte: [telegram-bot/README.md](./telegram-bot/README.md)
