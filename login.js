const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  console.log('[toast]', message);
  toast.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

async function login() {
  console.log('[login] clique detectado');

  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';

  if (!email || !password) {
    showToast('Informe email e senha.');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    console.log('[login] result', { data, error });

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

document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await login();
});

(async function initLoginPage() {
  console.log('[initLoginPage]');

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    console.log('[initLoginPage] session', { data, error });

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
