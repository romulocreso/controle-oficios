const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

let isSignupMode = false;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  console.log('[toast]', message);
  toast.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 5000);
}

function toggleMode() {
  isSignupMode = !isSignupMode;

  const subtitle = document.getElementById('loginSubtitle');
  const confirmField = document.getElementById('confirmPasswordField');
  const submitBtn = document.getElementById('submitBtn');
  const toggleText = document.getElementById('toggleText');
  const toggleBtn = document.getElementById('toggleModeBtn');
  const title = document.querySelector('.login-card h1');

  if (isSignupMode) {
    if (subtitle) subtitle.textContent = 'Crie sua conta para acessar o sistema.';
    if (confirmField) confirmField.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Cadastrar';
    if (toggleText) toggleText.textContent = 'Já tem conta?';
    if (toggleBtn) toggleBtn.textContent = 'Faça login';
  } else {
    if (subtitle) subtitle.textContent = 'Faça login para acessar o sistema.';
    if (confirmField) confirmField.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Entrar';
    if (toggleText) toggleText.textContent = 'Não tem conta?';
    if (toggleBtn) toggleBtn.textContent = 'Cadastre-se';
  }
}

async function login() {
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';

  if (!email || !password) {
    showToast('Informe email e senha.');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(`Erro no login: ${error.message}`);
      return;
    }

    window.location.href = 'index.html';
  } catch (err) {
    console.error('[login] catch', err);
    showToast(`Erro no login: ${err.message || err}`);
  }
}

async function signup() {
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';
  const confirm = document.getElementById('loginPasswordConfirm')?.value || '';

  if (!email || !password || !confirm) {
    showToast('Preencha todos os campos.');
    return;
  }

  if (password !== confirm) {
    showToast('As senhas não coincidem.');
    return;
  }

  if (password.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      showToast(`Erro no cadastro: ${error.message}`);
      return;
    }

    if (data?.user?.identities?.length === 0) {
      showToast('Este e-mail já está cadastrado. Faça login.');
      toggleMode();
      return;
    }

    showToast('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
    toggleMode();
  } catch (err) {
    console.error('[signup] catch', err);
    showToast(`Erro no cadastro: ${err.message || err}`);
  }
}

document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSignupMode) {
    await signup();
  } else {
    await login();
  }
});

(async function initLoginPage() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      showToast(`Erro ao verificar sessão: ${error.message}`);
      return;
    }

    if (data?.session) {
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error('[initLoginPage] catch', err);
    showToast(`Erro ao verificar sessão: ${err.message || err}`);
  }
})();

window.login = login;
window.signup = signup;
window.toggleMode = toggleMode;
