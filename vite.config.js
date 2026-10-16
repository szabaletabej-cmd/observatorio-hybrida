import {defineConfig} from "vite";

// base relativa: funciona igual en Cloudflare Pages, GitHub Pages o una subcarpeta del micrositio
export default defineConfig({base: "./", build: {outDir: "dist"}});
