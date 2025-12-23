import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Modal } from "bootstrap"; // Import correto do Bootstrap

// --- VARIÁVEIS GLOBAIS ---
let perfilID = localStorage.getItem('perfilAtualID');
let listaTransacoes = [];
let listaObrigacoes = [];
let metaGastos = 0;
let idParaExcluir = null;
let tipoParaExcluir = null;

// --- 1. SEGURANÇA E INICIALIZAÇÃO ---

document.addEventListener("DOMContentLoaded", () => {
    
    // Configurar Botão Sair (Limpa tudo ao sair)
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
                localStorage.clear(); // LIMPEZA TOTAL AO SAIR
                window.location.href = "index.html";
            } catch (error) {
                console.error("Erro ao sair:", error);
            }
        });
    }

    // Monitorar Autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // VERIFICAÇÃO DE SEGURANÇA CRÍTICA
            // Garante que o perfil salvo no navegador pertence a este usuário
            if (!perfilID) {
                window.location.href = "selecao.html";
                return;
            }

            const perfilValido = await verificarPropriedadeDoPerfil(user.uid, perfilID);
            
            if (!perfilValido) {
                console.warn("Tentativa de acesso a perfil de outro usuário.");
                localStorage.clear(); // Limpa dados suspeitos
                window.location.href = "selecao.html";
                return;
            }

            // Se chegou aqui, é o dono da conta. Pode carregar.
            console.log("Acesso autorizado ao perfil:", perfilID);
            
            const nomeDisplay = document.getElementById('userNameDisplay');
            if(nomeDisplay) nomeDisplay.innerText = user.displayName || "Usuário";
            
            const nomePerfil = localStorage.getItem('perfilAtualNome');
            const displayPerfil = document.getElementById('profileNameDisplay');
            if(nomePerfil && displayPerfil) {
                displayPerfil.innerText = nomePerfil.toUpperCase();
            }

            carregarDados(); 
        } else {
            window.location.href = "index.html";
        }
    });
});

// --- FUNÇÃO DE SEGURANÇA ---
async function verificarPropriedadeDoPerfil(uidUsuario, idPerfil) {
    try {
        const docRef = doc(db, "perfis", idPerfil);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();
            // Verifica se o dono do perfil no banco é o mesmo que está logado
            return dados.uid_usuario === uidUsuario;
        } else {
            return false; // Perfil não existe
        }
    } catch (error) {
        console.error("Erro na verificação de segurança:", error);
        return false;
    }
}

// --- 2. FUNÇÕES DE BANCO DE DADOS (FIRESTORE) ---

async function carregarDados() {
    try {
        const loading = document.getElementById('loading');
        if(loading) loading.classList.remove('d-none');

        // 1. Buscar Transações (Filtradas pelo Perfil ID)
        const qTransacoes = query(collection(db, "transacoes"), where("perfilId", "==", perfilID));
        const snapshotTransacoes = await getDocs(qTransacoes);
        listaTransacoes = snapshotTransacoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Buscar Obrigações
        const qObrigacoes = query(collection(db, "obrigacoes"), where("perfilId", "==", perfilID));
        const snapshotObrigacoes = await getDocs(qObrigacoes);
        listaObrigacoes = snapshotObrigacoes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Buscar Meta
        const qMeta = query(collection(db, "metas"), where("perfilId", "==", perfilID));
        const snapshotMeta = await getDocs(qMeta);
        if (!snapshotMeta.empty) {
            metaGastos = snapshotMeta.docs[0].data().valor;
            localStorage.setItem('metaDocID', snapshotMeta.docs[0].id); 
        } else {
            metaGastos = 0;
        }

        renderizarHistorico();
        renderizarObrigacoes();
        atualizarSaldo();
        atualizarBarraMeta();

        if(loading) loading.classList.add('d-none');
        document.getElementById('dashboardContent').classList.remove('d-none');

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        mostrarModal("Erro de Conexão", "Não foi possível baixar seus dados.");
    }
}

async function salvarTransacaoNoBanco(transacao) {
    try {
        await addDoc(collection(db, "transacoes"), {
            ...transacao,
            perfilId: perfilID, // VITAL: Vincula ao perfil atual
            createdAt: new Date()
        });
        carregarDados();
    } catch (error) {
        console.error("Erro ao salvar:", error);
        mostrarModal("Erro", "Falha ao salvar no banco de dados.");
    }
}

async function salvarObrigacaoNoBanco(obrigacao) {
    try {
        await addDoc(collection(db, "obrigacoes"), {
            ...obrigacao,
            perfilId: perfilID // VITAL: Vincula ao perfil atual
        });
    } catch (error) {
        console.error("Erro ao salvar obrigação:", error);
    }
}

// --- 3. FUNÇÕES GLOBAIS DE INTERAÇÃO ---

window.deletarTransacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'transacao';
    const modalEl = document.getElementById('modalConfirmacao');
    const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
    modal.show();
};

window.excluirObrigacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'obrigacao';
    const modalEl = document.getElementById('modalConfirmacao');
    const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
    modal.show();
};

window.confirmarExclusaoReal = async function() {
    if (!idParaExcluir || !tipoParaExcluir) return;

    const modalEl = document.getElementById('modalConfirmacao');
    const modalInstance = Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    try {
        if (tipoParaExcluir === 'transacao') {
            await deleteDoc(doc(db, "transacoes", idParaExcluir));
            mostrarModal("Sucesso", "Transação excluída.");
        } 
        else if (tipoParaExcluir === 'obrigacao') {
            await deleteDoc(doc(db, "obrigacoes", idParaExcluir));
            mostrarModal("Sucesso", "Obrigação removida.");
        }
        carregarDados();
    } catch (error) {
        console.error("Erro ao excluir:", error);
        mostrarModal("Erro", "Não foi possível excluir.");
    }

    idParaExcluir = null;
    tipoParaExcluir = null;
};

window.editarTransacao = async function(id) {
    const item = listaTransacoes.find(t => t.id === id);
    if(!item) return;

    if(confirm("Para editar, vamos remover o item atual e abrir o formulário. Confirmar?")) {
        await deleteDoc(doc(db, "transacoes", id));
        carregarDados();

        if(item.tipo === 'Receita') {
            document.getElementById('recNome').value = item.nome;
            document.getElementById('recValor').value = item.valor;
            document.getElementById('recData').value = formatarDataInput(item.data);
            const modalEl = document.getElementById('modalReceita');
            const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
            modal.show();
        } else {
            document.getElementById('despNome').value = item.nome;
            document.getElementById('despValor').value = item.valor;
            document.getElementById('despData').value = formatarDataInput(item.data);
            const modalEl = document.getElementById('modalDespesa');
            const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
            modal.show();
        }
    }
};

window.toggleStatusObrigacao = async function(id) {
    const item = listaObrigacoes.find(o => o.id === id);
    if (!item) return;

    const novoStatus = !item.pago;

    try {
        const obrigacaoRef = doc(db, "obrigacoes", id);
        await updateDoc(obrigacaoRef, { pago: novoStatus });

        if(novoStatus) {
            await salvarTransacaoNoBanco({
                tipo: 'Despesa',
                nome: `Pgto: ${item.nome}`,
                valor: parseFloat(item.valorPadrao),
                data: new Date().toLocaleDateString(),
                status: 'pago'
            });
            mostrarModal("Pago", "Registrado e descontado do saldo!");
        } else {
            await salvarTransacaoNoBanco({
                tipo: 'Receita',
                nome: `Estorno: ${item.nome}`,
                valor: parseFloat(item.valorPadrao),
                data: new Date().toLocaleDateString(),
                status: 'pago'
            });
            mostrarModal("Estornado", "Valor retornado ao saldo.");
        }
        
        carregarDados();
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
};

window.gerarResumoSemanal = function() {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    let entrada = 0; let saida = 0;

    listaTransacoes.forEach(t => {
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
        elMsg.innerText = "Saldo positivo na semana!";
    } else {
        elBalanco.className = "display-6 fw-bold mt-1 text-danger";
        elMsg.innerText = "Gastos maiores que receitas.";
    }

    const modalEl = document.getElementById('modalResumo');
    const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
    modal.show();
};

// --- 4. EVENT LISTENERS (FORMULÁRIOS) ---

const formMeta = document.getElementById('formMeta');
if(formMeta) {
    formMeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valorMeta = parseFloat(document.getElementById('inputMeta').value);
        
        try {
            const metaDocID = localStorage.getItem('metaDocID');
            
            if (metaDocID) {
                await updateDoc(doc(db, "metas", metaDocID), { valor: valorMeta });
            } else {
                await addDoc(collection(db, "metas"), {
                    perfilId: perfilID,
                    valor: valorMeta
                });
            }

            const modalEl = document.getElementById('modalMeta');
            const modal = Modal.getInstance(modalEl);
            if(modal) modal.hide();
            
            carregarDados();
            mostrarModal("Sucesso", "Meta atualizada!");

        } catch (error) {
            console.error("Erro meta:", error);
        }
    });
}

const formReceita = document.getElementById('formReceita');
if(formReceita) {
    formReceita.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarTransacaoNoBanco({
            tipo: 'Receita',
            nome: document.getElementById('recNome').value,
            valor: parseFloat(document.getElementById('recValor').value),
            data: formatarData(document.getElementById('recData').value),
            status: document.getElementById('recStatus').value
        });
        
        const modalEl = document.getElementById('modalReceita');
        const modal = Modal.getInstance(modalEl);
        if(modal) modal.hide();
        formReceita.reset();
        mostrarModal("Sucesso", "Receita salva!");
    });
}

const formDespesa = document.getElementById('formDespesa');
if(formDespesa) {
    formDespesa.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarTransacaoNoBanco({
            tipo: 'Despesa',
            nome: document.getElementById('despNome').value,
            valor: parseFloat(document.getElementById('despValor').value),
            data: formatarData(document.getElementById('despData').value),
            status: document.getElementById('despStatus').value
        });
        
        const modalEl = document.getElementById('modalDespesa');
        const modal = Modal.getInstance(modalEl);
        if(modal) modal.hide();
        formDespesa.reset();
        mostrarModal("Sucesso", "Despesa salva!");
    });
}

const formObrigacao = document.getElementById('formObrigacao');
if(formObrigacao) {
    formObrigacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nomeBase = document.getElementById('obrigNome').value;
        const valorTotal = parseFloat(document.getElementById('obrigValor').value) || 0;
        const diaBase = document.getElementById('obrigDia').value || "";
        const modelo = document.getElementById('obrigModelo').value;
        const obs = document.getElementById('obrigObs').value;
        
        let itens = [];

        if (modelo === 'salario') {
            itens.push({ nome: `${nomeBase} (Vale 40%)`, tipo: 'Adiantamento', valorPadrao: valorTotal * 0.40, dia: '15' });
            itens.push({ nome: `${nomeBase} (Salário 60%)`, tipo: 'Pagamento Final', valorPadrao: valorTotal * 0.60, dia: '30' });
        } else if (modelo === 'dividido') {
            const metade = valorTotal / 2;
            itens.push({ nome: `${nomeBase} (1ª Parc.)`, tipo: 'Parcelado', valorPadrao: metade, dia: diaBase });
            itens.push({ nome: `${nomeBase} (2ª Parc.)`, tipo: 'Parcelado', valorPadrao: metade, dia: '30' });
        } else {
            itens.push({ nome: nomeBase, tipo: 'Mensal', valorPadrao: valorTotal, dia: diaBase });
        }

        for (const item of itens) {
            await salvarObrigacaoNoBanco({
                ...item,
                obs: obs,
                pago: false
            });
        }

        const modalEl = document.getElementById('modalObrigacao');
        const modal = Modal.getInstance(modalEl);
        if(modal) modal.hide();
        formObrigacao.reset();
        
        carregarDados(); 
        mostrarModal("Sucesso", "Obrigação cadastrada!");
    });
}

// --- 5. RENDERIZAÇÃO E AUXILIARES ---

function actualizarSaldo() { /* Mesma lógica de antes, vou manter apenas a estrutura para não estourar o limite */
    atualizarSaldo(); // Chama a função real abaixo
}

function atualizarSaldo() {
    let saldoReal = 0;
    let pendenteEntrada = 0;
    let pendenteSaida = 0;

    listaTransacoes.forEach(t => {
        if (t.status === 'pago') {
            if (t.tipo === 'Receita') saldoReal += t.valor;
            else saldoReal -= t.valor;
        } else {
            if (t.tipo === 'Receita') pendenteEntrada += t.valor;
            else pendenteSaida += t.valor;
        }
    });

    listaObrigacoes.forEach(o => {
        if (!o.pago) {
            pendenteSaida += o.valorPadrao;
        }
    });
    
    const elSaldo = document.getElementById('saldoDisplay');
    if(elSaldo) {
        elSaldo.innerText = saldoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        elSaldo.className = 'text-money display-5 mb-3'; 
        if(saldoReal < 0) elSaldo.classList.add('text-danger');
    }

    const elEntrada = document.getElementById('previstoEntrada');
    const elSaida = document.getElementById('previstoSaida');
    if(elEntrada) elEntrada.innerText = pendenteEntrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if(elSaida) elSaida.innerText = pendenteSaida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarBarraMeta() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    let totalGasto = 0;
    listaTransacoes.forEach(t => {
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
        elLimite.innerText = `Teto: ${metaGastos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

        if (metaGastos > 0) {
            const porcentagem = Math.min((totalGasto / metaGastos) * 100, 100);
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

function renderizarHistorico() {
    const container = document.querySelector('.col-lg-7 .glass-card .p-0');
    if (!container) return;
    
    if (listaTransacoes.length === 0) {
        container.innerHTML = `<div class="text-center py-5"><p class="text-muted">Nenhuma movimentação neste perfil.</p></div>`;
        return;
    }

    const ultimas = [...listaTransacoes].reverse(); 
    let html = '<div class="list-group list-group-flush bg-transparent">';

    ultimas.forEach(t => {
        const isRec = t.tipo === 'Receita';
        const iconeInteligente = detectarIcone(t.nome, t.tipo);
        
        const botoesAcao = `
            <div class="d-flex gap-2 ms-3">
                <button onclick="editarTransacao('${t.id}')" class="btn btn-sm btn-outline-secondary border-0 text-white-50"><i class="bi bi-pencil"></i></button>
                <button onclick="deletarTransacao('${t.id}')" class="btn btn-sm btn-outline-danger border-0"><i class="bi bi-trash"></i></button>
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
    container.innerHTML = '';

    if(listaObrigacoes.length === 0) {
        container.innerHTML = '<p class="text-muted small ms-1">Nenhuma obrigação neste perfil.</p>';
        return;
    }

    listaObrigacoes.sort((a, b) => (parseInt(a.dia) || 99) - (parseInt(b.dia) || 99));

    listaObrigacoes.forEach(o => {
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
                    <button onclick="excluirObrigacao('${o.id}')" class="btn btn-sm text-muted p-0 border-0" title="Excluir"><i class="bi bi-x-lg"></i></button>
                    <div onclick="toggleStatusObrigacao('${o.id}')" style="cursor: pointer;" class="my-1">${iconStatus}</div>
                    <small class="${corTextoStatus} fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">${textoStatus}</small>
                </div>
            </div>
        </div>`;
        container.innerHTML += card;
    });
}

function detectarIcone(nome, tipo) {
    if (!nome) return 'bi-circle';
    const n = nome.toLowerCase();
    if (tipo === 'Receita') return 'bi-cash-coin';
    if (n.includes('uber') || n.includes('99') || n.includes('taxi') || n.includes('bus')) return 'bi-car-front-fill';
    if (n.includes('mercado') || n.includes('compra') || n.includes('atacad')) return 'bi-cart-fill';
    if (n.includes('ifood') || n.includes('lanche') || n.includes('pizza') || n.includes('restaurante')) return 'bi-cup-hot-fill';
    if (n.includes('luz') || n.includes('energia') || n.includes('agua') || n.includes('net') || n.includes('aluguel')) return 'bi-house-door-fill';
    if (n.includes('pix') || n.includes('transf')) return 'bi-arrow-left-right';
    return 'bi-bag-fill';
}

function mostrarModal(titulo, mensagem) {
    const modalEl = document.getElementById('feedbackModal');
    if(modalEl) {
        document.getElementById('feedbackModalLabel').innerText = titulo;
        document.getElementById('feedbackModalBody').innerText = mensagem;
        const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
        modal.show();
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