import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  site: "https://joshuarichards001.github.io",
  base: "/bear-blog-website",
  vite: {
    plugins: [tailwindcss()],
  },
});
