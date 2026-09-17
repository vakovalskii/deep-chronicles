// Сборка: номер версии в код (__BUILD__) и в dist/version.json — клиент сравнивает и предлагает обновиться
import { defineConfig } from 'vite';
const BUILD = String(Date.now());
export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{ name: 'version-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); } }],
});
