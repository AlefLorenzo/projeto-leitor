"""
LycanToons Extractor adaptado para Manga Offline
Baseado no script c:\\Users\\Buggynay\\baixaobras\\baixar_obras.py
Extrai capítulos do LycanToons diretamente para a biblioteca do Manga Offline,
gera pacotes .cbz, calcula Hashes SHA-256 e atualiza o catálogo local e do GitHub.
"""

import os
import sys
import time
import re
import io
import json
import zipfile
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from PIL import Image
import requests

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Pastas do projeto Manga Offline
ROOT_DIR = Path(__file__).resolve().parent.parent
LIBRARY_DIR = ROOT_DIR / "library"
OBRAS_DIR = ROOT_DIR / "obras"
CATALOG_FILE = ROOT_DIR / "public" / "catalog" / "catalog.json"
APP_CATALOG_FILE = ROOT_DIR / "app" / "catalog.json"

LIBRARY_DIR.mkdir(exist_ok=True)
OBRAS_DIR.mkdir(exist_ok=True)

def canonical_slug(name: str) -> str:
    s = name.lower()
    s = re.sub(r'[\u0300-\u036f]', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def sha256_file(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def get_driver(headless: bool = True) -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    if headless:
        options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver

def update_catalogs(manga_id: str, title: str, chapters_info: List[Dict], cover_path: Optional[str] = None):
    """Atualiza o public/catalog/catalog.json e app/catalog.json do Manga Offline"""
    for file_path in [CATALOG_FILE, APP_CATALOG_FILE]:
        if not file_path.exists():
            continue
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                cat = json.load(f)
            
            mangas = cat.get('mangas', [])
            manga = next((m for m in mangas if m.get('id') == manga_id), None)
            
            if not manga:
                manga = {
                    'id': manga_id,
                    'title': title,
                    'synopsis': f'Obra importada do LycanToons: {title}.',
                    'coverUrl': f'obras/{manga_id}/cover.jpg' if cover_path else '',
                    'genres': ['Manhwa', 'Ação'],
                    'type': 'manhwa',
                    'status': 'ongoing',
                    'source': 'lycantoons',
                    'chapters': []
                }
                mangas.append(manga)
            
            if not manga.get('chapters'):
                manga['chapters'] = []
                
            for ch in chapters_info:
                existing = next((c for c in manga['chapters'] if c.get('number') == ch['number']), None)
                if existing:
                    existing.update(ch)
                else:
                    manga['chapters'].append(ch)
                    
            manga['chapters'].sort(key=lambda c: c.get('number', 0))
            manga['totalChapters'] = len(manga['chapters'])
            
            cat['lastUpdated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(cat, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            print(f"  ⚠️ Erro ao atualizar catálogo {file_path.name}: {e}")

class LycanExtractor:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.driver = None
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Referer': 'https://lycantoons.com/',
        })

    def start_browser(self):
        if not self.driver:
            print("🚀 Inicializando Chrome...")
            self.driver = get_driver(headless=self.headless)

    def close_browser(self):
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None

    def get_chapters(self, base_url: str) -> List[int]:
        self.start_browser()
        print(f"🔍 Consultando obra: {base_url}")
        self.driver.get(base_url)
        time.sleep(4)
        
        # Scroll para garantir renderização
        for _ in range(2):
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)

        links = self.driver.find_elements(By.CSS_SELECTOR, "a[href*='/']")
        capitulos = []
        clean_base = base_url.rstrip('/')
        
        for link in links:
            href = link.get_attribute('href')
            if href and href.startswith(clean_base + '/'):
                try:
                    num_part = href.split('/')[-1]
                    num = float(num_part) if '.' in num_part else int(num_part)
                    capitulos.append(num)
                except:
                    pass
                    
        return sorted(list(set(capitulos)))

    def download_chapter_images(self, chapter_url: str, dest_folder: Path) -> List[Path]:
        """Baixa as imagens de um capítulo e salva como 001.jpg, 002.jpg..."""
        self.start_browser()
        self.driver.get(chapter_url)
        time.sleep(5)

        # Scroll gradual para carregar imagens com lazy loading
        total_height = int(self.driver.execute_script("return document.body.scrollHeight"))
        for y in range(0, total_height, 600):
            self.driver.execute_script(f"window.scrollTo(0, {y});")
            time.sleep(0.3)
        time.sleep(2)

        imgs = self.driver.find_elements(By.TAG_NAME, "img")
        img_urls = []
        
        for img in imgs:
            src = img.get_attribute("src")
            if src and any(ext in src.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                if not any(x in src.lower() for x in ['logo', 'icon', 'avatar', 'banner', 'ad']):
                    if src not in img_urls:
                        img_urls.append(src)

        if not img_urls:
            return []

        dest_folder.mkdir(parents=True, exist_ok=True)
        saved_files = []

        for i, url in enumerate(img_urls):
            try:
                res = self.session.get(url, timeout=30)
                if not res.ok or len(res.content) < 1000:
                    continue
                
                # Normalizar imagem para JPEG com alta fidelidade
                img = Image.open(io.BytesIO(res.content))
                if img.mode in ('RGBA', 'LA', 'P'):
                    bg = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'RGBA':
                        bg.paste(img, mask=img.split()[3])
                    else:
                        bg.paste(img)
                    img = bg
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                page_name = f"{i + 1:03d}.jpg"
                page_path = dest_folder / page_name
                img.save(page_path, format='JPEG', quality=90)
                saved_files.append(page_path)
            except Exception as e:
                print(f"    ⚠️ Erro na imagem {i + 1}: {e}")

        return saved_files

    def package_cbz(self, chapter_folder: Path, cbz_path: Path) -> Optional[dict]:
        """Cria o arquivo .cbz a partir das imagens salvas e calcula o SHA-256"""
        images = sorted(list(chapter_folder.glob("*.jpg")))
        if not images:
            return None

        cbz_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(cbz_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for img_file in images:
                zipf.write(img_file, arcname=img_file.name)

        size_bytes = cbz_path.stat().st_size
        sha = sha256_file(cbz_path)

        return {
            'sizeBytes': size_bytes,
            'sha256': sha,
            'pageCount': len(images)
        }

    def process_work(self, work_url: str):
        """Processa a obra completa ou capítulos individuais"""
        match = re.search(r'/series/([^/?#]+)', work_url)
        if not match:
            print("❌ URL inválida. Esperado: https://lycantoons.com/series/nome-da-obra")
            return

        slug = match.group(1)
        title = slug.replace('-', ' ').title()
        clean_slug = canonical_slug(slug)
        base_work_url = f"https://lycantoons.com/series/{slug}"

        print(f"\n============================================================")
        print(f"📖 Processando Obra: {title} (slug: {clean_slug})")
        print(f"============================================================")

        caps = self.get_chapters(base_work_url)
        if not caps:
            print("❌ Nenhum capítulo encontrado ou página protegida por desafio Cloudflare.")
            print("💡 Dica: execute com o argumento '--visible' para resolver o desafio na tela.")
            return

        print(f"✅ Encontrados {len(caps)} capítulos: do {caps[0]} ao {caps[-1]}")

        manga_lib_dir = LIBRARY_DIR / clean_slug
        manga_lib_dir.mkdir(exist_ok=True)
        manga_obras_dir = OBRAS_DIR / clean_slug
        manga_obras_dir.mkdir(exist_ok=True)

        chapters_processed = []

        for ch_num in caps:
            folder_name = f"Capitulo {int(ch_num):03d}" if float(ch_num).is_integer() else f"Capitulo {ch_num:05.1f}"
            ch_lib_folder = manga_lib_dir / folder_name
            cbz_file = manga_obras_dir / "capitulos" / f"cap-{int(ch_num):03d}.cbz"

            # Anti-duplicidade: verificar se já existe com páginas válidas
            if cbz_file.exists() and cbz_file.stat().st_size > 10000:
                print(f"  ✓ {folder_name} já baixado e compactado. Pulando...")
                sha = sha256_file(cbz_file)
                chapters_processed.append({
                    'id': f'lycan-{clean_slug}-cap-{int(ch_num):03d}',
                    'number': ch_num,
                    'title': f'Capítulo {ch_num}',
                    'format': 'cbz',
                    'downloadUrl': f'obras/{clean_slug}/capitulos/cap-{int(ch_num):03d}.cbz',
                    'sizeBytes': cbz_file.stat().st_size,
                    'sha256': sha,
                    'pageCount': len(list(ch_lib_folder.glob("*.jpg"))) if ch_lib_folder.exists() else 20
                })
                continue

            print(f"  📥 Baixando {folder_name} ({base_work_url}/{ch_num})...")
            saved_pages = self.download_chapter_images(f"{base_work_url}/{ch_num}", ch_lib_folder)
            
            if saved_pages:
                pkg_info = self.package_cbz(ch_lib_folder, cbz_file)
                if pkg_info:
                    print(f"  📦 Compactado {folder_name}: {pkg_info['pageCount']} págs, {pkg_info['sizeBytes'] / 1048576:.1f}MB (SHA: {pkg_info['sha256'][:8]}...)")
                    chapters_processed.append({
                        'id': f'lycan-{clean_slug}-cap-{int(ch_num):03d}',
                        'number': ch_num,
                        'title': f'Capítulo {ch_num}',
                        'format': 'cbz',
                        'downloadUrl': f'obras/{clean_slug}/capitulos/cap-{int(ch_num):03d}.cbz',
                        'sizeBytes': pkg_info['sizeBytes'],
                        'sha256': pkg_info['sha256'],
                        'pageCount': pkg_info['pageCount']
                    })
            else:
                print(f"  ⚠️ Falha ao baixar imagens do {folder_name}.")

            time.sleep(2)

        # Atualizar catálogos
        update_catalogs(f"lycan-{clean_slug}", title, chapters_processed)
        print(f"\n🎉 Obra {title} finalizada com sucesso!")
        print(f"💾 Disponível na biblioteca e no leitor offline do Manga Offline!")

def main():
    args = sys.argv[1:]
    headless = '--visible' not in args
    
    urls = [a for a in args if a.startswith('http')]
    
    if not urls:
        print("Uso:")
        print("  python scripts/lycan_extractor.py <URL_DA_OBRA> [--visible]")
        print("\nExemplo:")
        print("  python scripts/lycan_extractor.py https://lycantoons.com/series/debutar-ou-morrer")
        print("  python scripts/lycan_extractor.py https://lycantoons.com/series/o-rei-demonio-devastado-pelos-herois --visible")
        return

    extractor = LycanExtractor(headless=headless)
    try:
        for u in urls:
            extractor.process_work(u)
    finally:
        extractor.close_browser()

if __name__ == '__main__':
    main()
