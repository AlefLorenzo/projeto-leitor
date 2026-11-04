# 🤖 Bot do Telegram - Manga Offline

## 📱 O Que É Isso?

Um bot do Telegram que permite enviar obras (CBZ, ZIP, imagens) diretamente do seu celular para o app Manga Offline. O bot organiza automaticamente os arquivos, atualiza o catálogo e faz push para o Git.

## 🚀 Como Funciona

```
Você (Telegram) → Bot → Organiza → Catálogo → Git → App
```

1. Você envia um arquivo CBZ/ZIP/imagem para o bot
2. O bot pergunta o nome da obra
3. O bot salva o arquivo e atualiza o catálogo
4. O bot faz commit e push para o Git
5. O app atualiza automaticamente

## 📋 Pré-requisitos

- ✅ Node.js 18+
- ✅ Conta no Telegram
- ✅ Git configurado
- ✅ Repositório do Manga Offline

## 🔧 Instalação (5 minutos)

### Passo 1: Criar o Bot no Telegram

1. Abra o Telegram e procure por **@BotFather**
2. Envie o comando: `/newbot`
3. Escolha um nome para o bot (ex: "Manga Offline Bot")
4. Escolha um username (ex: `manga_offline_bot`)
5. **Copie o token** que o BotFather fornecer

### Passo 2: Configurar o Bot

```bash
# Navegue até a pasta do bot
cd telegram-bot

# Copie o arquivo de configuração
cp .env.example .env

# Edite o arquivo .env
nano .env  # ou use seu editor preferido
```

Cole o token no arquivo `.env`:
```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
```

### Passo 3: Instalar Dependências

```bash
npm install
```

### Passo 4: Iniciar o Bot

```bash
npm start
```

Pronto! O bot está rodando! 🎉

## 📖 Como Usar

### Enviar uma Obra

1. Abra o chat com seu bot no Telegram
2. Envie o comando `/start`
3. Envie um arquivo:
   - **CBZ** (Comic Book ZIP)
   - **ZIP** com imagens
   - **Imagem** (será usada como capa)
4. O bot vai perguntar o nome da obra
5. Responda com o título
6. Pronto! A obra será adicionada ao catálogo

### Comandos Disponíveis

- `/start` - Iniciar o bot
- `/list` - Listar todas as obras
- `/status` - Ver status do bot
- `/help` - Ajuda

### Exemplo de Uso

```
Você: [envia arquivo "solo-leveling-001.cbz"]
Bot: ✅ Arquivo recebido: solo-leveling-001.cbz
     📝 Agora, qual o nome da obra?

Você: Solo Leveling
Bot: 📝 Obra: Solo Leveling
     ⏳ Processando...
     ✅ Arquivo baixado!
     ✅ Obra "Solo Leveling" adicionada com sucesso!
     📚 O catálogo foi atualizado e enviado para o Git.
```

## 📁 Estrutura de Arquivos

```
telegram-bot/
├── bot.js              # Código principal do bot
├── package.json        # Dependências
├── .env                # Configurações (NÃO comitar!)
├── .env.example        # Template de configuração
└── downloads/          # Arquivos baixados (gerado automaticamente)
    └── nome-da-obra/
        ├── arquivo.cbz
        ├── cover.jpg
        └── metadata.json

public/
└── catalog/
    └── catalog.json    # Catálogo atualizado pelo bot
```

## 🔄 Integração com o App

O bot atualiza automaticamente o arquivo `public/catalog/catalog.json`. O app lê esse arquivo e exibe as obras na página "Telegram".

### Estrutura do Catálogo

```json
{
  "mangas": [
    {
      "id": "solo-leveling",
      "title": "Solo Leveling",
      "type": "manhwa",
      "genres": ["ação", "fantasia"],
      "status": "reading",
      "coverUrl": "/catalog/solo-leveling/cover.jpg",
      "chapters": [
        {
          "id": "chapter-1",
          "title": "Capítulo 1",
          "pageCount": 45,
          "files": ["solo-leveling-001.cbz"]
        }
      ],
      "addedAt": "2024-01-15T10:30:00.000Z",
      "source": "telegram"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

## 🌐 Rodando 24/7

### Opção 1: VPS (Recomendado)

Use um VPS barato (DigitalOcean, Hetzner, etc):

```bash
# No VPS
git clone seu-repositorio
cd manga-offline/telegram-bot
npm install

# Usar PM2 para manter o bot rodando
npm install -g pm2
pm2 start bot.js --name manga-bot
pm2 save
pm2 startup
```

### Opção 2: Raspberry Pi

Perfeito para rodar em casa:

```bash
# No Raspberry Pi
sudo apt update
sudo apt install nodejs npm git
git clone seu-repositorio
cd manga-offline/telegram-bot
npm install

# Usar systemd para iniciar automaticamente
sudo nano /etc/systemd/system/manga-bot.service
```

Conteúdo do arquivo:
```ini
[Unit]
Description=Manga Offline Telegram Bot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/manga-offline/telegram-bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl enable manga-bot
sudo systemctl start manga-bot
```

### Opção 3: Seu Computador (Testes)

```bash
# Manter rodando em background
npm start &

# Ou usar nohup
nohup npm start &
```

## 🔐 Segurança

### Restringir Acesso

Para permitir apenas seu acesso, adicione seu Chat ID no `.env`:

```env
TELEGRAM_CHAT_ID=seu_chat_id_aqui
```

**Como obter seu Chat ID:**
1. Procure por **@userinfobot** no Telegram
2. Envie `/start`
3. Copie o ID numérico

### Proteger o Token

- ✅ NUNCA comite o arquivo `.env`
- ✅ Use variáveis de ambiente em produção
- ✅ Regenere o token se vazar

## 🐛 Problemas Comuns

### "TELEGRAM_BOT_TOKEN não configurado"
**Solução:** Crie o arquivo `.env` com o token

### "Cannot find module"
**Solução:** Execute `npm install`

### Bot não responde
**Solução:** Verifique se o bot está rodando (`npm start`)

### Arquivo não baixa
**Solução:** Verifique se o arquivo é menor que 50MB (limite do Telegram)

### Catálogo não atualiza
**Solução:** Verifique permissões da pasta `public/catalog/`

## 📊 Estatísticas

O bot mantém estatísticas em `public/catalog/catalog.json`:

- Total de obras
- Total de capítulos
- Total de páginas
- Data da última atualização

## 🔄 Atualizações

Para atualizar o bot:

```bash
git pull
cd telegram-bot
npm install
# Reinicie o bot
pm2 restart manga-bot  # se usar PM2
```

## 📞 Suporte

Problemas com o bot?
1. Verifique os logs: `pm2 logs manga-bot`
2. Teste o token: `curl https://api.telegram.org/botSEU_TOKEN/getMe`
3. Verifique a conexão com a internet

## 🎯 Próximos Passos

Depois que o bot estiver funcionando:

1. ✅ Teste enviando uma obra
2. ✅ Verifique se aparece no app
3. ✅ Configure para rodar 24/7
4. ✅ Compartilhe com amigos (se quiser)

---

**Status:** ✅ Pronto para usar!

**Próximo:** Inicie o bot com `npm start` e envie sua primeira obra! 🚀
