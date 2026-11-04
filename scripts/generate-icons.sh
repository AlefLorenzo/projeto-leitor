#!/bin/bash
# Script para gerar ícones em diferentes tamanhos a partir do SVG
# Requer: Inkscape ou ImageMagick (convert)

SVG_FILE="public/icons/icon.svg"
OUTPUT_DIR="public/icons"

# Tamanhos necessários para Android
SIZES=(72 96 128 144 152 192 384 512)

echo "🎨 Gerando ícones em diferentes tamanhos..."
echo ""

# Verificar se o arquivo SVG existe
if [ ! -f "$SVG_FILE" ]; then
    echo "❌ Arquivo SVG não encontrado: $SVG_FILE"
    exit 1
fi

# Tentar usar Inkscape
if command -v inkscape &> /dev/null; then
    echo "✅ Usando Inkscape..."
    for size in "${SIZES[@]}"; do
        output="$OUTPUT_DIR/icon-${size}.png"
        echo "  Gerando ${size}x${size}..."
        inkscape -w $size -h $size "$SVG_FILE" -o "$output" 2>/dev/null
    done

# Tentar usar ImageMagick
elif command -v convert &> /dev/null; then
    echo "✅ Usando ImageMagick..."
    for size in "${SIZES[@]}"; do
        output="$OUTPUT_DIR/icon-${size}.png"
        echo "  Gerando ${size}x${size}..."
        convert -background none "$SVG_FILE" -resize ${size}x${size} "$output"
    done

# Tentar usar librsvg (rsvg-convert)
elif command -v rsvg-convert &> /dev/null; then
    echo "✅ Usando librsvg..."
    for size in "${SIZES[@]}"; do
        output="$OUTPUT_DIR/icon-${size}.png"
        echo "  Gerando ${size}x${size}..."
        rsvg-convert -w $size -h $size "$SVG_FILE" -o "$output"
    done

else
    echo "❌ Nenhuma ferramenta de conversão encontrada!"
    echo ""
    echo "Instale uma das seguintes opções:"
    echo "  - Inkscape: https://inkscape.org/"
    echo "  - ImageMagick: https://imagemagick.org/"
    echo "  - librsvg: apt-get install librsvg2-bin (Linux)"
    echo ""
    echo "Alternativa: Use um conversor online:"
    echo "  - https://cloudconvert.com/svg-to-png"
    echo "  - https://svgtopng.com/"
    echo ""
    echo "Gere manualmente os seguintes tamanhos:"
    for size in "${SIZES[@]}"; do
        echo "  - icon-${size}.png (${size}x${size})"
    done
    exit 1
fi

echo ""
echo "✅ Ícones gerados com sucesso!"
echo "📍 Localização: $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/*.png
