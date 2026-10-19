import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro('E-mail ou senha incorretos.');
    setEntrando(false);
  }

  return (
    <div className="flex items-center justify-center px-1 py-10">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm bg-white border border-gray-100 rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">VB</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 leading-tight">Villa Bichinho</p>
            <p className="text-xs text-gray-400 leading-tight">Entre para continuar</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          className="w-full mb-4 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full mb-4 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {erro && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          <LogIn size={16} />
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
