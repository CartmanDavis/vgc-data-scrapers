import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const configPath = resolve(__dirname, '../config.json')
const appConfig = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {}

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    'import.meta.env.VITE_SUPABASE_URL':      JSON.stringify(appConfig.supabase?.url ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(appConfig.supabase?.anonKey ?? ''),
  },
})
