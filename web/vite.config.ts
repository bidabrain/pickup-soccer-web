import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// base 必须匹配 GitHub Pages 项目站点的子路径，否则线上资源 404
export default defineConfig({
  base: '/pickup-soccer-web/',
  plugins: [react(), tailwindcss()],
})
