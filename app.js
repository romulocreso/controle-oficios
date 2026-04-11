const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

let allRows = [];
let currentUser = null;

const els = {
  loginSection: document.getElementById('loginSection'),
  showLoginBtn: document.getElementById('showLoginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  loginBtn: document.getElementById('loginBtn'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  form: document.getElementById('oficioForm'),
  saveBtn: document.getElementById('saveBtn'),
  clearBtn: document.getElementById('clearBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportBtn: document.getElementById('exportBtn'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  recebidoFilter: document.getElementById('recebidoFilter'),
  respondidoFilter: document.getElementById('respondidoFilter'),
  tableBody: document.querySelector('#oficiosTable tbody'),
  stats: document.getElementById('stats'),
  toast: document.getElementById('toast'),
  recordId: document.getElementById('recordId'),
  editingBadge: document.getElementById('editingBadge')
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

function normalizeText(v) {
  return (v || '').toString().trim().toUpperCase();
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = parseDate(value);
  if (!d) return value || '';
  return d.toLocaleDateString('pt-BR');
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

function diffDays(a, b) {
  const ms = 1000 * 60 * 60 * 24;
  return Math.floor((a - b) / ms);
}

function computeStatus(row) {
  const recebido = normalizeText(row.recebido);
  const respondido = normalizeText(row.respondido);
  const recebDate = parseDate(row.data_recebimento);
  const respostaDate = parseDate(row.data_resposta);
  const prazoDias = Number(row.prazo_resposta_dias || 0);
  let limite = parseDate(row.data_limite_resposta);

  if (!limite && recebDate && prazoDias > 0) {
    limite = addDays(recebDate, prazoDias);
    row.data_limite_resposta = limite.toISOString().slice(0, 10);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (respondido === 'SIM' || respostaDate) return 'RESPONDIDO';
  if (recebido === 'NAO') return 'NAO RECEBIDO';
  if (!limite) return (recebido === 'SIM' || recebDate) ? 'SEM PRAZO' : 'PENDENTE DE DADOS';

  const delta = diffDays(limite, today);
  if (delta < 0) return 'VENCIDO';
  if (delta === 0) return 'VENCE HOJE';
  return 'NO PRAZO';
}

function enrichRow(row) {
  return { ...row, status_prazo_calculado: computeStatus({ ...row }) };
}

function badge(status) {
  return `<span class="badge ${status.replaceAll(' ', '\\ ')}">${status}</span>`;
}

function escapeHtml(value) {
  return (value || '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fillStatusFilter(rows) {
  const current = els.statusFilter.value;
  const statuses = [...new Set(rows.map(r => r.status_prazo_calculado))].sort();
  els.statusFilter.innerHTML = '<option value="">Todos</option>' +
    statuses.map(s => `<option value="${s}">${s}</option>`).join('');
  els.statusFilter.value = current;
}

function getFilteredRows() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const recebido = els.recebidoFilter.value;
  const respondido = els.respondidoFilter.value;

  return allRows.filter(row => {
    const hay = [
      row.numero_oficio,
      row.unidade,
      row.classe,
      row.observacoes,
      row.origem_arquivo
    ].join(' ').toLowerCase();

    const matchesText = !q || hay.includes(q);
    const matchesStatus = !status || row.status_prazo_calculado === status;
    const matchesRecebido = !recebido || normalizeText(row.recebido) === recebido;
    const matchesRespondido = !respondido || normalizeText(row.respondido) === respondido;

    return matchesText && matchesStatus && matchesRecebido && matchesRespondido;
  });
}

function renderStats(rows) {
  const stats = {
    total: rows.length,
    recebidos: rows.filter(r => normalizeText(r.recebido) === 'SIM').length,
    naoRecebidos: rows.filter(r => normalizeText(r.recebido) === 'NAO').length,
    vencidos: rows.filter(r => r.status_prazo_calculado === 'VENCIDO').length,
    noPrazo: rows.filter(r => r.status_prazo_calculado === 'NO PRAZO').length,
    respondidos: rows.filter(r => normalizeText(r.respondido) === 'SIM').length,
  };

  els.stats.innerHTML = `
    <div class="stat">Total<strong>${stats.total}</strong></div>
    <div class="stat">Recebidos<strong>${stats.recebidos}</strong></div>
    <div class="stat">Não recebidos<strong>${stats.naoRecebidos}</strong></div>
    <div class="stat">No prazo<strong>${stats.noPrazo}</strong></div>
    <div class="stat">Vencidos<strong>${stats.vencidos}</strong></div>
    <div class="stat">Respondidos<strong>${stats.respondidos}</strong></div>
  `;
}

function renderTable(rows) {
  els.tableBody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.numero_oficio)}</td>
      <td>${escapeHtml(row.unidade || '')}</td>
      <td>${escapeHtml(row.classe || '')}</td>
      <td>${escapeHtml(row.recebido || '')}</td>
      <td>${escapeHtml(formatDate(row.data_recebimento))}</td>
      <td>${escapeHtml(row.prazo_resposta_dias || '')}</td>
      <td>${escapeHtml(formatDate(row.data_limite_resposta))}</td>
      <td>${escapeHtml(row.respondido || '')}</td>
      <td>${badge(row.status_prazo_calculado)}</td>
      <td>${escapeHtml(row.observacoes || '')}</td>
      <td>${escapeHtml(row.origem_arquivo || '')}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="secondary" onclick="editRow('${row.id}')">Editar</button>
          <button type="button" class="danger" onclick="deleteRow('${row.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function render() {
  const rows = getFilteredRows();
  renderStats(rows);
  renderTable(rows);
}

async function loadRows() {
  const { data, error } = await supabaseClient
    .from('oficios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Erro ao carregar registros.');
    console.error(error);
    return;
  }

  allRows = (data || []).map(enrichRow);
  fillStatusFilter(allRows);
  render();
}

function formData() {
  return {
    numero_oficio: document.getElementById('numero_oficio').value.trim(),
    unidade: document.getElementById('unidade').value.trim(),
    classe: document.getElementById('classe').value.trim(),
    recebido: document.getElementById('recebido').value || null,
    data_recebimento: document.getElementById('data_recebimento').value || null,
    prazo_resposta_dias: document.getElementById('prazo_resposta_dias').value
      ? Number(document.getElementById('prazo_resposta_dias').value)
      : null,
    data_limite_resposta: document.getElementById('data_limite_resposta').value || null,
    respondido: document.getElementById('respondido').value || null,
    data_resposta: document.getElementById('data_resposta').value || null,
    observacoes: document.getElementById('observacoes').value.trim(),
    origem_arquivo: document.getElementById('origem_arquivo').value.trim(),
  };
}

function resetForm() {
  els.form.reset();
  els.recordId.value = '';
  els.editingBadge.classList.add('hidden');
}

function fillForm(row) {
  els.recordId.value = row.id;
  document.getElementById('numero_oficio').value = row.numero_oficio || '';
  document.getElementById('unidade').value = row.unidade || '';
  document.getElementById('classe').value = row.classe || '';
  document.getElementById('recebido').value = row.recebido || '';
  document.getElementById('data_recebimento').value = row.data_recebimento || '';
  document.getElementById('prazo_resposta_dias').value = row.prazo_resposta_dias ?? '';
  document.getElementById('data_limite_resposta').value = row.data_limite_resposta || '';
  document.getElementById('respondido').value = row.respondido || '';
  document.getElementById('data_resposta').value = row.data_resposta || '';
  document.getElementById('observacoes').value = row.observacoes || '';
  document.getElementById('origem_arquivo').value = row.origem_arquivo || '';
  els.editingBadge.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.editRow = function(id) {
  const row = allRows.find(r => r.id === id);
  if (row) fillForm(row);
};

window.deleteRow = async function(id) {
  if (!currentUser) {
    showToast('Faça login para excluir.');
    return;
  }

  if (!confirm('Deseja excluir este registro?')) return;

  const { error } = await supabaseClient
    .from('oficios')
    .delete()
    .eq('id', id);

  if (error) {
    showToast('Erro ao excluir registro.');
    console.error(error);
    return;
  }

  showToast('Registro excluído.');
  await loadRows();
};

async function saveRecord() {
  if (!currentUser) {
    showToast('Faça login para salvar.');
    return;
  }

  const payload = formData();

  if (!payload.numero_oficio) {
    showToast('Informe o número do ofício.');
    return;
  }

  const id = els.recordId.value;
  let result;

  if (id) {
    result = await supabaseClient
      .from('oficios')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from('oficios')
      .insert(payload)
      .select()
      .single();
  }

  if (result.error) {
    showToast('Erro ao salvar registro.');
    console.error(result.error);
    return;
  }

  showToast(id ? 'Registro atualizado.' : 'Registro criado.');
  resetForm();
  await loadRows();
}

async function login() {
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showToast('Informe email e senha.');
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showToast('Não foi possível entrar.');
    console.error(error);
    return;
  }

  showToast('Login realizado.');
}

async function logout() {
  await supabaseClient.auth.signOut();
  showToast('Sessão encerrada.');
}

async function refreshSession() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data.user || null;

  els.logoutBtn.classList.toggle('hidden', !currentUser);
  els.showLoginBtn.classList.toggle('hidden', !!currentUser);
  els.loginSection.classList.toggle('hidden', !!currentUser);
}

function exportFilteredCsv() {
  const rows = getFilteredRows();
  const headers = [
    'id',
    'numero_oficio',
    'unidade',
    'classe',
    'recebido',
    'data_recebimento',
    'prazo_resposta_dias',
    'data_limite_resposta',
    'respondido',
    'data_resposta',
    'observacoes',
    'origem_arquivo',
    'status_prazo_calculado'
  ];

  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvEscape(row[h] ?? '')).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oficios_exportados.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

els.searchInput.addEventListener('input', render);
els.statusFilter.addEventListener('change', render);
els.recebidoFilter.addEventListener('change', render);
els.respondidoFilter.addEventListener('change', render);
els.saveBtn.addEventListener('click', saveRecord);
els.clearBtn.addEventListener('click', resetForm);
els.refreshBtn.addEventListener('click', loadRows);
els.exportBtn.addEventListener('click', exportFilteredCsv);
els.loginBtn.addEventListener('click', login);
els.logoutBtn.addEventListener('click', logout);
els.showLoginBtn.addEventListener('click', () => {
  els.loginSection.classList.toggle('hidden');
});

supabaseClient.auth.onAuthStateChange(async () => {
  await refreshSession();
  await loadRows();
});

(async function init() {
  await refreshSession();
  await loadRows();
})();
