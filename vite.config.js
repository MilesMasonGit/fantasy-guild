import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // Honor an externally assigned port (e.g. tooling that sets PORT) so two
    // dev servers can run side-by-side; falls back to Vite's default 5173.
    server: {
        port: Number(process.env.PORT) || 5173
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    esbuild: {
        loader: "jsx",
        include: /src\/.*\.jsx?$/,
        exclude: []
    }
});
