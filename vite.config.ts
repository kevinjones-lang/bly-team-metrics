import { createReadStream, existsSync, statSync, cpSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const standardFonts = resolve(root, "node_modules/pdfjs-dist/standard_fonts");

/** pdf.js needs the standard font files to draw Helvetica stamped by pdf-lib. */
function pdfjsStandardFonts(): Plugin {
  return {
    name: "pdfjs-standard-fonts",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        const marker = "/standard_fonts/";
        const at = raw.indexOf(marker);
        if (at < 0) return next();
        const rel = decodeURIComponent(raw.slice(at + marker.length));
        if (!rel || rel.includes("..") || rel.includes("/") || rel.includes("\\")) {
          res.statusCode = 400;
          res.end("bad font");
          return;
        }
        const file = resolve(standardFonts, rel);
        if (!file.startsWith(standardFonts + sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("missing font");
          return;
        }
        if (rel.endsWith(".ttf")) res.setHeader("Content-Type", "font/ttf");
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      cpSync(standardFonts, resolve(root, "dist/standard_fonts"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), pdfjsStandardFonts()],
  base: "/bly-team-metrics/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        microsoftAuth: resolve(root, "microsoft-auth.html"),
      },
    },
  },
});
