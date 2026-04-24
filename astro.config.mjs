import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import sitemap from "@astrojs/sitemap";

// Tailwind v4 wraps its output in `@layer` (cascade layer) rules. Browsers
// without cascade-layer support — notably the Kobo e-reader's built-in
// browser — silently skip the entire `@layer { ... }` block, leaving the page
// completely unstyled. Tailwind emits layers in source order matching their
// desired cascade priority, so unwrapping them is safe and restores styling
// on legacy browsers.
function flattenCascadeLayers(css) {
  let out = css.replace(/@layer\s+[\w-]+(\s*,\s*[\w-]+)*\s*;/g, "");
  for (;;) {
    const match = out.match(/@layer\s+[\w-]+\s*\{/);
    if (!match) break;
    const start = match.index;
    const headerEnd = start + match[0].length;
    let depth = 1;
    let i = headerEnd;
    while (i < out.length && depth > 0) {
      const c = out[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    out = out.slice(0, start) + out.slice(headerEnd, i - 1) + out.slice(i);
  }
  return out;
}

function walkHtml(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, cb);
    else if (e.name.endsWith(".html")) cb(p);
  }
}

function legacyCssIntegration() {
  return {
    name: "legacy-css",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const distPath = url.fileURLToPath(dir);
        walkHtml(distPath, (file) => {
          const original = fs.readFileSync(file, "utf8");
          const updated = original.replace(
            /<style>([\s\S]*?)<\/style>/g,
            (_m, css) => `<style>${flattenCascadeLayers(css)}</style>`,
          );
          if (updated !== original) fs.writeFileSync(file, updated);
        });
      },
    },
  };
}

export default defineConfig({
  output: "static",
  site: "https://bearroll.dev",
  base: "/",
  build: {
    inlineStylesheets: "always",
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    sitemap({
      filter: (page) => !page.includes("/api/"),
    }),
    legacyCssIntegration(),
  ],
});
