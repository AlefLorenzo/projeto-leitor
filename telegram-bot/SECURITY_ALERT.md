# 🚨 ALERTA DE SEGURANÇA CRÍTICO

## ⚠️ VOCÊ EXPOSU SUAS CREDENCIAIS!

Se você compartilhou suas credenciais do Telegram (api_id, api_hash) em algum chat público, repositório Git, ou qualquer lugar acessível por outras pessoas, **SUA CONTA ESTÁ EM RISCO**.

---

## 🛡️ AÇÃO IMEDIATA (FAÇA ISSO AGORA!)

### 1. Revogue Todas as Sessões Ativas

1. Abra o Telegram
2. Vá em **Configurações** → **Privacidade e Segurança**
3. Role até **Sessões Ativas**
4. Clique em **Encerrar todas as outras sessões**
5. Confirme a ação

### 2. Delete o App Comprometido

1. Acesse: https://my.telegram.org
2. Faça login com seu número
3. Vá em **API development tools**
4. Clique em **Delete app** (ou edite e gere novas credenciais)
5. Confirme a exclusão

### 3. Crie Novas Credenciais

1. Ainda em https://my.telegram.org
2. Clique em **Create new application**
3. Preencha os dados:
   - **App title**: Manga Offline (ou outro nome)
   - **Short name**: manga_offline
   - **URL**: pode deixar em branco
   - **Platform**: Desktop
   - **Description**: App pessoal de leitura de mangás
4. Clique em **Create application**
5. **Copie o novo api_id e api_hash**

### 4. Use as Novas Credenciais

1. Edite o arquivo `telegram-bot/.env`
2. Cole o novo `api_id` e `api_hash`
3. **NUNCA compartilhe essas credenciais novamente**

---

## 🔒 REGRAS DE SEGURANÇA

### ❌ NUNCA FAÇA ISSO:

- ❌ Colocar credenciais em código fonte
- ❌ Compartilhar em chats públicos
- ❌ Commitar no Git (mesmo em repositórios privados)
- ❌ Enviar por email/mensagem
- ❌ Colocar em screenshots
- ❌ Compartilhar com outras pessoas

### ✅ SEMPRE FAÇA ISSO:

- ✅ Usar arquivo `.env` (não commitado)
- ✅ Usar variáveis de ambiente
- ✅ Manter credenciais em local seguro
- ✅ Revogar sessões regularmente
- ✅ Usar 2FA (verificação em duas etapas)
- ✅ Monitorar sessões ativas

---

## 📋 CHECKLIST DE SEGURANÇA

- [ ] Revoguei todas as sessões ativas
- [ ] Deletei o app comprometido
- [ ] Criei novo app com novas credenciais
- [ ] Atualizei o `.env` com novas credenciais
- [ ] Verifiquei se `.env` está no `.gitignore`
- [ ] Ativei 2FA no Telegram
- [ ] Verifiquei sessões ativas (sem dispositivos desconhecidos)

---

## 🛡️ PROTEGENDO SUAS CREDENCIAIS

### Arquivo .gitignore

Certifique-se de que seu `.gitignore` contém:

```gitignore
# Telegram credentials (NUNCA comitar)
.env
.env.local
.env.*.local
telegram-bot/.env
telegram-bot/downloads/
```

### Verificar se .env está sendo rastreado

```bash
# Verificar se .env está no Git
git ls-files | grep .env

# Se aparecer, remova do Git (mas mantenha o arquivo local)
git rm --cached .env
git rm --cached telegram-bot/.env
git commit -m "Remove .env files from tracking"
```

### Usar Variáveis de Ambiente em Produção

Em vez de arquivo `.env`, use variáveis de ambiente do sistema:

**Linux/Mac:**
```bash
export TELEGRAM_API_ID=seu_api_id
export TELEGRAM_API_HASH=seu_api_hash
export TELEGRAM_SESSION=sua_session
```

**Windows (PowerShell):**
```powershell
$env:TELEGRAM_API_ID="seu_api_id"
$env:TELEGRAM_API_HASH="seu_api_hash"
$env:TELEGRAM_SESSION="sua_session"
```

---

## 🔍 VERIFICANDO SE SUA CONTA ESTÁ COMPROMETIDA

### Sinais de Alerta:

- ⚠️ Mensagens enviadas que você não escreveu
- ⚠️ Contatos adicionados que você não conhece
- ⚠️ Canais/grupos que você não entrou
- ⚠️ Sessões ativas em dispositivos desconhecidos
- ⚠️ Mudanças nas configurações que você não fez

### O Que Fazer se Comprometida:

1. **Encerre TODAS as sessões** imediatamente
2. **Altere sua senha** (se tiver 2FA)
3. **Verifique mensagens enviadas**
4. **Verifique contatos bloqueados**
5. **Denuncie ao Telegram** se necessário

---

## 📞 SUPORTE

### Telegram Oficial:
- Suporte: https://telegram.org/support
- FAQ: https://telegram.org/faq

### Problemas com Credenciais:
- https://my.telegram.org (gerenciar apps)
- Configurações → Privacidade e Segurança → Sessões Ativas

---

## ✅ BOAS PRÁTICAS

### Para Desenvolvedores:

1. **Nunca hardcode credenciais**
   ```javascript
   // ❌ ERRADO
   const API_ID = 123456789;
   const API_HASH = 'abc123...';
   
   // ✅ CORRETO
   const API_ID = process.env.TELEGRAM_API_ID;
   const API_HASH = process.env.TELEGRAM_API_HASH;
   ```

2. **Use .env para desenvolvimento**
   ```bash
   TELEGRAM_API_ID=seu_id
   TELEGRAM_API_HASH=seu_hash
   ```

3. **Use secrets manager para produção**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Docker Secrets
   - Kubernetes Secrets

4. **Rotação de credenciais**
   - Regenere periodicamente
   - Use diferentes credenciais para diferentes ambientes
   - Monitore uso das credenciais

---

## 🎯 RESUMO

**Se você expôs suas credenciais:**

1. ⚠️ **PÂNICO?** Não, mas aja rápido
2. 🛡️ **Revogue** todas as sessões
3. 🗑️ **Delete** o app comprometido
4. 🔑 **Crie** novas credenciais
5. 🔒 **Proteja** as novas credenciais
6. ✅ **Verifique** sua conta

**Lembre-se:** Credenciais expostas = Conta comprometida. Aja imediatamente!

---

## 📚 RECURSOS

- [Telegram API Docs](https://core.telegram.org/api)
- [Telegram Security](https://telegram.org/privacy)
- [MTProto Protocol](https://core.telegram.org/mtproto)
- [Telegram FAQ](https://telegram.org/faq)

---

**Última atualização:** 2024
**Status:** ⚠️ ALERTA ATIVO
