import { defineConfig } from 'vite'
import glsl from 'vite-plugin-glsl'
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
    plugins: [
        glsl(),
        wasm(),
        topLevelAwait()
    ],
    exclude: ['@dimforge/rapier3d'],
    build: {
        target: 'esnext',
        sourcemap: true
    },
})