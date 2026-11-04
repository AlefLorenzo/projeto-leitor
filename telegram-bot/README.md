# 📱 Cliente Telegram MTProto - Manga Offline

## ⚠️ LEIA PRIMEIRO: SEGURANÇA

**Se você expôs suas credenciais (api_id, api_hash) publicamente:**

🚨 **VEJA:** [SECURITY_ALERT.md](./SECURITY_ALERT.md)

**Ações imediatas:**
1. Revogue todas as sessões ativas no Telegram
2. Delete o app em https://my.telegram.org
3. Crie um novo app com novas credenciais
4. Use APENAS variáveis de ambiente (NUNCA no código)

---

## 🎯 O Que É Isso?

Um cliente Telegram MTProto que permite:
- ✅ Acessar seus canais e grupos
- ✅ Baixar arquivos de mangás (CBZ, ZIP, imagens)
- ✅ Organizar automaticamente
- ✅ Atualizar o catálogo do app
- ✅ Enviar para o Git

**Diferença do Bot:**
- **Bot API**: Recebe arquivos que você envia para o bot
- **MTProto Client**: Acessa diretamente seus canais/grupos e baixa de lá

---

## 📋 Pré-requisitos

- ✅ Node.js 18+
- ✅ Conta Telegram ativa
- ✅ Credenciais API do Telegram (api_id, api_hash)
- ✅ Git configurado

---

## 🔑 Obter Credenciais

### Passo 1: Criar App no Telegram

1. Acesse: https://my.telegram.org
2. Faça login com seu número
3. Clique em **API development tools**
4. Se for primeira vez:
   - Preencha os dados do app
   - **App title**: Manga Offline
   - **Short name**: manga_offline
   - **URL**: (deixe em branco)
   - **Platform**: Desktop
   - **Description**: App pessoal de leitura
5. Clique em **Create application**
6. **Copie o api_id e api_hash**

### Passo 2: Configurar .env

```bash
cd telegram-bot
cp .env.example .env
nano .env  # ou use seu editor
```

Cole suas credenciais:
```env
TELEGRAM_API_ID=seu_api_id_aqui
TELEGRAM_API_HASH=seu_api_hash_aqui
TELEGRAM_SESSION=  # Será gerado após primeiro login
GIT_REPO=..
```

**⚠️ IMPORTANTE:**
- NUNCA comite o arquivo `.env`
- NUNCA compartilhe suas credenciais
- Mantenha em local seguro

---

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Iniciar cliente
npm start
```

### Primeiro Login

Na primeira execução, o cliente vai pedir:

1. **Número de telefone** (com código do país)
   ```
   📱 Digite seu número (com código do país, ex: +5511999999999):
   ```
   Digite: `+5511999999999` (seu número)

2. **Código de verificação** (enviado pelo Telegram)
   ```
   📲 Digite o código recebido no Telegram:
   ```
   Abra o Telegram e copie o código

3. **Senha 2FA** (se tiver ativado)
   ```
   🔐 Digite sua senha (se tiver 2FA):
   ```
   Digite sua senha ou pressione Enter se não tiver

4. **Session string** (IMPORTANTE!)
   ```
   💾 Session string (guarde com segurança):
   abc123def456...
   ```
   **Copie esta string** e adicione ao `.env`:
   ```env
   TELEGRAM_SESSION=abc123def456...
   ```

**Próxima vez que executar, não precisará fazer login novamente!**

---

## 📖 Como Usar

### Menu Principal

```
📋 MENU PRINCIPAL
1. Listar meus chats (canais/grupos)
2. Baixar de um chat específico
3. Ver catálogo atual
4. Sair
```

### Opção 1: Listar Chats

Mostra todos seus canais e grupos:
```
📱 Seus chats:
1. 📢 Canal: Manga Channel (ID: 123456789)
2. 👥 Grupo: Manga Group (ID: 987654321)
3. 💬 Chat: Amigos (ID: 111222333)
```

### Opção 2: Baixar de um Chat

1. Escolha a opção 2
2. Digite o ID ou username do chat:
   ```
   📥 Digite o ID ou username do chat (ex: @canal ou 123456789):
   ```
   Exemplos:
   - `@mangachannel` (username)
   - `123456789` (ID numérico)

3. O cliente busca arquivos de mangá:
   ```
   🔍 Buscando mensagens em: @mangachannel
   ✅ Chat encontrado: Manga Channel
   
   📬 150 mensagens encontradas
   🔎 Procurando arquivos de mangá...
   
   📄 one-piece-001.cbz (15/01/2024)
   📄 one-piece-002.cbz (22/01/2024)
   📄 one-piece-003.cbz (29/01/2024)
   
   ✅ 3 arquivos encontrados
   ```

4. Digite o nome da obra:
   ```
   📝 Nome da obra: One Piece
   ```

5. Aguarde o download:
   ```
   ⬇️  Baixando 3 arquivos...
   [1/3] one-piece-001.cbz
   [2/3] one-piece-002.cbz
   [3/3] one-piece-003.cbz
   
   ✅ Download concluído!
   ✅ Catálogo atualizado
   ✅ Enviado para o Git!
   ```

### Opção 3: Ver Catálogo

Mostra todas as obras já baixadas:
```
📚 Catálogo atual:
1. One Piece (3 capítulos)
2. Solo Leveling (5 capítulos)
3. Tower of God (2 capítulos)

📊 Total: 3 obras
```

---

## 📁 Estrutura de Arquivos

```
telegram-bot/
├── client.js              # Cliente MTProto
├── package.json           # Dependências
├── .env                   # Credenciais (NÃO comitar!)
├── .env.example           # Template
├── SECURITY_ALERT.md      # Alerta de segurança
├── README.md              # Este arquivo
└── downloads/             # Arquivos baixados
    └── one-piece/
        ├── one-piece-001.cbz
        ├── one-piece-002.cbz
        └── metadata.json

public/
└── catalog/
    └── catalog.json       # Catálogo atualizado
```

---

## 🔄 Integração com o App

O cliente atualiza automaticamente `public/catalog/catalog.json`. O app lê esse arquivo na página "Telegram".

### Estrutura do Catálogo

```json
{
  "mangas": [
    {
      "id": "one-piece",
      "title": "One Piece",
      "type": "manga",
      "genres": [],
      "status": "reading",
      "coverUrl": "/catalog/one-piece/cover.jpg",
      "chapters": [
        {
          "id": "chapter-1",
          "title": "Capítulo 1",
          "pageCount": 3,
          "files": []
        }
      ],
      "addedAt": "2024-01-15T10:30:00.000Z",
      "source": "telegram-client"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

---

## 🔐 Segurança

### Protegendo Suas Credenciais

1. **NUNCA comite o .env**
   ```bash
   # Verificar se está no .gitignore
   cat .gitignore | grep .env
   ```

2. **Usar variáveis de ambiente**
   ```bash
   # Linux/Mac
   export TELEGRAM_API_ID=seu_id
   export TELEGRAM_API_HASH=seu_hash
   ```

3. **Proteger a session string**
   - A session string dá acesso completo à sua conta
   - Trate como uma senha
   - Não compartilhe com ninguém

### Verificar Sessões Ativas

1. Telegram → Configurações → Privacidade e Segurança
2. Role até **Sessões Ativas**
3. Verifique se há dispositivos desconhecidos
4. Encerre sessões suspeitas

---

## 🐛 Problemas Comuns

### "TELEGRAM_API_ID e TELEGRAM_API_HASH não configurados"
**Solução:** Crie o arquivo `.env` com suas credenciais

### "PHONE_CODE_INVALID"
**Solução:** O código expirou. Solicite um novo e digite rapidamente

### "SESSION_EXPIRED"
**Solução:** Delete `TELEGRAM_SESSION` do `.env` e faça login novamente

### "Cannot find module 'telegram'"
**Solução:** Execute `npm install`

### "Access denied"
**Solução:** Você não tem acesso ao chat. Verifique se está inscrito no canal/grupo

---

## 📊 Comandos Úteis

### Listar todos os chats
```bash
npm start
# Escolha opção 1
```

### Baixar de um canal específico
```bash
npm start
# Escolha opção 2
# Digite: @nome_do_canal
```

### Ver catálogo
```bash
npm start
# Escolha opção 3
```

### Resetar sessão
```bash
# Edite .env e remova TELEGRAM_SESSION
nano .env
# Execute novamente
npm start
```

---

## 🌐 Rodando em Servidor

### Usando PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar cliente
pm2 start client.js --name manga-client

# Ver logs
pm2 logs manga-client

# Parar
pm2 stop manga-client
```

### Usando Systemd (Linux)

Crie `/etc/systemd/system/manga-client.service`:

```ini
[Unit]
Description=Manga Offline Telegram Client
After=network.target

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/para/manga-offline/telegram-bot
ExecStart=/usr/bin/node client.js
Restart=always
RestartSec=10
Environment=TELEGRAM_API_ID=seu_id
Environment=TELEGRAM_API_HASH=seu_hash
Environment=TELEGRAM_SESSION=sua_session

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl enable manga-client
sudo systemctl start manga-client
```

---

## 📚 Diferença: Bot vs Client

| Recurso | Bot API | MTProto Client |
|---------|---------|----------------|
| Recebe arquivos enviados | ✅ | ❌ |
| Acessa canais/grupos | ❌ | ✅ |
| Baixa de canais | ❌ | ✅ |
| Precisa de token | ✅ | ❌ |
| Precisa de api_id/hash | ❌ | ✅ |
| Login com número | ❌ | ✅ |
| Acesso completo à conta | ❌ | ✅ |
| Mais seguro | ✅ | ⚠️ |

**Use Bot API para:**
- Receber arquivos que você envia
- Interação simples

**Use MTProto Client para:**
- Baixar de canais/grupos
- Acesso direto ao Telegram
- Automação completa

---

## 🎯 Próximos Passos

1. ✅ Obter credenciais em https://my.telegram.org
2. ✅ Configurar `.env` com credenciais
3. ✅ Executar `npm install`
4. ✅ Executar `npm start`
5. ✅ Fazer login (primeira vez)
6. ✅ Salvar session string no `.env`
7. ✅ Listar chats (opção 1)
8. ✅ Baixar de um canal (opção 2)
9. ✅ Verificar no app (página "Telegram")

---

## 📞 Suporte

### Problemas com o Cliente?
1. Verifique os logs
2. Teste as credenciais em https://my.telegram.org
3. Consulte: [SECURITY_ALERT.md](./SECURITY_ALERT.md)

### Problemas de Segurança?
1. **URGENTE:** Veja [SECURITY_ALERT.md](./SECURITY_ALERT.md)
2. Revogue sessões imediatamente
3. Crie novas credenciais

---

**Status:** ✅ Pronto para usar

**⚠️ Lembre-se:** Proteja suas credenciais como uma senha!
