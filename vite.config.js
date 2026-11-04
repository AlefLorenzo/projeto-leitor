import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      ignored: [
        "**/library/**",
        "**/public/**",
        "**/telegram-bot/**",
        "**/*.cbz",
        "**/*.zip",
        "**/*.json",
        "**/.git/**",
      ],
    },
    proxy: {
      // Proxy para a API do MangaDex (evita CORS no browser)
      "/api/mangadex": {
        target: "https://api.mangadex.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/mangadex/, ""),
        headers: {
          "User-Agent":
            "MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)",
          Referer: "https://mangadex.org/",
        },
      },
      // Proxy para capas do MangaDex
      "/api/mdcovers": {
        target: "https://uploads.mangadex.org/covers",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/mdcovers/, ""),
        headers: {
          "User-Agent":
            "MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)",
          Referer: "https://mangadex.org/",
        },
      },
      // Proxy para imagens at-home (páginas dos capítulos)
      "/api/mdhome": {
        target: "https://uploads.mangadex.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/mdhome/, ""),
        headers: {
          "User-Agent":
            "MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)",
          Referer: "https://mangadex.org/",
        },
      },
    },
  },
});
