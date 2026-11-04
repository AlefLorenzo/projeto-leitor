import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

/**
 * Plugin de proxy dinâmico para imagens do MangaDex.
 * 
 * O MangaDex usa CDNs variáveis (ex: cmdxd98sb0x3yprd.mangadex.network)
 * que não têm CORS habilitado. Este plugin intercepta requests para
 * /api/mdimg?url=<URL_ENCODED> e retorna a imagem server-side,
 * adicionando os headers CORS necessários para o browser.
 */
function mangaDexImageProxyPlugin() {
  return {
    name: "mangadex-image-proxy",
    configureServer(server) {
      server.middlewares.use("/api/mdimg", (req, res) => {
        const qs = req.url?.split("?")[1] || "";
        const params = new URLSearchParams(qs);
        const rawUrl = params.get("url");

        if (!rawUrl) {
          res.writeHead(400);
          res.end("Missing url parameter");
          return;
        }

        let targetUrl;
        try {
          targetUrl = new URL(rawUrl);
        } catch {
          res.writeHead(400);
          res.end("Invalid url parameter");
          return;
        }

        // Permitir apenas domínios do MangaDex por segurança
        const allowed = [
          "mangadex.org",
          "mangadex.network",
          "uploads.mangadex.org",
        ];
        const isAllowed = allowed.some(
          (d) => targetUrl.hostname === d || targetUrl.hostname.endsWith("." + d)
        );

        if (!isAllowed) {
          res.writeHead(403);
          res.end("Domain not allowed");
          return;
        }

        const options = {
          hostname: targetUrl.hostname,
          port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: "GET",
          headers: {
            "User-Agent":
              "MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)",
            Referer: "https://mangadex.org/",
            Accept: "image/webp,image/avif,image/*,*/*",
          },
        };

        const protocol = targetUrl.protocol === "https:" ? https : http;

        const proxyReq = protocol.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, {
            "Content-Type": proxyRes.headers["content-type"] || "image/jpeg",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
          });
          proxyRes.pipe(res);
        });

        proxyReq.on("error", (err) => {
          console.error("[mdimg-proxy] Erro:", err.message);
          if (!res.headersSent) {
            res.writeHead(502);
            res.end("Proxy error: " + err.message);
          }
        });

        proxyReq.end();
      });
    },
  };
}

function cleanupDistPlugin() {
  return {
    name: "cleanup-dist-plugin",
    closeBundle() {
      import("node:fs").then(({ existsSync, rmSync }) => {
        import("node:path").then(({ resolve }) => {
          const distLib = resolve(__dirname, "dist/library");
          if (existsSync(distLib)) {
            rmSync(distLib, { recursive: true, force: true });
            console.log("[build] dist/library removido para manter o APK leve!");
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mangaDexImageProxyPlugin(), cleanupDistPlugin()],
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
    },
  },
});
