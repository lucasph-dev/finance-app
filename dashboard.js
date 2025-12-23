import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- VARIÁVEIS DE CONTROLE DE EXCLUSÃO ---
let idParaExcluir = null;
let tipoParaExcluir = null;

// --- 0. FUNÇÕES GLOBAIS (Para o HTML acessar) ---

// 1. Botão Lixeira (Transação)
window.deletarTransacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'transacao';
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacao'));
    modal.show();
};

// 2. Botão Lixeira (Obrigação)
window.excluirObrigacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'obrigacao';
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacao'));
    modal.show();
};

// 3. Confirmação Real (Botão Vermelho do Modal)
window.confirmarExclusaoReal = function() {
    if (!idParaExcluir || !tipoParaExcluir) return;

    if (tipoParaExcluir === 'transacao') {
        let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
        transacoes = transacoes.filter(t => t.id !== idParaExcluir);
        localStorage.setItem('transacoes', JSON.stringify(transacoes));
        mostrarModal("Excluído", "Transação removida com sucesso.");
    } 
    else if (tipoParaExcluir === 'obrigacao') {
        let obrigacoes = JSON.parse(localStorage.getItem('obrigacoes')) || [];
        obrigacoes = obrigacoes.filter(o => o.id !== idParaExcluir);
        localStorage.setItem('obrigacoes', JSON.stringify(obrigacoes));
        mostrarModal("Excluído", "Obrigação fixa removida.");
    }

    const modalEl = document.getElementById('modalConfirmacao');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    idParaExcluir = null;
    tipoParaExcluir = null;
    carregarDados();
};

window.editarTransacao = function(id) {
    let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    const item = transacoes.find(t => t.id === id);
    
    if(!item) return;

    // Remove para editar (sem perguntar)
    transacoes = transacoes.filter(t => t.id !== id);
    localStorage.setItem('transacoes', JSON.stringify(transacoes));
    carregarDados();

    if(item.tipo === 'Receita') {
        document.getElementById('recNome').value = item.nome;
        document.getElementById('recValor').value = item.valor;
        document.getElementById('recData').value = formatarDataInput(item.data);
        const modal = new bootstrap.Modal(document.getElementById('modalReceita'));
        modal.show();
    } else {
        document.getElementById('despNome').value = item.nome;
        document.getElementById('despValor').value = item.valor;
        document.getElementById('despData').value = formatarDataInput(item.data);
        const modal = new bootstrap.Modal(document.getElementById('modalDespesa'));
        modal.show();
    }
};

window.toggleStatusObrigacao = function(id) {
    let obrigacoes = JSON.parse(localStorage.getItem('obrigacoes')) || [];
    const index = obrigacoes.findIndex(o => o.id === id);
    
    if(index !== -1) {
        const novoStatus = !obrigacoes[index].pago;
        obrigacoes[index].pago = novoStatus;
        localStorage.setItem('obrigacoes', JSON.stringify(obrigacoes));

        if(novoStatus) {
            // Pagou: Cria despesa e desconta do saldo
            const novaDespesa = {
                id: Date.now(),
                tipo: 'Despesa',
                nome: `Pgto: ${obrigacoes[index].nome}`,
                valor: parseFloat(obrigacoes[index].valorPadrao),
                data: new Date().toLocaleDateString(),
                status: 'pago'
            };
            salvarTransacao(novaDespesa);
            mostrarModal("Pago!", "Marcado como pago e descontado do saldo.");
        } else {
            // Desmarcou: Estorna o valor
            const estorno = {
                id: Date.now(),
                tipo: 'Receita', 
                nome: `Estorno: ${obrigacoes[index].nome}`,
                valor: parseFloat(obrigacoes[index].valorPadrao),
                data: new Date().toLocaleDateString(),
                status: 'pago'
            };
            salvarTransacao(estorno);
            mostrarModal("Estornado", "Valor retornado ao saldo.");
        }
        
        renderizarObrigacoes();
    }
};

window.gerarResumoSemanal = function() {
    const transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    let entrada = 0; let saida = 0;

    transacoes.forEach(t => {
        if(t.data) {
            const partes = t.data.split('/');
            const dataTransacao = new Date(partes[2], partes[1] - 1, partes[0]);
            if (dataTransacao >= seteDiasAtras && dataTransacao <= hoje) {
                if (t.tipo === 'Receita') entrada += t.valor;
                else if (t.tipo === 'Despesa') saida += t.valor;
            }
        }
    });

    const balanco = entrada - saida;

    document.getElementById('resumoEntrada').innerText = entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('resumoSaida').innerText = saida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const elBalanco = document.getElementById('resumoBalanco');
    elBalanco.innerText = balanco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const elMsg = document.getElementById('resumoMsg');
    if (balanco >= 0) {
        elBalanco.className = "display-6 fw-bold mt-1 text-success";
        elMsg.innerText = "Você gastou menos do que recebeu essa semana! 👏";
    } else {
        elBalanco.className = "display-6 fw-bold mt-1 text-danger";
        elMsg.innerText = "Gastos superaram as receitas recentes. ⚠️";
    }

    new bootstrap.Modal(document.getElementById('modalResumo')).show();
};

// --- 1. INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const nomeDisplay = document.getElementById('userNameDisplay');
            if(nomeDisplay) nomeDisplay.innerText = user.displayName || "Usuário";
            carregarDados();
        } else {
            window.location.href = "index.html";
        }
    });

    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }

    setTimeout(() => {
        const loading = document.getElementById('loading');
        const content = document.getElementById('dashboardContent');
        if(loading) loading.classList.add('d-none');
        if(content) content.classList.remove('d-none');
    }, 500);
});

// --- 2. FORMULÁRIOS E SALVAMENTO ---

// Meta de Gastos
const formMeta = document.getElementById('formMeta');
if(formMeta) {
    formMeta.addEventListener('submit', (e) => {
        e.preventDefault();
        const valorMeta = parseFloat(document.getElementById('inputMeta').value);
        localStorage.setItem('metaGastos', valorMeta);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalMeta'));
        if(modal) modal.hide();
        
        carregarDados();
        mostrarModal("Meta Definida", `Teto de gastos atualizado para R$ ${valorMeta.toFixed(2)}`);
    });
}

function salvarTransacao(transacao) {
    let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    transacoes.push(transacao);
    localStorage.setItem('transacoes', JSON.stringify(transacoes));
    carregarDados();
}

// Receita
const formReceita = document.getElementById('formReceita');
if(formReceita) {
    formReceita.addEventListener('submit', (e) => {
        e.preventDefault();
        const novaTransacao = {
            id: Date.now(),
            tipo: 'Receita',
            nome: document.getElementById('recNome').value,
            valor: parseFloat(document.getElementById('recValor').value),
            data: formatarData(document.getElementById('recData').value),
            status: document.getElementById('recStatus').value
        };
        salvarTransacao(novaTransacao);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalReceita'));
        if(modal) modal.hide();
        formReceita.reset();
        mostrarModal("Sucesso", "Receita adicionada!");
    });
}

// Despesa
const formDespesa = document.getElementById('formDespesa');
if(formDespesa) {
    formDespesa.addEventListener('submit', (e) => {
        e.preventDefault();
        const novaTransacao = {
            id: Date.now(),
            tipo: 'Despesa',
            nome: document.getElementById('despNome').value,
            valor: parseFloat(document.getElementById('despValor').value),
            data: formatarData(document.getElementById('despData').value),
            status: document.getElementById('despStatus').value
        };
        salvarTransacao(novaTransacao);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalDespesa'));
        if(modal) modal.hide();
        formDespesa.reset();
        mostrarModal("Sucesso", "Despesa registrada!");
    });
}

// Obrigação (Com Parcelamento)
const formObrigacao = document.getElementById('formObrigacao');
if(formObrigacao) {
    formObrigacao.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nomeBase = document.getElementById('obrigNome').value;
        const valorTotal = parseFloat(document.getElementById('obrigValor').value) || 0;
        const diaBase = document.getElementById('obrigDia').value || "";
        const modelo = document.getElementById('obrigModelo').value;
        const obs = document.getElementById('obrigObs').value;
        
        let obrigacoesParaSalvar = [];
        const idBase = Date.now();

        if (modelo === 'salario') {
            obrigacoesParaSalvar.push({
                id: idBase, nome: `${nomeBase} (Vale 40%)`, tipo: 'Adiantamento',
                valorPadrao: valorTotal * 0.40, dia: '15', obs: obs, pago: false
            });
            obrigacoesParaSalvar.push({
                id: idBase + 1, nome: `${nomeBase} (Salário 60%)`, tipo: 'Pagamento Final',
                valorPadrao: valorTotal * 0.60, dia: '30', obs: obs, pago: false
            });
        } else if (modelo === 'dividido') {
            const metade = valorTotal / 2;
            obrigacoesParaSalvar.push({
                id: idBase, nome: `${nomeBase} (1ª Parc.)`, tipo: 'Parcelado',
                valorPadrao: metade, dia: diaBase, obs: obs, pago: false
            });
            obrigacoesParaSalvar.push({
                id: idBase + 1, nome: `${nomeBase} (2ª Parc.)`, tipo: 'Parcelado',
                valorPadrao: metade, dia: '30', obs: obs, pago: false
            });
        } else {
            obrigacoesParaSalvar.push({
                id: idBase, nome: nomeBase, tipo: 'Mensal',
                valorPadrao: valorTotal, dia: diaBase, obs: obs, pago: false
            });
        }

        let listaAtual = JSON.parse(localStorage.getItem('obrigacoes')) || [];
        listaAtual = [...listaAtual, ...obrigacoesParaSalvar];
        localStorage.setItem('obrigacoes', JSON.stringify(listaAtual));

        const modalEl = document.getElementById('modalObrigacao');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        formObrigacao.reset();
        renderizarObrigacoes();
        mostrarModal("Sucesso", "Obrigação cadastrada!");
    });
}

// --- 3. RENDERIZAÇÃO E INTELIGÊNCIA ---

function carregarDados() {
    renderizarHistorico();
    renderizarObrigacoes();
    atualizarSaldo(); // Agora com a lógica de previsão
    atualizarBarraMeta();
}

// ATUALIZA SALDO + PREVISÃO FUTURA
function atualizarSaldo() {
    const transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    const obrigacoes = JSON.parse(localStorage.getItem('obrigacoes')) || [];
    
    let saldoReal = 0;
    let pendenteEntrada = 0;
    let pendenteSaida = 0;

    // 1. Processa Transações
    transacoes.forEach(t => {
        if (t.status === 'pago') {
            if (t.tipo === 'Receita') saldoReal += t.valor;
            else saldoReal -= t.valor;
        } 
        else {
            if (t.tipo === 'Receita') pendenteEntrada += t.valor;
            else pendenteSaida += t.valor;
        }
    });

    // 2. Processa Obrigações (A Pagar)
    obrigacoes.forEach(o => {
        if (!o.pago) {
            pendenteSaida += o.valorPadrao;
        }
    });
    
    // 3. Atualiza Saldo Real
    const elSaldo = document.getElementById('saldoDisplay');
    if(elSaldo) {
        elSaldo.innerText = saldoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        elSaldo.className = 'text-money display-5 mb-3'; 
        if(saldoReal < 0) elSaldo.classList.add('text-danger');
    }

    // 4. Atualiza Futuro
    const elEntrada = document.getElementById('previstoEntrada');
    const elSaida = document.getElementById('previstoSaida');
    if (elEntrada) elEntrada.innerText = pendenteEntrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (elSaida) elSaida.innerText = pendenteSaida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarBarraMeta() {
    const meta = parseFloat(localStorage.getItem('metaGastos')) || 0;
    const transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    let totalGasto = 0;
    transacoes.forEach(t => {
        if (t.tipo === 'Despesa') {
             const partes = t.data.split('/');
             if (parseInt(partes[1]) === mesAtual && parseInt(partes[2]) === anoAtual) {
                 totalGasto += t.valor;
             }
        }
    });

    const elBarra = document.getElementById('barraMeta');
    const elGasto = document.getElementById('metaGastosAtual');
    const elLimite = document.getElementById('metaLimite');

    if (elBarra && elGasto) {
        elGasto.innerText = `Gastou: ${totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        elLimite.innerText = `Teto: ${meta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

        if (meta > 0) {
            const porcentagem = Math.min((totalGasto / meta) * 100, 100);
            elBarra.style.width = `${porcentagem}%`;

            elBarra.className = 'progress-bar progress-bar-striped progress-bar-animated';
            if (porcentagem < 50) elBarra.classList.add('bg-success');
            else if (porcentagem < 85) elBarra.classList.add('bg-warning');
            else elBarra.classList.add('bg-danger');
        } else {
            elBarra.style.width = '0%';
            elLimite.innerText = "Defina uma meta na engrenagem";
        }
    }
}

function detectarIcone(nome, tipo) {
    if (!nome) return 'bi-circle';
    const n = nome.toLowerCase();

    if (tipo === 'Receita') return 'bi-cash-coin';

    if (n.includes('uber') || n.includes('99') || n.includes('taxi') || n.includes('bus') || n.includes('transporte')) return 'bi-car-front-fill';
    if (n.includes('mercado') || n.includes('compra') || n.includes('atacad') || n.includes('feira')) return 'bi-cart-fill';
    if (n.includes('ifood') || n.includes('lanche') || n.includes('pizza') || n.includes('restaurante') || n.includes('burguer')) return 'bi-cup-hot-fill';
    if (n.includes('luz') || n.includes('energia') || n.includes('agua') || n.includes('net') || n.includes('aluguel')) return 'bi-house-door-fill';
    if (n.includes('farmacia') || n.includes('remedio') || n.includes('medico')) return 'bi-capsule';
    if (n.includes('pix') || n.includes('transf')) return 'bi-arrow-left-right';
    
    return 'bi-bag-fill';
}

function renderizarHistorico() {
    const container = document.querySelector('.col-lg-7 .glass-card .p-0');
    const transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];

    if (!container) return;
    
    if (transacoes.length === 0) {
        container.innerHTML = `<div class="text-center py-5"><p class="text-muted">Nenhuma movimentação.</p></div>`;
        return;
    }

    const ultimas = transacoes.slice().reverse();
    let html = '<div class="list-group list-group-flush bg-transparent">';

    ultimas.forEach(t => {
        const isRec = t.tipo === 'Receita';
        const iconeInteligente = detectarIcone(t.nome, t.tipo);
        
        const botoesAcao = `
            <div class="d-flex gap-2 ms-3">
                <button onclick="editarTransacao(${t.id})" class="btn btn-sm btn-outline-secondary border-0 text-white-50"><i class="bi bi-pencil"></i></button>
                <button onclick="deletarTransacao(${t.id})" class="btn btn-sm btn-outline-danger border-0"><i class="bi bi-trash"></i></button>
            </div>`;

        html += `
            <div class="list-group-item bg-transparent border-secondary text-white d-flex justify-content-between align-items-center py-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex justify-content-center align-items-center" 
                         style="width:42px; height:42px; background-color: ${isRec ? 'rgba(25, 135, 84, 0.2)' : 'rgba(220, 53, 69, 0.2)'};">
                        <i class="bi ${iconeInteligente} ${isRec ? 'text-success' : 'text-danger'} fs-5"></i>
                    </div>
                    <div>
                        <h6 class="mb-0 text-truncate" style="max-width: 150px;">${t.nome}</h6>
                        <small class="text-muted" style="font-size: 0.75rem">${t.data}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="text-end">
                        <span class="fw-bold ${isRec ? 'text-success' : 'text-white'}">
                            ${isRec ? '+' : '-'} R$ ${t.valor.toFixed(2)}
                        </span>
                    </div>
                    ${botoesAcao}
                </div>
            </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderizarObrigacoes() {
    const container = document.getElementById('listaObrigacoes');
    if(!container) return;
    const obrigacoes = JSON.parse(localStorage.getItem('obrigacoes')) || [];
    container.innerHTML = '';
    if(obrigacoes.length === 0) {
        container.innerHTML = '<p class="text-muted small ms-1">Nenhuma obrigação fixa cadastrada.</p>';
        return;
    }
    obrigacoes.sort((a, b) => (a.dia || 99) - (b.dia || 99));

    obrigacoes.forEach(o => {
        const bgClass = o.pago ? 'background: rgba(25, 135, 84, 0.15) !important;' : 'background: rgba(255, 255, 255, 0.03) !important;';
        const iconStatus = o.pago ? '<i class="bi bi-check-circle-fill text-success fs-4"></i>' : '<i class="bi bi-circle text-warning fs-4"></i>';
        const textoStatus = o.pago ? 'PAGO' : 'PENDENTE';
        const corTextoStatus = o.pago ? 'text-success' : 'text-warning';
        const badgeDia = o.dia ? `<span class="badge bg-secondary mb-1">Dia ${o.dia}</span>` : '';
        const textoObs = o.obs ? `<div class="text-white-50 small mt-1" style="font-size: 0.7rem;">Obs: ${o.obs}</div>` : '';

        const card = `
        <div class="card mb-3" style="${bgClass} border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex justify-content-center align-items-center" style="width:45px; height:45px; background-color: rgba(255,255,255,0.1);">
                        <i class="bi bi-person-fill text-white fs-5"></i>
                    </div>
                    <div>
                        ${badgeDia}
                        <h6 class="mb-0 text-white fw-bold">${o.nome}</h6>
                        <small class="text-white-50" style="font-size: 0.8rem;">${o.tipo || 'Mensal'}</small>
                        <div class="d-block text-white fw-bold mt-1">R$ ${o.valorPadrao.toFixed(2)}</div>
                        ${textoObs}
                    </div>
                </div>
                <div class="text-end d-flex flex-column align-items-end gap-1">
                    <button onclick="excluirObrigacao(${o.id})" class="btn btn-sm text-muted p-0 border-0" title="Excluir"><i class="bi bi-x-lg"></i></button>
                    <div onclick="toggleStatusObrigacao(${o.id})" style="cursor: pointer;" class="my-1">${iconStatus}</div>
                    <small class="${corTextoStatus} fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">${textoStatus}</small>
                </div>
            </div>
        </div>`;
        container.innerHTML += card;
    });
}

// Auxiliares
function mostrarModal(titulo, mensagem) {
    const modalEl = document.getElementById('feedbackModal');
    if(modalEl) {
        document.getElementById('feedbackModalLabel').innerText = titulo;
        document.getElementById('feedbackModalBody').innerText = mensagem;
        new bootstrap.Modal(modalEl).show();
    }
}

function formatarData(dataAmericana) {
    if(!dataAmericana) return new Date().toLocaleDateString();
    const partes = dataAmericana.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
}

function formatarDataInput(dataBrasileira) {
    if(!dataBrasileira) return "";
    const partes = dataBrasileira.split('/');
    if(partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
    return "";
}