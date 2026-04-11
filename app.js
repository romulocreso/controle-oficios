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
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  recebidoFilter: document.getElementById('recebidoFilter'),
  respondidoFilter: document.getElementById('respondidoFilter'),
  tableBody: document.querySelector('#oficiosTable tbody'),
  stats: document.getElementById('stats'),
  toast: document.getElementById('toast'),
  recordId: document.getElementById('recordId'),
  editingBadge: document.getElementById('editingBadge'),
  form: document.getElementById('oficioForm'),
  csvFileInput: document.getElementById('csvFileInput'),

  numeroOficio: document.getElementById('numero_oficio'),
  recebido: document.getElementById('recebido'),
  dataRecebimento: document.getElementById('data_recebimento'),
  prazoDias: document.getElementById('prazo_resposta_dias'),
  dataLimite: document.getElementById('data_limite_resposta'),
  respondido: document.getElementById('respondido'),
  dataResposta: document.getElementById('data_resposta'),
  observacoes: document.getElementById('observacoes')
};

function showToast(message) {
  console.log('[toast]', message);
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 5000);
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
  els.statusFilter.innerHTML =
    '<option value="">Todos</option>' +
    statuses.map(s => `<option value="${s}">${s}</option>`).join('');
  els.statusFilter.value = current;
}

function getFilteredRows() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const recebido = els.recebidoFilter.value;
  const respondido = els.respondidoFilter.value;

  return allRows.filter(row => {
    const hay = [row.numero_oficio, row.observacoes].join(' ').toLowerCase();
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
      <td>${escapeHtml(row.numero_oficio || '')}</td>
      <td>${escapeHtml(row.recebido || '')}</td>
      <td>${escapeHtml(formatDate(row.data_recebimento))}</td>
      <td>${escapeHtml(row.prazo_resposta_dias || '')}</td>
      <td>${escapeHtml(formatDate(row.data_limite_resposta))}</td>
      <td>${escapeHtml(row.respondido || '')}</td>
      <td>${badge(row.status_prazo_calculado)}</td>
      <td>${escapeHtml(row.observacoes || '')}</td>
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
  console.log('[loadRows] início');
  const { data, error } = await supabaseClient
    .from('oficios')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast(`Erro ao carregar: ${error.message}`);
    console.error('[loadRows] error', error);
    return;
  }

  console.log('[loadRows] data', data);
  allRows = (data || []).map(enrichRow);
  fillStatusFilter(allRows);
  render();
}

function autoFillDeadline() {
  const dataRecebimento = els.dataRecebimento.value;
  const prazo = Number(els.prazoDias.value || 0);

  if (!dataRecebimento || !(prazo > 0)) return;

  const base = parseDate(dataRecebimento);
  if (!base) return;

  els.dataLimite.value = addDays(base, prazo).toISOString().slice(0, 10);
}

function formData() {
  let dataLimite = els.dataLimite.value || null;

  if (!dataLimite && els.dataRecebimento.value && els.prazoDias.value) {
    const base = parseDate(els.dataRecebimento.value);
    const prazo = Number(els.prazoDias.value || 0);
    if (base && prazo > 0) {
      dataLimite = addDays(base, prazo).toISOString().slice(0, 10);
    }
  }

  return {
    numero_oficio: els.numeroOficio.value.trim() || null,
    recebido: els.recebido.value || null,
    data_recebimento: els.dataRecebimento.value || null,
    prazo_resposta_dias: els.prazoDias.value ? Number(els.prazoDias.value) : null,
    data_limite_resposta: dataLimite,
    respondido: els.respondido.value || null,
    data_resposta: els.dataResposta.value || null,
    observacoes: els.observacoes.value.trim() || null,
  };
}

function resetForm() {
  els.form.reset();
  els.recordId.value = '';
  els.editingBadge.classList.add('hidden');
}

function fillForm(row) {
  els.recordId.value = row.id;
  els.numeroOficio.value = row.numero_oficio || '';
  els.recebido.value = row.recebido || '';
  els.dataRecebimento.value = row.data_recebimento || '';
  els.prazoDias.value = row.prazo_resposta_dias ?? '';
  els.dataLimite.value = row.data_limite_resposta || '';
  els.respondido.value = row.respondido || '';
  els.dataResposta.value = row.data_resposta || '';
  els.observacoes.value = row.observacoes || '';
  els.editingBadge.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.editRow = function(id) {
  const row = allRows.find(r => r.id === id);
  if (row) fillForm(row);
};

window.deleteRow = async function(id) {
  const sessionResult = await supabaseClient.auth.getSession();
  currentUser = sessionResult?.data?.session?.user || null;

  if (!currentUser) {
    showToast('Faça login para excluir.');
    return;
  }

  if (!confirm('Deseja excluir este registro?')) return;

  const { error } = await supabaseClient.from('oficios').delete().eq('id', id);

  if (error) {
    showToast(`Erro ao excluir: ${error.message}`);
    console.error('[deleteRow]', error);
    return;
  }

  showToast('Registro excluído.');
  await loadRows();
};

async function saveRecord() {
  console.log('[saveRecord] clique detectado');

  try {
    const sessionResult = await supabaseClient.auth.getSession();
    console.log('[saveRecord] sessionResult', sessionResult);

    currentUser = sessionResult?.data?.session?.user || null;
    console.log('[saveRecord] currentUser', currentUser);

    if (!currentUser) {
      showToast('Faça login para salvar.');
      return;
    }

    const payload = formData();
    console.log('[saveRecord] payload', payload);

    if (!payload.numero_oficio) {
      showToast('Informe o número do ofício.');
      return;
    }

    let result;
    const id = els.recordId.value;

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

    console.log('[saveRecord] result', result);

    if (result.error) {
      showToast(`Erro ao salvar: ${result.error.message}`);
      console.error('[saveRecord] result.error', result.error);
      return;
    }

    showToast(id ? 'Registro atualizado.' : 'Registro criado.');
    resetForm();
    await loadRows();
  } catch (err) {
    showToast(`Erro inesperado ao salvar: ${err.message || err}`);
    console.error('[saveRecord] catch', err);
  }
}

async function login() {
  console.log('[login] clique detectado');

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

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
      console.error('[login]', error);
      return;
    }

    currentUser = data?.user || data?.session?.user || null;
    await refreshSession();
    await loadRows();
    showToast('Login realizado.');
  } catch (err) {
    showToast(`Erro inesperado no login: ${err.message || err}`);
    console.error('[login] catch', err);
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  showToast('Sessão encerrada.');
  await refreshSession();
}

async function refreshSession() {
  const { data } = await supabaseClient.auth.getSession();
  currentUser = data?.session?.user || null;
  console.log('[refreshSession] currentUser', currentUser);

  els.logoutBtn.classList.toggle('hidden', !currentUser);
  els.showLoginBtn.classList.toggle('hidden', !!currentUser);
  els.loginSection.classList.toggle('hidden', !!currentUser);
}

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

function exportFilteredCsv() {
  const rows = getFilteredRows();
  const headers = [
    'id',
    'numero_oficio',
    'recebido',
    'data_recebimento',
    'prazo_resposta_dias',
    'data_limite_resposta',
    'respondido',
    'data_resposta',
    'observacoes',
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

function normalizeHeader(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function csvToObjects(text) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (value !== '' || row.length) {
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
      }
    } else {
      value += char;
    }
  }

  if (value !== '' || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(h => normalizeHeader(h.replace(/^\uFEFF/, '')));

  return rows
    .filter(cols => cols.some(c => String(c || '').trim() !== ''))
    .map(cols => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (cols[idx] || '').trim();
      });
      return obj;
    });
}

function pickValue(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function normalizeDateToISO(value) {
  if (!value) return null;
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

function normalizeImportedRow(row) {
  return {
    numero_oficio: pickValue(row, [
      'numero_oficio',
      'numero do oficio',
      'número do ofício',
      'numero',
      'número',
      'oficio',
      'ofício',
      'n_oficio'
    ]) || null,
    recebido: normalizeText(pickValue(row, ['recebido'])) || null,
    data_recebimento: normalizeDateToISO(pickValue(row, [
      'data_recebimento',
      'recebimento',
      'data de recebimento'
    ])) || null,
    prazo_resposta_dias: (() => {
      const v = pickValue(row, ['prazo_resposta_dias', 'prazo', 'prazo dias', 'dias']);
      return v ? Number(String(v).replace(/[^\d-]/g, '')) : null;
    })(),
    data_limite_resposta: normalizeDateToISO(pickValue(row, [
      'data_limite_resposta',
      'data_limite',
      'data limite'
    ])) || null,
    respondido: normalizeText(pickValue(row, ['respondido'])) || null,
    data_resposta: normalizeDateToISO(pickValue(row, [
      'data_resposta',
      'resposta',
      'data da resposta'
    ])) || null,
    observacoes: pickValue(row, [
      'observacoes',
      'observação',
      'observacao',
      'observações',
      'obs'
    ]) || null,
  };
}

function cleanImportedPayload(row) {
  const payload = {
    numero_oficio: row.numero_oficio || null,
    recebido: row.recebido || null,
    data_recebimento: row.data_recebimento || null,
    prazo_resposta_dias: Number.isFinite(row.prazo_resposta_dias) ? row.prazo_resposta_dias : null,
    data_limite_resposta: row.data_limite_resposta || null,
    respondido: row.respondido || null,
    data_resposta: row.data_resposta || null,
    observacoes: row.observacoes || null,
  };

  if (!payload.data_limite_resposta && payload.data_recebimento && payload.prazo_resposta_dias > 0) {
    const base = parseDate(payload.data_recebimento);
    if (base) {
      payload.data_limite_resposta = addDays(base, payload.prazo_resposta_dias)
        .toISOString()
        .slice(0, 10);
    }
  }

  return payload;
}

async function importCsvFile(file) {
  const sessionResult = await supabaseClient.auth.getSession();
  currentUser = sessionResult?.data?.session?.user || null;

  if (!currentUser) {
    showToast('Faça login para importar.');
    return;
  }

  const text = await file.text();
  const parsedRows = csvToObjects(text);

  if (!parsedRows.length) {
    showToast('CSV vazio ou inválido.');
    return;
  }

  const payloads = parsedRows
    .map(normalizeImportedRow)
    .map(cleanImportedPayload)
    .filter(row =>
      row.numero_oficio ||
      row.data_recebimento ||
      row.prazo_resposta_dias ||
      row.data_limite_resposta ||
      row.observacoes
    );

  if (!payloads.length) {
    showToast('Nenhum dado aproveitável encontrado no CSV.');
    return;
  }

  const { error } = await supabaseClient.from('oficios').insert(payloads);

  if (error) {
    showToast(`Erro ao importar CSV: ${error.message}`);
    console.error('[importCsvFile]', error);
    return;
  }

  showToast(`${payloads.length} registro(s) importado(s).`);
  await loadRows();
}

els.searchInput.addEventListener('input', render);
els.statusFilter.addEventListener('change', render);
els.recebidoFilter.addEventListener('change', render);
els.respondidoFilter.addEventListener('change', render);
els.refreshBtn.addEventListener('click', loadRows);
els.exportBtn.addEventListener('click', exportFilteredCsv);
els.logoutBtn.addEventListener('click', logout);
els.showLoginBtn.addEventListener('click', () => {
  els.loginSection.classList.toggle('hidden');
});
els.importBtn.addEventListener('click', () => {
  els.csvFileInput.click();
});
els.csvFileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await importCsvFile(file);
  event.target.value = '';
});
els.dataRecebimento.addEventListener('change', autoFillDeadline);
els.prazoDias.addEventListener('input', autoFillDeadline);

window.login = login;
window.saveRecord = saveRecord;
window.resetForm = resetForm;

supabaseClient.auth.onAuthStateChange(async () => {
  console.log('[onAuthStateChange]');
  await refreshSession();
  await loadRows();
});

(async function init() {
  console.log('[init]');
  await refreshSession();
  await loadRows();
})();
