# 🚨 AÇÃO IMEDIATA NECESSÁRIA - SEGURANÇA

## ⚠️ VOCÊ EXPOSS SUAS CREDENCIAIS DO TELEGRAM!

Você compartilhou publicamente:
- ❌ `api_id`: 36980005
- ❌ `api_hash`: 7b116b789b449adf59ddcdda453a4b7f

**ISSO É EXTREMAMENTE PERIGOSO!**

---

## 🛡️ FAÇA ISSO AGORA (5 minutos)

### Passo 1: Revogar Sessões (2 min)

1. Abra o **Telegram**
2. Vá em **Configurações** → **Privacidade e Segurança**
3. Role até **Sessões Ativas**
4. Clique em **Encerrar todas as outras sessões**
5. Confirme

### Passo 2: Deletar App Comprometido (1 min)

1. Acesse: https://my.telegram.org
2. Faça login
3. Vá em **API development tools**
4. Clique em **Delete app**
5. Confirme

### Passo 3: Criar Novo App (2 min)

1. Ainda em https://my.telegram.org
2. Clique em **Create new application**
3. Preencha:
   - **App title**: Manga Offline
   - **Short name**: manga_offline
   - **URL**: (deixe em branco)
   - **Platform**: Desktop
   - **Description**: App pessoal
4. Clique em **Create application**
5. **Copie o NOVO api_id e api_hash**

---

## 📋 DEPOIS DE PROTEGER SUAS CREDENCIAIS

### Configurar o Cliente Telegram

```bash
# 1. Navegue até a pasta do bot
cd telegram-bot

# 2. Instale as dependências
npm install

# 3. Crie o arquivo .env
cp .env.example .env

# 4. Edite o .env com suas NOVAS credenciais
nano .env
```

Cole no `.env`:
```env
TELEGRAM_API_ID=seu_novo_api_id
TELEGRAM_API_HASH=seu_novo_api_hash
TELEGRAM_SESSION=
GIT_REPO=..
```

### Iniciar o Cliente

```bash
npm start
```

### Primeiro Login

O cliente vai pedir:

1. **Número de telefone** (com código do país)
   ```
   📱 Digite seu número: +5511999999999
   ```

2. **Código de verificação** (enviado pelo Telegram)
   ```
   📲 Digite o código: 12345
   ```

3. **Senha 2FA** (se tiver)
   ```
   🔐 Digite sua senha: (ou Enter se não tiver)
   ```

4. **Session string** (IMPORTANTE!)
   ```
   💾 Session string: abc123def456...
   ```
   **Copie esta string** e adicione ao `.env`:
   ```env
   TELEGRAM_SESSION=abc123def456...
   ```

### Usar o Cliente

```
📋 MENU PRINCIPAL
1. Listar meus chats (canais/grupos)
2. Baixar de um chat específico
3. Ver catálogo atual
4. Sair
```

**Exemplo de uso:**
1. Escolha opção 1 (listar chats)
2. Escolha opção 2 (baixar de um chat)
3. Digite o ID ou username do canal
4. Digite o nome da obra
5. Pronto! A obra será baixada e adicionada ao app

---

## 📱 No App

Depois de baixar as obras:

1. Abra o app Manga Offline
2. Vá na página **Telegram** (novo botão na sidebar)
3. Veja todas as obras baixadas
4. Clique para importar para a biblioteca local
5. Leia offline! 📚

---

## 🔒 REGRAS DE SEGURANÇA

### ❌ NUNCA FAÇA ISSO:

- ❌ Colocar credenciais em chat público
- ❌ Colocar credenciais em código
- ❌ Commitar `.env` no Git
- ❌ Compartilhar credenciais com ninguém
- ❌ Colocar em screenshots

### ✅ SEMPRE FAÇA ISSO:

- ✅ Usar arquivo `.env` (não commitado)
- ✅ Usar variáveis de ambiente
- ✅ Manter credenciais em local seguro
- ✅ Revogar sessões regularmente
- ✅ Usar 2FA no Telegram
- ✅ Monitorar sessões ativas

---

## 📚 Documentação Completa

- **[SECURITY_ALERT.md](./telegram-bot/SECURITY_ALERT.md)** - Alerta de segurança detalhado
- **[telegram-bot/README.md](./telegram-bot/README.md)** - Guia completo do cliente
- **[TELEGRAM_QUICK_START.md](./TELEGRAM_QUICK_START.md)** - Guia rápido do bot

---

## ✅ Checklist Final

### Segurança (URGENTE)
- [ ] Revoguei todas as sessões ativas
- [ ] Deletei o app comprometido
- [ ] Criei novo app com novas credenciais
- [ ] Atualizei `.env` com novas credenciais
- [ ] Verifiquei se `.env` está no `.gitignore`
- [ ] Ativei 2FA no Telegram

### Configuração
- [ ] Instalei dependências (`npm install`)
- [ ] Configurei `.env` com credenciais
- [ ] Executei `npm start`
- [ ] Fiz login com sucesso
- [ ] Salvei session string no `.env`

### Uso
- [ ] Listei meus chats
- [ ] Baixei obras de um canal
- [ ] Verifiquei no app (página "Telegram")
- [ ] Importei para biblioteca local

---

## 🎯 Resumo

**O que aconteceu:**
- ⚠️ Você expôs credenciais do Telegram publicamente
- 🛡️ Precisamos revogar e criar novas credenciais
- ✅ Depois, configurar o cliente MTProto

**O que você tem agora:**
- ✅ Cliente Telegram MTProto completo
- ✅ Integração com o app
- ✅ Página "Telegram" no app
- ✅ Documentação de segurança
- ✅ Scripts de instalação

**Próximos passos:**
1. 🚨 **URGENTE:** Proteger suas credenciais (veja acima)
2. 🔧 Configurar o cliente com novas credenciais
3. 🚀 Usar o cliente para baixar obras
4. 📱 Verificar no app

---

## 📞 Suporte

### Problemas de Segurança?
🚨 **VEJA:** [SECURITY_ALERT.md](./telegram-bot/SECURITY_ALERT.md)

### Problemas com o Cliente?
📖 **VEJA:** [telegram-bot/README.md](./telegram-bot/README.md)

### Dúvidas Gerais?
📚 **VEJA:** [README.md](./README.md)

---

**Status:** ⚠️ AÇÃO DE SEGURANÇA NECESSÁRIA

**Prioridade:** 🔴 CRÍTICA - Faça agora!
