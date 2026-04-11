
let allRows = [];

async function loadCsv() {
  const response = await fetch('./oficios_unificados.csv?_=' + Date.now());
  const text = await response.text();
  allRows = csvToObjects(text).map(enrichRow);
  fillStatusFilter(allRows);
  render();
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

  const headers = rows.shift().map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.map(cols => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] || '').trim());
    return obj;
  });
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

function enrichRow(row) {
  const recebido = normalizeText(row.recebido);
  const respondido = normalizeText(row.respondido);
  const recebDate = parseDate(row.data_recebimento);
  const respostaDate = parseDate(row.data_resposta);
  const prazoDias = Number(row.prazo_resposta_dias || 0);
  let limite = parseDate(row.data_limite_resposta);

  if (!limite && recebDate && prazoDias > 0) {
    limite = addDays(recebDate, prazoDias);
    row.data_limite_resposta = limite.toISOString().slice(0,10);
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  let status = 'PENDENTE DE DADOS';
  if (respondido === 'SIM' || respostaDate) {
    status = 'RESPONDIDO';
  } else if (recebido === 'NAO') {
    status = 'NÃO RECEBIDO';
  } else if (!limite) {
    status = (recebido === 'SIM' || recebDate) ? 'SEM PRAZO' : 'PENDENTE DE DADOS';
  } else {
    const delta = diffDays(limite, today);
    if (delta < 0) status = 'VENCIDO';
    else if (delta === 0) status = 'VENCE HOJE';
    else status = 'NO PRAZO';
  }

  return { ...row, status_prazo_calculado: status };
}

function fillStatusFilter(rows) {
  const filter = document.getElementById('statusFilter');
  const current = filter.value;
  const statuses = [...new Set(rows.map(r => r.status_prazo_calculado))].sort();
  filter.innerHTML = '<option value="">Todos os status</option>' +
    statuses.map(s => `<option value="${s}">${s}</option>`).join('');
  filter.value = current;
}

function getFilteredRows() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const recebido = document.getElementById('recebidoFilter').value;

  return allRows.filter(row => {
    const hay = [
      row.numero_oficio, row.unidade, row.classe, row.observacoes, row.origem_arquivo
    ].join(' ').toLowerCase();

    const matchesText = !q || hay.includes(q);
    const matchesStatus = !status || row.status_prazo_calculado === status;
    const matchesRecebido = !recebido || normalizeText(row.recebido) === recebido;
    return matchesText && matchesStatus && matchesRecebido;
  });
}

function renderStats(rows) {
  const stats = {
    total: rows.length,
    recebidos: rows.filter(r => normalizeText(r.recebido) === 'SIM').length,
    naoRecebidos: rows.filter(r => normalizeText(r.recebido) === 'NAO').length,
    vencidos: rows.filter(r => r.status_prazo_calculado === 'VENCIDO').length,
    noPrazo: rows.filter(r => r.status_prazo_calculado === 'NO PRAZO').length,
    respondidos: rows.filter(r => r.status_prazo_calculado === 'RESPONDIDO').length,
  };

  document.getElementById('stats').innerHTML = `
    <div class="stat">Total<strong>${stats.total}</strong></div>
    <div class="stat">Recebidos<strong>${stats.recebidos}</strong></div>
    <div class="stat">Não recebidos<strong>${stats.naoRecebidos}</strong></div>
    <div class="stat">No prazo<strong>${stats.noPrazo}</strong></div>
    <div class="stat">Vencidos<strong>${stats.vencidos}</strong></div>
    <div class="stat">Respondidos<strong>${stats.respondidos}</strong></div>
  `;
}

function badge(status) {
  return `<span class="badge ${status.replaceAll(' ', '\\ ')}">${status}</span>`;
}

function renderTable(rows) {
  const tbody = document.querySelector('#oficiosTable tbody');
  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.numero_oficio)}</td>
      <td>${escapeHtml(row.unidade)}</td>
      <td>${escapeHtml(row.classe)}</td>
      <td>${escapeHtml(row.recebido || '')}</td>
      <td>${escapeHtml(formatDate(row.data_recebimento))}</td>
      <td>${escapeHtml(row.prazo_resposta_dias || '')}</td>
      <td>${escapeHtml(formatDate(row.data_limite_resposta))}</td>
      <td>${escapeHtml(row.respondido || '')}</td>
      <td>${badge(row.status_prazo_calculado)}</td>
      <td>${escapeHtml(row.observacoes || '')}</td>
      <td>${escapeHtml(row.origem_arquivo || '')}</td>
    </tr>
  `).join('');
}

function escapeHtml(value) {
  return (value || '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const rows = getFilteredRows();
  renderStats(rows);
  renderTable(rows);
}

function exportFilteredCsv() {
  const rows = getFilteredRows();
  const headers = [
    'id_registro','origem_arquivo','numero_oficio','unidade','classe','recebido',
    'data_recebimento','prazo_resposta_dias','data_limite_resposta','respondido',
    'data_resposta','status_prazo_calculado','observacoes'
  ];
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvEscape(row[h] || '')).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oficios_filtrados.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('statusFilter').addEventListener('change', render);
document.getElementById('recebidoFilter').addEventListener('change', render);
document.getElementById('reloadBtn').addEventListener('click', loadCsv);
document.getElementById('exportBtn').addEventListener('click', exportFilteredCsv);

loadCsv();
