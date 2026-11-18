import { defineConfig } from "vite";
// fs.allow only affects the local dev server (used by the ?demo= test route).
export default defineConfig({ build: { target: "es2022" }, server: { fs: { strict: false } } });
