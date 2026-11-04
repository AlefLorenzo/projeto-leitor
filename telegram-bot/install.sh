#!/bin/bash
# Script de instalação rápida do Bot do Telegram

echo "🤖 Instalando Bot do Telegram - Manga Offline"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "📥 Instale em: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Verificar se está na pasta correta
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script na pasta telegram-bot/"
    exit 1
fi

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install

# Criar arquivo .env se não existir
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado!"
    echo ""
    echo "⚠️  IMPORTANTE: Edite o arquivo .env e adicione seu token!"
    echo "   Token do bot: https://t.me/BotFather"
    echo ""
    echo "   Execute: nano .env"
else
    echo "✅ Arquivo .env já existe"
fi

# Criar diretório de downloads
mkdir -p downloads
echo "✅ Diretório downloads/ criado"

# Criar diretório do catálogo
mkdir -p ../public/catalog
echo "✅ Diretório catalog/ criado"

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Edite o arquivo .env com seu token"
echo "   2. Execute: npm start"
echo "   3. No Telegram, envie /start para o bot"
echo "   4. Envie sua primeira obra!"
echo ""
echo "📖 Documentação completa: telegram-bot/README.md"
