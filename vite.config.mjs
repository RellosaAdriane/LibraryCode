import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const googleClientId =
    env.VITE_GOOGLE_CLIENT_ID ||
    env.GOOGLE_CLIENT_ID ||
    env.REACT_APP_GOOGLE_CLIENT_ID ||
    '';

  return {
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  define: googleClientId
    ? { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId) }
    : {},
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/setupTests.js']
  }
};
});