// Supabase Client — RH System
//
// A chave abaixo é a `anon` (pública) e é PARA ser exposta no cliente: ela não
// concede acesso a nada por si só. Quem autoriza é o RLS do banco, avaliado a
// cada requisição contra o perfil do usuário logado. Nunca colocar aqui a
// `service_role`, que ignora RLS (o CI reprova o build se ela aparecer).

const SUPABASE_URL  = 'https://smfiujgaxaodyfwvoxwy.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZml1amdheGFvZHlmd3ZveHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjczOTQsImV4cCI6MjA5MzA0MzM5NH0.8zj1LtQOMZWOkaoYIxSQHG1xnpQFxtHVRtQ6vXHnrPY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================================
// TIMEOUT · RETRY · CACHE
// ============================================================================
// withTimeout, withRetry e makeCache vivem em src/utils/rede.js (carregado
// antes deste arquivo) para poderem ser cobertos por teste.

const Cache = makeCache();

// ============================================================================
// AUTH
// ============================================================================

const Auth = {
  async login(email, senha) {
    const { data, error } = await withTimeout(
      sb.auth.signInWithPassword({ email, password: senha })
    );
    if (error) throw error;
    Cache.invalidate();
    return data;
  },

  async logout() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    Cache.invalidate();
  },

  async sessaoAtual() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  onMudanca(callback) {
    sb.auth.onAuthStateChange((_event, session) => callback(session));
  },
};

// ============================================================================
// HELPERS — mappers (banco → UI)
// ============================================================================
// Definidos em src/utils/mappers.js, carregado antes deste arquivo.
