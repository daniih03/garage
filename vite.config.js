import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUILD_TIME = new Date().toISOString()

function buildMetaPlugin() {
  return {
    name: 'build-meta',
    buildStart() {
      const meta = { buildTime: BUILD_TIME }
      const pubDir = path.resolve(__dirname, 'public')
      if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true })
      fs.writeFileSync(path.resolve(pubDir, 'build-meta.json'), JSON.stringify(meta, null, 2))
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), buildMetaPlugin()],
  // Base path must match the GitHub Pages repo name
  base: '/garage/',
  define: {
    __GARAGE_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
})
