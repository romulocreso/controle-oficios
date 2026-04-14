const APP_CONFIG = window.APP_CONFIG || {};
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;

let allRows = [];
let currentUser = null;
let isSaving = false;
let isLoadingRows = false;

const els = {
  logoutBtn: document.getElementById('logoutBtn'),
  authStatus: document.getElementById('authStatus'),
  form: document.getElementById('oficioForm'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportBtn: document.getElementById('exportBtn'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  importBtn: document.getElementById('importBtn'),
  csvFileInput: document.getElementById('csvFileInput'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  recebidoFilter: document.getElementById('recebidoFilter'),
  respondidoFilter: document.getElementById('respondidoFilter'),
  tableBody: document.querySelector('#oficiosTable tbody'),
  stats: document.getElementById('stats'),
  toast: document.getElementById('toast'),
  recordId: document.getElementById('recordId'),
  editingBadge: document.getElementById('editingBadge'),
  numeroOficio: document.getElementById('numero_oficio'),
  recebido: document.getElementById('recebido'),
  dataRecebimento: document.getElementById('data_recebimento'),
  prazoDias: document.getElementById('prazo_resposta_dias'),
  dataLimite: document.getElementById('data_limite_resposta'),
  respondido: document.getElementById('respondido'),
  dataResposta: document.getElementById('data_resposta'),
  linkOficio: document.getElementById('link_oficio'),
  observacoes: document.getElementById('observacoes'),
  saveBtn: document.getElementById('saveBtn')
};

function bind(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

function showToast(message) {
  console.log('[toast]', message);
  if (!els.toast) return;
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

  let recebDate = parseDate(row.data_recebimento);
  const respostaDate = parseDate(row.data_resposta);
  const prazoDias = Number(row.prazo_resposta_dias || 0);
  let limite = parseDate(row.data_limite_resposta);

  if (!recebDate && recebido === 'SIM' && row.created_at) {
    const created = new Date(row.created_at);
    if (!isNaN(created.getTime())) {
      created.setHours(0, 0, 0, 0);
      recebDate = created;
    }
  }

  if (!limite && recebDate && prazoDias > 0) {
    limite = addDays(recebDate, prazoDias);
    row.data_limite_resposta = limite.toISOString().slice(0, 10);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (respondido === 'SIM' || respostaDate) return 'RESPONDIDO';
  if (recebido === 'NAO') return 'NAO RECEBIDO';
  if (recebido === 'SIM' && prazoDias > 0 && !recebDate && !limite) return 'AGUARDANDO DATA';
  if (!limite) return 'SEM PRAZO';

  const delta = diffDays(limite, today);
  if (delta < 0) return 'VENCIDO';
  if (delta === 0) return 'VENCE HOJE';
  return 'NO PRAZO';
}

function enrichRow(row) {
  return { ...row, status_prazo_calculado: computeStatus({ ...row }) };
}

function badge(status) {
  return `<span class="badge ${String(status).replaceAll(' ', '\\ ')}">${status}</span>`;
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
  if (!els.statusFilter) return;
  const current = els.statusFilter.value;
  const statuses = [...new Set(rows.map(r => r.status_prazo_calculado))].sort();
  els.statusFilter.innerHTML =
    '<option value="">Todos</option>' +
    statuses.map(s => `<option value="${s}">${s}</option>`).join('');
  els.statusFilter.value = current;
}

function getFilteredRows() {
  const q = (els.searchInput?.value || '').trim().toLowerCase();
  const status = els.statusFilter?.value || '';
  const recebido = els.recebidoFilter?.value || '';
  const respondido = els.respondidoFilter?.value || '';

  return allRows.filter(row => {
    const hay = [row.numero_oficio, row.observacoes, row.link_oficio].join(' ').toLowerCase();
    const matchesText = !q || hay.includes(q);
    const matchesStatus = !status || row.status_prazo_calculado === status;
    const matchesRecebido = !recebido || normalizeText(row.recebido) === recebido;
    const matchesRespondido = !respondido || normalizeText(row.respondido) === respondido;
    return matchesText && matchesStatus && matchesRecebido && matchesRespondido;
  });
}

function getActiveFiltersLabel() {
  const parts = [];

  const busca = (els.searchInput?.value || '').trim();
  const status = els.statusFilter?.value || '';
  const recebido = els.recebidoFilter?.value || '';
  const respondido = els.respondidoFilter?.value || '';

  if (busca) parts.push(`Busca: ${busca}`);
  if (status) parts.push(`Status: ${status}`);
  if (recebido) parts.push(`Recebido: ${recebido}`);
  if (respondido) parts.push(`Respondido: ${respondido}`);

  return parts.length ? parts.join(' | ') : 'Sem filtros aplicados';
}

function renderStats(rows) {
  if (!els.stats) return;

  const stats = {
    total: rows.length,
    recebidos: rows.filter(r => normalizeText(r.recebido) === 'SIM').length,
    naoRecebidos: rows.filter(r => normalizeText(r.recebido) === 'NAO').length,
    vencidos: rows.filter(r => r.status_prazo_calculado === 'VENCIDO').length,
    noPrazo: rows.filter(r => r.status_prazo_calculado === 'NO PRAZO').length,
    venceHoje: rows.filter(r => r.status_prazo_calculado === 'VENCE HOJE').length,
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

  const summaryTotal = document.getElementById('summaryTotal');
  const summaryNoPrazo = document.getElementById('summaryNoPrazo');
  const summaryVenceHoje = document.getElementById('summaryVenceHoje');
  const summaryVencidos = document.getElementById('summaryVencidos');

  if (summaryTotal) summaryTotal.textContent = stats.total;
  if (summaryNoPrazo) summaryNoPrazo.textContent = stats.noPrazo;
  if (summaryVenceHoje) summaryVenceHoje.textContent = stats.venceHoje;
  if (summaryVencidos) summaryVencidos.textContent = stats.vencidos;
}

function renderTable(rows) {
  if (!els.tableBody) return;

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
        ${row.link_oficio
          ? `<a href="${escapeHtml(row.link_oficio)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Abrir</a>`
          : ''
        }
      </td>
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

async function loadRows(force = false) {
  if (!currentUser) {
    allRows = [];
    render();
    return;
  }

  if (isLoadingRows && !force) return;

  isLoadingRows = true;

  try {
    const result = await supabaseClient
      .from('oficios')
      .select('*')
      .order('created_at', { ascending: false });

    if (result.error) {
      showToast(`Erro ao carregar: ${result.error.message}`);
      console.error('[loadRows] error', result.error);
      return;
    }

    allRows = (result.data || []).map(enrichRow);
    fillStatusFilter(allRows);
    render();
  } catch (err) {
    showToast(`Erro ao carregar: ${err.message || err}`);
    console.error('[loadRows] catch', err);
  } finally {
    isLoadingRows = false;
  }
}

function autoFillDeadline() {
  if (!els.dataRecebimento || !els.prazoDias || !els.dataLimite) return;

  const dataRecebimento = els.dataRecebimento.value;
  const prazo = Number(els.prazoDias.value || 0);

  if (!dataRecebimento || !(prazo > 0)) return;

  const base = parseDate(dataRecebimento);
  if (!base) return;

  els.dataLimite.value = addDays(base, prazo).toISOString().slice(0, 10);
}

function formData() {
  let dataLimite = els.dataLimite?.value || null;

  if (!dataLimite && els.dataRecebimento?.value && els.prazoDias?.value) {
    const base = parseDate(els.dataRecebimento.value);
    const prazo = Number(els.prazoDias.value || 0);
    if (base && prazo > 0) {
      dataLimite = addDays(base, prazo).toISOString().slice(0, 10);
    }
  }

  return {
    numero_oficio: els.numeroOficio?.value.trim() || null,
    recebido: els.recebido?.value || null,
    data_recebimento: els.dataRecebimento?.value || null,
    prazo_resposta_dias: els.prazoDias?.value ? Number(els.prazoDias.value) : null,
    data_limite_resposta: dataLimite,
    respondido: els.respondido?.value || null,
    data_resposta: els.dataResposta?.value || null,
    link_oficio: els.linkOficio?.value.trim() || null,
    observacoes: els.observacoes?.value.trim() || null,
  };
}

function resetForm() {
  if (els.form) els.form.reset();
  if (els.recordId) els.recordId.value = '';
  if (els.editingBadge) els.editingBadge.classList.add('hidden');
}

function setSavingState(saving) {
  isSaving = saving;
  if (els.saveBtn) {
    els.saveBtn.disabled = saving;
    els.saveBtn.textContent = saving ? 'Salvando...' : 'Salvar Registro';
  }
}

function fillForm(row) {
  if (els.recordId) els.recordId.value = row.id;
  if (els.numeroOficio) els.numeroOficio.value = row.numero_oficio || '';
  if (els.recebido) els.recebido.value = row.recebido || '';
  if (els.dataRecebimento) els.dataRecebimento.value = row.data_recebimento || '';
  if (els.prazoDias) els.prazoDias.value = row.prazo_resposta_dias ?? '';
  if (els.dataLimite) els.dataLimite.value = row.data_limite_resposta || '';
  if (els.respondido) els.respondido.value = row.respondido || '';
  if (els.dataResposta) els.dataResposta.value = row.data_resposta || '';
  if (els.linkOficio) els.linkOficio.value = row.link_oficio || '';
  if (els.observacoes) els.observacoes.value = row.observacoes || '';
  if (els.editingBadge) els.editingBadge.classList.remove('hidden');
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

  try {
    const result = await supabaseClient
      .from('oficios')
      .delete()
      .eq('id', id);

    if (result.error) {
      showToast(`Erro ao excluir: ${result.error.message}`);
      console.error('[deleteRow]', result.error);
      return;
    }

    showToast('Registro excluído.');
    await loadRows(true);
  } catch (err) {
    showToast(`Erro ao excluir: ${err.message || err}`);
    console.error('[deleteRow] catch', err);
  }
};

async function saveRecord() {
  if (isSaving) return;

  if (!currentUser) {
    showToast('Faça login para salvar.');
    return;
  }

  const payload = formData();

  if (!payload.numero_oficio) {
    showToast('Informe o número do ofício.');
    return;
  }

  setSavingState(true);

  try {
    let result;

    if (els.recordId?.value) {
      result = await supabaseClient
        .from('oficios')
        .update(payload)
        .eq('id', els.recordId.value);
    } else {
      result = await supabaseClient
        .from('oficios')
        .insert([payload]);
    }

    if (result.error) {
      showToast(`Erro ao salvar: ${result.error.message}`);
      console.error('[saveRecord] error', result.error);
      return;
    }

    showToast(els.recordId?.value ? 'Registro atualizado.' : 'Registro criado.');
    resetForm();
    await loadRows(true);
  } catch (err) {
    showToast(`Erro ao salvar: ${err.message || err}`);
    console.error('[saveRecord] catch', err);
  } finally {
    setSavingState(false);
  }
}

async function logout() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      showToast(`Erro ao sair: ${error.message}`);
      console.error('[logout]', error);
      return;
    }

    window.location.href = 'login.html';
  } catch (err) {
    showToast(`Erro ao sair: ${err.message || err}`);
    console.error('[logout] catch', err);
  }
}

async function applyAuthState() {
  if (els.authStatus) {
    els.authStatus.textContent = currentUser?.email
      ? `Conectado como ${currentUser.email}`
      : 'Não autenticado';
  }
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
    'link_oficio',
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

function exportFilteredPdf() {
  const rows = getFilteredRows();

  if (!rows.length) {
    showToast('Não há registros filtrados para gerar PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('l', 'mm', 'a4');

  const titulo = 'Relatório de Ofícios';
  const filtros = getActiveFiltersLabel();
  const dataGeracao = new Date().toLocaleString('pt-BR');

  doc.setFontSize(16);
  doc.text(titulo, 14, 14);

  doc.setFontSize(10);
  doc.text(`Emitido em: ${dataGeracao}`, 14, 22);
  doc.text(`Filtros: ${filtros}`, 14, 28);

  const body = rows.map(row => [
    row.numero_oficio || '',
    row.recebido || '',
    formatDate(row.data_recebimento),
    row.prazo_resposta_dias ?? '',
    formatDate(row.data_limite_resposta),
    row.respondido || '',
    row.status_prazo_calculado || '',
    row.observacoes || '',
    row.link_oficio || ''
  ]);

  doc.autoTable({
    startY: 34,
    head: [[
      'Número',
      'Recebido',
      'Recebimento',
      'Prazo',
      'Data Limite',
      'Respondido',
      'Status',
      'Observações',
      'Link'
    ]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [33, 100, 216]
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { cellWidth: 14 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 },
      7: { cellWidth: 55 },
      8: { cellWidth: 70 }
    },
    didDrawPage: function (data) {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      doc.setFontSize(9);
      doc.text(`Total de registros: ${rows.length}`, 14, pageHeight - 8);
    }
  });

  const nomeArquivo = `relatorio_oficios_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nomeArquivo);
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
    link_oficio: pickValue(row, [
      'link_oficio',
      'link do oficio',
      'link do ofício',
      'link',
      'url'
    ]) || null,
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
    link_oficio: row.link_oficio || null,
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
      row.link_oficio ||
      row.observacoes
    );

  if (!payloads.length) {
    showToast('Nenhum dado aproveitável encontrado no CSV.');
    return;
  }

  try {
    const result = await supabaseClient.from('oficios').insert(payloads);

    if (result.error) {
      showToast(`Erro ao importar CSV: ${result.error.message}`);
      console.error('[importCsvFile]', result.error);
      return;
    }

    showToast(`${payloads.length} registro(s) importado(s).`);
    await loadRows(true);
  } catch (err) {
    showToast(`Erro ao importar CSV: ${err.message || err}`);
    console.error('[importCsvFile] catch', err);
  }
}

bind(els.searchInput, 'input', render);
bind(els.statusFilter, 'change', render);
bind(els.recebidoFilter, 'change', render);
bind(els.respondidoFilter, 'change', render);
bind(els.refreshBtn, 'click', () => loadRows(true));
bind(els.exportBtn, 'click', exportFilteredCsv);
bind(els.exportPdfBtn, 'click', exportFilteredPdf);
bind(els.importBtn, 'click', () => {
  els.csvFileInput?.click();
});
bind(els.csvFileInput, 'change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await importCsvFile(file);
  event.target.value = '';
});
bind(els.dataRecebimento, 'change', autoFillDeadline);
bind(els.prazoDias, 'input', autoFillDeadline);

window.logout = logout;
window.saveRecord = saveRecord;
window.resetForm = resetForm;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user || null;

  if (!currentUser && event === 'SIGNED_OUT') {
    window.location.href = 'login.html';
    return;
  }

  await applyAuthState();
});

(async function init() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    currentUser = data?.session?.user || null;
  } catch (err) {
    console.error('[init] getSession catch', err);
  }

  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  await applyAuthState();
  await loadRows(true);
})();
