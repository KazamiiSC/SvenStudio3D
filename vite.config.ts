import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:49177'}},
  // Vitest runs only the *.test.ts suites; *.test.mjs/cjs use node:test (npm run test:node).
  test:{include:['tests/**/*.test.ts']}
});