// Auth
// Login, logout, verificação de sessão e atualização do topbar
// Depende de: Auth e inicializarSupabase (supabase.js), showToast (dashboard.js)

function atualizarTopbarUsuario(sessao) {
  const nomeEl   = document.querySelector('.user-name');
  const roleEl   = document.querySelector('.user-role');
  const avatarEl = document.querySelector('.topbar-right .avatar');
  if (!sessao) return;
  const email = sessao.user?.email || '';
  const meta  = sessao.user?.user_metadata || {};
  const nome  = meta.nome || meta.full_name || email.split('@')[0] || 'Usuário';
  const role  = meta.perfil || meta.role || 'RH';
  if (nomeEl)   nomeEl.textContent   = nome.split(' ')[0];
  if (roleEl)   roleEl.textContent   = role.charAt(0).toUpperCase() + role.slice(1);
  if (avatarEl) avatarEl.textContent = nome.charAt(0).toUpperCase();
}

async function verificarSessao() {
  const sessao = await Auth.sessaoAtual();
  if (sessao) {
    atualizarTopbarUsuario(sessao);
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').style.display = '';
    await inicializarSupabase();
  } else {
    document.getElementById('login-screen').classList.add('active');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email   = document.getElementById('login-email').value.trim();
  const senha   = document.getElementById('login-password').value;
  const btn     = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  errorEl.classList.remove('show');
  errorEl.textContent = '';
  btn.classList.add('loading');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  try {
    const dados = await Auth.login(email, senha);
    atualizarTopbarUsuario(dados.session);
    showToast('Login realizado com sucesso!', 'ok');
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').style.display = '';
    await inicializarSupabase();
  } catch (err) {
    errorEl.textContent = err.message || 'Erro ao fazer login. Verifique suas credenciais.';
    errorEl.classList.add('show');
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function fazerLogout() {
  try {
    if (typeof window.sb !== 'undefined' && window.sb.removeAllChannels) {
      await window.sb.removeAllChannels();
    }
    await Auth.logout();
    showToast('Logout realizado com sucesso!', 'ok');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-form').reset();
  } catch (err) {
    showToast('Erro ao fazer logout: ' + err.message, 'err');
  }
}

// Detecta logout em outra aba
let autenticadoAntes = false;
Auth.onMudanca(async (sessao) => {
  if (autenticadoAntes && !sessao) fazerLogout();
  autenticadoAntes = !!sessao;
});

document.addEventListener('DOMContentLoaded', verificarSessao);
