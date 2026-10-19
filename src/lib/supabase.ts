import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Le do import.meta.env no browser e do process.env sob vitest/node.
function env(nome: string): string {
  const doVite = (import.meta as unknown as { env?: Record<string, string> }).env?.[nome];
  const doNode = typeof process !== 'undefined' ? process.env?.[nome] : undefined;
  const valor = doVite ?? doNode;
  if (!valor) {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. Copie .env.example para .env.local e preencha.`
    );
  }
  return valor;
}

export const supabase = createClient<Database>(
  env('VITE_SUPABASE_URL'),
  env('VITE_SUPABASE_PUBLISHABLE_KEY')
);
