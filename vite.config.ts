import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages(project site)로 배포할 때는 /text-extract/ 하위 경로를 사용한다.
// 다른 경로에 배포하려면 VITE_BASE 환경변수로 덮어쓴다.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? (process.env.VITE_BASE ?? '/text-extract/') : '/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
}));
