const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

async function login() {
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPassword')?.value || '';

  if (!email || !password) {
    showToast('Informe email e senha.');
    return;
  }

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showToast(`Erro no login: ${error.message}`);
      return;
    }

    window.location.href = 'index.html';
  } catch (err) {
    showToast(`Erro no login: ${err.message || err}`);
  }
}

(async function initLoginPage() {
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) {
    window.location.href = 'index.html';
  }
})();

window.login = login;
