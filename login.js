const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

let isSignupMode = false;
let isForgotMode = false;

const SITE_URL = 'https://romulocreso.github.io/controle-oficios';

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

function setLoginMode() {
  isSignupMode = false;
  isForgotMode = false;

  document.getElementById('loginSubtitle').textContent = 'Faça login para acessar o sistema.';
  document.getElementById('loginPassword').closest('label').classList.remove('hidden');
  document.getElementById('confirmPasswordField').classList.add('hidden');
  document.getElementById('submitBtn').textContent = 'Entrar';
  document.getElementById('toggleText').textContent = 'Não tem conta?';
  document.getElementById('toggleModeBtn').textContent = 'Cadastre-se';
  document.getElementById('forgotLink').classList.remove('hidden');
}

function toggleMode() {
  if (isForgotMode) { setLoginMode(); return; }

  isSignupMode = !isSignupMode;
  isForgotMode = false;

  if (isSignupMode) {
    document.getElementById('loginSubtitle').textContent = 'Crie sua conta para acessar o sistema.';
    document.getElementById('loginPassword').closest('label').classList.remove('hidden');
    document.getElementById('confirmPasswordField').classList.remove('hidden');
    document.getElementById('submitBtn').textContent = 'Cadastrar';
    document.getElementById('toggleText').textContent = 'Já tem conta?';
    document.getElementById('toggleModeBtn').textContent = 'Faça login';
    document.getElementById('forgotLink').classList.add('hidden');
  } else {
    setLoginMode();
  }
}

function toggleForgot() {
  isForgotMode = true;
  isSignupMode = false;

  document.getElementById('loginSubtitle').textContent = 'Informe seu e-mail para receber o link de redefinição.';
  document.getElementById('loginPassword').closest('label').classList.add('hidden');
  document.getElementById('confirmPasswordField').classList.add('hidden');
  document.getElementById('submitBtn').textContent = 'Enviar link';
  document.getElementById('toggleText').textContent = 'Lembrou a senha?';
  document.getElementById('toggleModeBtn').textContent = 'Voltar para o login';
  document.getElementById('forgotLink').classList.add('hidden');
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

async function forgotPassword() {
  const email = document.getElementById('loginEmail')?.value.trim() || '';

  if (!email) {
    showToast('Informe seu e-mail.');
    return;
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/reset-password.html`
    });

    if (error) {
      showToast(`Erro: ${error.message}`);
      return;
    }

    showToast('Link enviado! Verifique sua caixa de e-mail.');
    setLoginMode();
  } catch (err) {
    console.error('[forgotPassword] catch', err);
    showToast(`Erro: ${err.message || err}`);
  }
}

document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isForgotMode) {
    await forgotPassword();
  } else if (isSignupMode) {
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
window.toggleForgot = toggleForgot;
window.forgotPassword = forgotPassword;
