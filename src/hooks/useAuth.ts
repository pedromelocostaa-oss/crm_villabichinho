import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// A RLS do Supabase so libera quem esta autenticado, entao o modulo
// financeiro inteiro depende de ter sessao.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      setCarregando(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSession(nova);
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sair = useCallback(() => supabase.auth.signOut(), []);

  return { session, carregando, sair };
}
