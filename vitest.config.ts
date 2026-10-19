import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    // Os testes de aceite batem no Postgres real: as regras que eles verificam
    // (limite de alocacao, comissao, auditoria) vivem em trigger, nao em JS.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
