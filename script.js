/**
 * ================================================================
 * SENTINEL PRO — Sistema de Telemetria IoT
 * script.js — Vanilla JS, ES6+
 * ================================================================
 */

// ——————————————————————————————
// 1. CLASSE SENSOR (OOP)
// ——————————————————————————————

class Sensor {
  constructor(nome, tipo, valor) {
    this.id    = crypto.randomUUID();
    this.nome  = nome.trim().toUpperCase();
    this.tipo  = tipo;
    this.valor = parseFloat(valor);
    this.criadoEm = new Date().toISOString();
  }

  /**
   * Retorna o status do sensor com base no tipo e valor.
   * @returns {'NORMAL'|'CRÍTICO'}
   */
  obterStatus() {
    const v = this.valor;

    if (this.tipo === 'Temperatura') {
      return v <= 50 ? 'NORMAL' : 'CRÍTICO';
    }

    if (this.tipo === 'Pressão') {
      return v <= 100 ? 'NORMAL' : 'CRÍTICO';
    }

    if (this.tipo === 'Umidade') {
      return (v >= 30 && v <= 80) ? 'NORMAL' : 'CRÍTICO';
    }

    return 'NORMAL';
  }

  /** Retorna a unidade de medida do sensor */
  obterUnidade() {
    const unidades = {
      'Temperatura': '°C',
      'Pressão':     'kPa',
      'Umidade':     '%',
    };
    return unidades[this.tipo] || '';
  }

  /** Retorna o emoji/ícone representativo */
  obterIcone() {
    const icones = {
      'Temperatura': '🌡️',
      'Pressão':     '⚙️',
      'Umidade':     '💧',
    };
    return icones[this.tipo] || '◉';
  }
}

// ——————————————————————————————
// 2. ESTADO GLOBAL
// ——————————————————————————————

let sensores   = [];        // Array principal de sensores
let grafico    = null;      // Referência do Chart.js
let filtroAtivo = 'todos';  // Filtro ativo no momento

// ——————————————————————————————
// 3. LOCALSTORAGE — Persistência
// ——————————————————————————————

/**
 * Salva o array de sensores no LocalStorage.
 */
function salvarSensores() {
  localStorage.setItem('sentinelPro_sensores', JSON.stringify(sensores));
}

/**
 * Carrega sensores do LocalStorage e reconstrói instâncias da classe Sensor.
 */
function carregarSensores() {
  const dados = localStorage.getItem('sentinelPro_sensores');
  if (!dados) return;

  const parsed = JSON.parse(dados);

  // Reconstrói instâncias da classe Sensor (métodos perdidos na serialização)
  sensores = parsed.map(obj => {
    const s = new Sensor(obj.nome, obj.tipo, obj.valor);
    s.id        = obj.id;
    s.criadoEm  = obj.criadoEm;
    return s;
  });
}

// ——————————————————————————————
// 4. DADOS DE TESTE
// ——————————————————————————————

/**
 * Carrega os sensores de teste predefinidos.
 */
function carregarDadosDeTeste() {
  const dadosTeste = [
    { nome: 'Termopar Tipo Forno 01',                   tipo: 'Temperatura', valor: 450 },
    { nome: 'Transmissor Pressão Diferencial Tub A2',   tipo: 'Pressão',     valor: 120 },
    { nome: 'Higrômetro Digital Almoxarifado Químico',  tipo: 'Umidade',     valor: 25  },
    { nome: 'Motor Principal Linha A',                  tipo: 'Temperatura', valor: 35  },
    { nome: 'Tanque Secundário',                        tipo: 'Pressão',     valor: 80  },
  ];

  let adicionados = 0;

  dadosTeste.forEach(d => {
    const novo = new Sensor(d.nome, d.tipo, d.valor);
    sensores.push(novo);
    adicionados++;
  });

  salvarSensores();
  renderizarTudo();
  exibirToast(`${adicionados} sensores de teste carregados com sucesso!`, 'info');
}

// ——————————————————————————————
// 5. RENDERIZAÇÃO DE CARDS
// ——————————————————————————————

/**
 * Gera o HTML de um card de sensor.
 * @param {Sensor} sensor
 * @returns {string} HTML do card
 */
function criarCardHTML(sensor) {
  const status = sensor.obterStatus();
  const classeStatus = status === 'CRÍTICO' ? 'critico' : 'normal';
  const badgeHTML = status === 'CRÍTICO'
    ? `<span class="badge-critico">CRÍTICO</span>`
    : `<span class="badge-normal">NORMAL</span>`;

  return `
    <div class="sensor-card ${classeStatus}" data-id="${sensor.id}" data-tipo="${sensor.tipo}">
      <div class="sensor-card-header">
        <div class="sensor-icon-wrap">${sensor.obterIcone()}</div>
        ${badgeHTML}
      </div>
      <div class="sensor-name">${sensor.nome}</div>
      <div class="sensor-type">${sensor.tipo}</div>
      <div class="sensor-value-row">
        <span class="sensor-value-num">${sensor.valor}</span>
        <span class="sensor-value-unit">${sensor.obterUnidade()}</span>
      </div>
      <div class="sensor-actions">
        <button
          class="btn-remove"
          title="Remover sensor"
          onclick="removerSensor('${sensor.id}')"
        >✕</button>
      </div>
    </div>
  `;
}

/**
 * Filtra sensores conforme o filtro ativo e renderiza no grid.
 */
function renderizarSensores() {
  const grid       = document.getElementById('sensorGrid');
  const emptyState = document.getElementById('emptyState');

  // Aplica filtro usando filter()
  let lista = sensores;

  if (filtroAtivo === 'todos') {
    lista = sensores;
  } else if (filtroAtivo === 'CRÍTICO') {
    lista = sensores.filter(s => s.obterStatus() === 'CRÍTICO');
  } else {
    lista = sensores.filter(s => s.tipo === filtroAtivo);
  }

  if (lista.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  // Usa forEach() para construir o HTML
  let html = '';
  lista.forEach(sensor => {
    html += criarCardHTML(sensor);
  });

  grid.innerHTML = html;
}

// ——————————————————————————————
// 6. ESTATÍSTICAS (filter + reduce)
// ——————————————————————————————

/**
 * Calcula a média de valores de um subconjunto de sensores.
 * @param {string} tipo
 * @returns {number|null}
 */
function calcularMedia(tipo) {
  const lista = sensores.filter(s => s.tipo === tipo);
  if (lista.length === 0) return null;
  const soma = lista.reduce((acc, s) => acc + s.valor, 0);
  return Math.round((soma / lista.length) * 10) / 10;
}

/**
 * Atualiza o painel de estatísticas.
 */
function atualizarEstatisticas() {
  const total    = sensores.length;
  const criticos = sensores.filter(s => s.obterStatus() === 'CRÍTICO').length;

  const avgTemp = calcularMedia('Temperatura');
  const avgPres = calcularMedia('Pressão');
  const avgUmi  = calcularMedia('Umidade');

  // Atualiza elementos DOM
  document.getElementById('totalSensores').textContent = total;
  document.getElementById('totalCriticos').textContent = criticos;
  document.getElementById('avgTemp').textContent = avgTemp !== null ? avgTemp : '—';
  document.getElementById('avgPres').textContent = avgPres !== null ? avgPres : '—';
  document.getElementById('avgUmi').textContent  = avgUmi  !== null ? avgUmi  : '—';

  // Barras de progresso (relativas ao limite crítico)
  const tempPct = avgTemp !== null ? Math.min((avgTemp / 80)  * 100, 100) : 0;
  const presPct = avgPres !== null ? Math.min((avgPres / 150) * 100, 100) : 0;
  const umiPct  = avgUmi  !== null ? Math.min((avgUmi  / 100) * 100, 100) : 0;
  const critPct = total   > 0      ? (criticos / total) * 100 : 0;

  document.getElementById('tempBar').style.width  = `${tempPct}%`;
  document.getElementById('presBar').style.width  = `${presPct}%`;
  document.getElementById('umiBar').style.width   = `${umiPct}%`;
  document.getElementById('critBar').style.width  = `${critPct}%`;

  // Badge de alertas na topbar
  const alertBadge = document.getElementById('alertBadge');
  const alertCount = document.getElementById('alertCount');
  if (criticos > 0) {
    alertBadge.style.display = 'flex';
    alertCount.textContent = criticos;
  } else {
    alertBadge.style.display = 'none';
  }
}

// ——————————————————————————————
// 7. CHART.JS — Gráfico de barras
// ——————————————————————————————

/**
 * Inicializa ou atualiza o gráfico de médias operacionais.
 */
function atualizarGrafico() {
  const avgTemp = calcularMedia('Temperatura') ?? 0;
  const avgPres = calcularMedia('Pressão')    ?? 0;
  const avgUmi  = calcularMedia('Umidade')    ?? 0;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const labelColor  = isDark ? '#7a92c4' : '#3a5280';
  const tooltipBg   = isDark ? '#141d35' : '#ffffff';
  const tooltipText = isDark ? '#e8f0ff' : '#0d1a3a';

  const config = {
    type: 'bar',
    data: {
      labels: ['Temperatura (°C)', 'Pressão (kPa)', 'Umidade (%)'],
      datasets: [{
        label: 'Média Operacional',
        data: [avgTemp, avgPres, avgUmi],
        backgroundColor: [
          'rgba(255, 107, 53, 0.75)',
          'rgba(124, 58, 237, 0.75)',
          'rgba(8, 145, 178, 0.75)',
        ],
        borderColor: [
          '#ff6b35',
          '#7c3aed',
          '#0891b2',
        ],
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: 'Médias Operacionais da Planta',
          color: labelColor,
          font: {
            family: "'Rajdhani', sans-serif",
            size: 15,
            weight: '600',
          },
          padding: { bottom: 16 },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: '#1e2d55',
          borderWidth: 1,
          titleColor: tooltipText,
          bodyColor: labelColor,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} ${['°C','kPa','%'][ctx.dataIndex]}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            font: { family: "'Inter', sans-serif", size: 12 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            font: { family: "'Inter', sans-serif", size: 12 },
          },
        },
      },
    },
  };

  const ctx = document.getElementById('operacoesChart').getContext('2d');

  if (grafico) {
    // Atualiza os dados do gráfico existente
    grafico.data.datasets[0].data = [avgTemp, avgPres, avgUmi];
    grafico.update('active');
  } else {
    grafico = new Chart(ctx, config);
  }
}

// ——————————————————————————————
// 8. RENDERIZAÇÃO GERAL
// ——————————————————————————————

/**
 * Renderiza todo o dashboard: cards + estatísticas + gráfico.
 */
function renderizarTudo() {
  renderizarSensores();
  atualizarEstatisticas();
  atualizarGrafico();
}

// ——————————————————————————————
// 9. ADICIONAR / REMOVER SENSOR
// ——————————————————————————————

/**
 * Remove um sensor pelo ID e atualiza a UI.
 * @param {string} id
 */
function removerSensor(id) {
  const idx = sensores.findIndex(s => s.id === id);
  if (idx === -1) return;

  const nome = sensores[idx].nome;
  sensores.splice(idx, 1);
  salvarSensores();
  renderizarTudo();
  exibirToast(`Sensor "${nome}" removido.`, 'error');
}

/**
 * Valida e adiciona um novo sensor via formulário.
 */
function adicionarSensor() {
  const nomeEl  = document.getElementById('nomeSensor');
  const tipoEl  = document.getElementById('tipoSensor');
  const valorEl = document.getElementById('valorSensor');

  let valido = true;

  // Limpa erros anteriores
  [nomeEl, tipoEl, valorEl].forEach(el => el.classList.remove('error'));
  document.getElementById('hintNome').textContent  = '';
  document.getElementById('hintValor').textContent = '';

  const nome  = nomeEl.value.trim();
  const tipo  = tipoEl.value;
  const valor = valorEl.value.trim();

  // Validação de campos
  if (!nome) {
    nomeEl.classList.add('error');
    document.getElementById('hintNome').textContent = 'Informe o nome do sensor.';
    valido = false;
  }

  if (!tipo) {
    tipoEl.classList.add('error');
    valido = false;
  }

  if (!valor || isNaN(Number(valor))) {
    valorEl.classList.add('error');
    document.getElementById('hintValor').textContent = 'Informe um valor numérico válido.';
    valido = false;
  }

  if (!valido) {
    exibirToast('Preencha todos os campos corretamente.', 'error');
    return;
  }

  const novo = new Sensor(nome, tipo, Number(valor));
  sensores.push(novo);
  salvarSensores();
  renderizarTudo();

  const status = novo.obterStatus();
  const msgStatus = status === 'CRÍTICO' ? ' ⚠ Status CRÍTICO detectado!' : '';
  exibirToast(`Sensor "${novo.nome}" adicionado.${msgStatus}`, status === 'CRÍTICO' ? 'error' : 'success');

  // Limpa o formulário
  nomeEl.value  = '';
  tipoEl.value  = '';
  valorEl.value = '';
  nomeEl.focus();
}

// ——————————————————————————————
// 10. VALIDAÇÃO COM EVENTOS DOM
// ——————————————————————————————

/**
 * Configura eventos de validação em tempo real (keyup, blur).
 */
function configurarValidacaoEmTempoReal() {
  const nomeEl  = document.getElementById('nomeSensor');
  const valorEl = document.getElementById('valorSensor');

  // keyup — feedback enquanto digita
  nomeEl.addEventListener('keyup', () => {
    if (nomeEl.value.trim()) {
      nomeEl.classList.remove('error');
      document.getElementById('hintNome').textContent = '';
    }
  });

  valorEl.addEventListener('keyup', () => {
    const v = valorEl.value.trim();
    if (v && !isNaN(Number(v))) {
      valorEl.classList.remove('error');
      document.getElementById('hintValor').textContent = '';
    }
  });

  // onblur — valida ao sair do campo
  nomeEl.onblur = () => {
    if (!nomeEl.value.trim()) {
      nomeEl.classList.add('error');
      document.getElementById('hintNome').textContent = 'Nome é obrigatório.';
    }
  };

  valorEl.onblur = () => {
    const v = valorEl.value.trim();
    if (v && isNaN(Number(v))) {
      valorEl.classList.add('error');
      document.getElementById('hintValor').textContent = 'Digite apenas números.';
    }
  };
}

// ——————————————————————————————
// 11. TOAST NOTIFICATIONS
// ——————————————————————————————

/**
 * Exibe uma notificação toast temporária.
 * @param {string} mensagem
 * @param {'success'|'error'|'info'} tipo
 */
function exibirToast(mensagem, tipo = 'success') {
  const container = document.getElementById('toastContainer');

  const icones = { success: '✓', error: '⚠', info: '◉' };
  const icone  = icones[tipo] || '◉';

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <span class="toast-icon">${icone}</span>
    <span class="toast-msg">${mensagem}</span>
  `;

  container.appendChild(toast);

  // Remove após 4 segundos
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ——————————————————————————————
// 12. RELÓGIO DO SISTEMA
// ——————————————————————————————

/**
 * Atualiza o relógio do sistema a cada segundo.
 */
function iniciarRelogio() {
  const clockEl = document.getElementById('systemClock');

  const atualizar = () => {
    const agora = new Date();
    const hh  = String(agora.getHours()).padStart(2, '0');
    const mm  = String(agora.getMinutes()).padStart(2, '0');
    const ss  = String(agora.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  };

  atualizar();
  setInterval(atualizar, 1000);
}

// ——————————————————————————————
// 13. FILTROS
// ——————————————————————————————

/**
 * Configura as abas de filtro.
 */
function configurarFiltros() {
  const tabs = document.querySelectorAll('.filter-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filtroAtivo = tab.dataset.filter;
      renderizarSensores();
    });
  });
}

// ——————————————————————————————
// 14. TEMA (DARK / LIGHT)
// ——————————————————————————————

/**
 * Alterna entre dark mode e light mode.
 */
function alternarTema() {
  const html    = document.documentElement;
  const atual   = html.getAttribute('data-theme');
  const novoTema = atual === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', novoTema);
  localStorage.setItem('sentinelPro_tema', novoTema);

  const icone  = document.getElementById('themeIcon');
  const label  = document.getElementById('themeLabel');

  icone.textContent = novoTema === 'dark' ? '☽' : '☀';
  label.textContent = novoTema === 'dark' ? 'Modo Claro' : 'Modo Escuro';

  // Reconstrói o gráfico com as novas cores
  if (grafico) {
    grafico.destroy();
    grafico = null;
  }
  atualizarGrafico();
}

/**
 * Aplica o tema salvo no LocalStorage.
 */
function aplicarTemaSalvo() {
  const temaSalvo = localStorage.getItem('sentinelPro_tema') || 'dark';
  document.documentElement.setAttribute('data-theme', temaSalvo);

  const icone  = document.getElementById('themeIcon');
  const label  = document.getElementById('themeLabel');
  icone.textContent = temaSalvo === 'dark' ? '☽' : '☀';
  label.textContent = temaSalvo === 'dark' ? 'Modo Claro' : 'Modo Escuro';
}

// ——————————————————————————————
// 15. NAVEGAÇÃO SIDEBAR
// ——————————————————————————————

/**
 * Configura os links de navegação da sidebar para rolar até a seção correta.
 */
function configurarNavegacao() {
  const navItems = document.querySelectorAll('.nav-item[data-section]');

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();

      const secao = item.dataset.section;

      // Atualiza item ativo
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Mapeia seção → elemento alvo
      const alvos = {
        dashboard: document.getElementById('statsPanel'),
        sensores:  document.getElementById('secaoSensores'),
        graficos:  document.getElementById('secaoGraficos'),
      };

      const alvo = alvos[secao];
      if (alvo) {
        alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ——————————————————————————————
// 16. SIDEBAR TOGGLE
// ——————————————————————————————

/**
 * Configura o botão de recolher/expandir sidebar.
 */
function configurarSidebar() {
  const btn     = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

// ——————————————————————————————
// 16. LIMPAR TODOS
// ——————————————————————————————

/**
 * Remove todos os sensores após confirmação.
 */
function limparTodos() {
  if (sensores.length === 0) {
    exibirToast('Não há sensores para remover.', 'info');
    return;
  }

  const confirmar = window.confirm(`Deseja realmente remover todos os ${sensores.length} sensores? Esta ação não pode ser desfeita.`);
  if (!confirmar) return;

  sensores = [];
  salvarSensores();
  renderizarTudo();
  exibirToast('Todos os sensores foram removidos.', 'info');
}

// ——————————————————————————————
// 17. INICIALIZAÇÃO
// ——————————————————————————————

/**
 * Ponto de entrada principal — executa ao carregar o DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

  // Aplica tema salvo antes de renderizar
  aplicarTemaSalvo();

  // Carrega sensores persistidos
  carregarSensores();

  // Inicializa relógio
  iniciarRelogio();

  // Configura sidebar
  configurarSidebar();

  // Configura navegação da sidebar
  configurarNavegacao();

  // Configura filtros
  configurarFiltros();

  // Configura validação em tempo real
  configurarValidacaoEmTempoReal();

  // Renderiza tudo
  renderizarTudo();

  // ——— EVENTOS ———

  // Formulário — submit (onclick do botão via form.submit)
  const form = document.getElementById('sensorForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    adicionarSensor();
  });

  // Botão adicionar — onclick explícito
  document.getElementById('btnAdicionar').onclick = e => {
    e.preventDefault();
    adicionarSensor();
  };

  // Botão dados de teste
  document.getElementById('btnTesteData').addEventListener('click', carregarDadosDeTeste);

  // Botão limpar todos
  document.getElementById('btnLimpar').addEventListener('click', limparTodos);

  // Toggle de tema
  document.getElementById('themeToggleNav').addEventListener('click', e => {
    e.preventDefault();
    alternarTema();
  });

  // Permite adicionar sensor com Enter no campo de valor
  document.getElementById('valorSensor').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionarSensor();
    }
  });

});
