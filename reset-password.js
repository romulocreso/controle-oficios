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
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

function setLoading(loading) {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Salvando...' : 'Salvar nova senha';
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('resetSubtitle').textContent = 'Digite sua nova senha abaixo.';
  }
});

document.getElementById('resetForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const newPassword = document.getElementById('newPassword')?.value || '';
  const confirm = document.getElementById('newPasswordConfirm')?.value || '';

  if (!newPassword || !confirm) {
    showToast('Preencha os dois campos.');
    return;
  }

  if (newPassword !== confirm) {
    showToast('As senhas não coincidem.');
    return;
  }

  if (newPassword.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  setLoading(true);

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
      showToast(`Erro: ${error.message}`);
      return;
    }

    showToast('Senha alterada com sucesso! Redirecionando...');
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
  } catch (err) {
    console.error('[resetPassword] catch', err);
    showToast(`Erro: ${err.message || err}`);
  } finally {
    setLoading(false);
  }
});
