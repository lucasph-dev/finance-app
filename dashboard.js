import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let perfilID = localStorage.getItem('perfilAtualID');
let listaTransacoes = [];
let listaObrigacoes = [];
let metaGastos = 0;
let idParaExcluir = null;
let tipoParaExcluir = null;

function ativarMascara(idElemento) {
    const el = document.getElementById(idElemento);
    if(el) {
        el.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value === '') { e.target.value = ''; return; }
            value = (parseInt(value) / 100).toLocaleString('pt-BR', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            });
            e.target.value = 'R$ ' + value;
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    ['recValor', 'despValor', 'obrigValor', 'inputMeta'].forEach(id => ativarMascara(id));

    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await signOut(auth);
            localStorage.clear(); 
            window.location.href = "index.html";
        });

// 1. Lógica da Legenda Dinâmica
const legendas = {
    "1": "Péssimo 😡",
    "2": "Ruim 😕",
    "3": "Regular 😐",
    "4": "Muito Bom! 🙂",
    "5": "Excelente! 🤩"
};

// Usamos o body para garantir que funcione mesmo se o modal abrir depois
document.body.addEventListener('change', (e) => {
    if (e.target.name === 'stars') {
        const legendaEl = document.getElementById('starLegend');
        if (legendaEl) legendaEl.innerText = legendas[e.target.value];
    }
});

// 2. Lógica do Botão de Enviar Feedback
const btnEnviarFeedback = document.getElementById('btnEnviarFeedback');
if (btnEnviarFeedback) {
    btnEnviarFeedback.addEventListener('click', async () => {
        const estrelaSelecionada = document.querySelector('input[name="stars"]:checked');
        const comentario = document.getElementById('feedbackTexto').value;

        if (!estrelaSelecionada) {
            alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
            return;
        }

        // Feedback visual no botão
        btnEnviarFeedback.disabled = true;
        btnEnviarFeedback.innerText = "Enviando...";

        try {
            // SALVANDO NO FIREBASE
            await addDoc(collection(db, "feedbacks"), {
                uid: auth.currentUser.uid,
                usuario: auth.currentUser.displayName || "Usuário",
                email: auth.currentUser.email,
                estrelas: parseInt(estrelaSelecionada.value),
                comentario: comentario,
                data: new Date(),
                versao: "beta"
            });

// 1. FECHA O MODAL DE ENVIO (O formulário)
            fecharModalInstantaneo('modalFeedback');

            // 2. LIMPA O TEXTO
            document.getElementById('feedbackTexto').value = "";

            // 3. ABRE O MODAL DE SUCESSO (Em vez do alert)
            const modalSucessoEl = document.getElementById('modalFeedbackSucesso');
            if (modalSucessoEl) {
                const modalSucesso = new bootstrap.Modal(modalSucessoEl);
                modalSucesso.show();
            }

        } catch (error) {
            console.error(error);
            alert("Erro ao enviar. Verifique sua internet."); // Mantemos este alert apenas para erros reais
        } finally {
            btnEnviarFeedback.disabled = false;
            btnEnviarFeedback.innerText = "ENVIAR";
        }
    });
}
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!perfilID) { window.location.href = "selecao.html"; return; }
            
            const nomeDisplay = document.getElementById('userNameDisplay');
            if(nomeDisplay) nomeDisplay.innerText = user.displayName || "Usuário";
            const nomePerfil = localStorage.getItem('perfilAtualNome');
            const displayPerfil = document.getElementById('profileNameDisplay');
            if(nomePerfil && displayPerfil) displayPerfil.innerText = nomePerfil.toUpperCase();

            carregarDados(); 
        } else {
            window.location.href = "index.html";
        }
    });
});

// UI INSTANTÂNEA
function fecharModalInstantaneo(idModal) {
    const modalEl = document.getElementById(idModal);
    if(modalEl && window.bootstrap) {
        const modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        modal.hide();
        document.body.classList.remove('modal-open');
        document.body.style = '';
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    }
}

function adicionarTransacaoLocalmente(transacao) {
    listaTransacoes.push({ id: 'temp_' + Date.now(), ...transacao });
    renderizarHistorico();
    atualizarSaldo();
    atualizarBarraMeta();
}

async function carregarDados() {
    const loading = document.getElementById('loading');
    const content = document.getElementById('dashboardContent');

    try {
        if(loading) loading.classList.remove('d-none');
        
        const [snapT, snapO, snapM] = await Promise.all([
            getDocs(query(collection(db, "transacoes"), where("perfilId", "==", perfilID))),
            getDocs(query(collection(db, "obrigacoes"), where("perfilId", "==", perfilID))),
            getDocs(query(collection(db, "metas"), where("perfilId", "==", perfilID)))
        ]);

        listaTransacoes = snapT.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        listaObrigacoes = snapO.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        metaGastos = !snapM.empty ? snapM.docs[0].data().valor : 0;
        if(!snapM.empty) localStorage.setItem('metaDocID', snapM.docs[0].id);

        renderizarHistorico();
        renderizarObrigacoes();
        atualizarSaldo();
        atualizarBarraMeta();

        if(loading) loading.classList.add('d-none');
        if(content) content.classList.remove('d-none');

    } catch (error) {
        console.error("Erro dados:", error);
        if(loading) loading.classList.add('d-none');
        if(content) content.classList.remove('d-none');
    }
}

// --- FORMULÁRIOS (SALVAMENTO OTIMISTA) ---

const formReceita = document.getElementById('formReceita');
if(formReceita) {
    formReceita.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            tipo: 'Receita',
            nome: document.getElementById('recNome').value,
            valor: lerValorFormatado('recValor'),
            data: formatarData(document.getElementById('recData').value),
            status: document.getElementById('recStatus').value,
            perfilId: perfilID,
            createdAt: new Date()
        };

        fecharModalInstantaneo('modalReceita');
        formReceita.reset();
        adicionarTransacaoLocalmente(dados);

        try {
            await addDoc(collection(db, "transacoes"), dados);
            carregarDadosSilencioso(); // Atualiza ID real
        } catch(err) { console.error(err); }
    });
}

const formDespesa = document.getElementById('formDespesa');
if(formDespesa) {
    formDespesa.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dados = {
            tipo: 'Despesa',
            nome: document.getElementById('despNome').value,
            valor: lerValorFormatado('despValor'),
            data: formatarData(document.getElementById('despData').value),
            status: document.getElementById('despStatus').value,
            perfilId: perfilID,
            createdAt: new Date()
        };

        fecharModalInstantaneo('modalDespesa');
        formDespesa.reset();
        adicionarTransacaoLocalmente(dados);

        try {
            await addDoc(collection(db, "transacoes"), dados);
            carregarDadosSilencioso();
        } catch(err) { console.error(err); }
    });
}

async function carregarDadosSilencioso() {
    const snap = await getDocs(query(collection(db, "transacoes"), where("perfilId", "==", perfilID)));
    listaTransacoes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- AÇÕES ---

window.deletarTransacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'transacao';
    if(window.bootstrap) {
        const modal = new window.bootstrap.Modal(document.getElementById('modalConfirmacao'));
        modal.show();
    }
};

window.excluirObrigacao = function(id) {
    idParaExcluir = id;
    tipoParaExcluir = 'obrigacao';
    if(window.bootstrap) {
        const modal = new window.bootstrap.Modal(document.getElementById('modalConfirmacao'));
        modal.show();
    }
};

window.confirmarExclusaoReal = async function() {
    fecharModalInstantaneo('modalConfirmacao');

    if (!idParaExcluir) return;

    if (tipoParaExcluir === 'transacao') {
        listaTransacoes = listaTransacoes.filter(t => t.id !== idParaExcluir);
        renderizarHistorico();
        atualizarSaldo();
        atualizarBarraMeta();
        try { await deleteDoc(doc(db, "transacoes", idParaExcluir)); } catch(e){}
    } else {
        listaObrigacoes = listaObrigacoes.filter(o => o.id !== idParaExcluir);
        renderizarObrigacoes();
        atualizarSaldo();
        try { await deleteDoc(doc(db, "obrigacoes", idParaExcluir)); } catch(e){}
    }
};

window.editarTransacao = async function(id) {
    const item = listaTransacoes.find(t => t.id === id);
    if(!item) return;

    if(confirm("Deseja editar este item? (Ele será recriado)")) {
        await deleteDoc(doc(db, "transacoes", id));
        listaTransacoes = listaTransacoes.filter(t => t.id !== id);
        renderizarHistorico();
        atualizarSaldo();

        if(item.tipo === 'Receita') {
            document.getElementById('recNome').value = item.nome;
            document.getElementById('recValor').value = 'R$ ' + (item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
            if(window.bootstrap) new window.bootstrap.Modal(document.getElementById('modalReceita')).show();
        } else {
            document.getElementById('despNome').value = item.nome;
            document.getElementById('despValor').value = 'R$ ' + (item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2});
            if(window.bootstrap) new window.bootstrap.Modal(document.getElementById('modalDespesa')).show();
        }
    }
};

window.toggleStatusObrigacao = async function(id) {
    const item = listaObrigacoes.find(o => o.id === id);
    if (!item) return;
    const novoStatus = !item.pago;

    try {
        await updateDoc(doc(db, "obrigacoes", id), { pago: novoStatus });
        
        await addDoc(collection(db, "transacoes"), {
            tipo: novoStatus ? 'Despesa' : 'Receita',
            nome: (novoStatus ? 'Pgto: ' : 'Estorno: ') + item.nome,
            valor: parseFloat(item.valorPadrao),
            data: new Date().toLocaleDateString('pt-BR'),
            status: 'pago',
            perfilId: perfilID,
            createdAt: new Date()
        });
        
        carregarDados();
    } catch (error) { console.error(error); }
};

window.gerarResumoSemanal = function() {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    let entrada = 0; let saida = 0;

    listaTransacoes.forEach(t => {
        if(t.data) {
            const p = t.data.split('/');
            const dt = new Date(p[2], p[1] - 1, p[0]);
            if (dt >= seteDiasAtras && dt <= hoje) {
                if (t.tipo === 'Receita') entrada += t.valor; else saida += t.valor;
            }
        }
    });

    document.getElementById('resumoEntrada').innerText = entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('resumoSaida').innerText = saida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const balanco = entrada - saida;
    const elBalanco = document.getElementById('resumoBalanco');
    elBalanco.innerText = balanco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    elBalanco.className = balanco >= 0 ? "display-6 fw-bold mt-1 text-success" : "display-6 fw-bold mt-1 text-danger";
    document.getElementById('resumoMsg').innerText = balanco >= 0 ? "Saldo positivo!" : "Gastos maiores que receitas.";

    if(window.bootstrap) new window.bootstrap.Modal(document.getElementById('modalResumo')).show();
};

const formMeta = document.getElementById('formMeta');
if(formMeta) {
    formMeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const valorMeta = lerValorFormatado('inputMeta');
        try {
            const metaDocID = localStorage.getItem('metaDocID');
            if (metaDocID) {
                await updateDoc(doc(db, "metas", metaDocID), { valor: valorMeta });
            } else {
                await addDoc(collection(db, "metas"), { perfilId: perfilID, valor: valorMeta });
            }
            fecharModalInstantaneo('modalMeta');
            carregarDados();
        } catch (error) { console.error("Erro meta:", error); }
    });
}

const formObrigacao = document.getElementById('formObrigacao');
if(formObrigacao) {
    formObrigacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        fecharModalInstantaneo('modalObrigacao');
        
        const nomeBase = document.getElementById('obrigNome').value;
        const valorTotal = lerValorFormatado('obrigValor');
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
            await addDoc(collection(db, "obrigacoes"), { ...item, obs: obs, pago: false, perfilId: perfilID });
        }
        formObrigacao.reset();
        carregarDados();
    });
}

// RENDERIZAÇÃO
function atualizarSaldo() {
    let saldo = 0; let pendenteE = 0; let pendenteS = 0;
    listaTransacoes.forEach(t => {
        if (t.status === 'pago') saldo += (t.tipo === 'Receita' ? t.valor : -t.valor);
        else (t.tipo === 'Receita' ? pendenteE += t.valor : pendenteS += t.valor);
    });
    listaObrigacoes.forEach(o => { if(!o.pago) pendenteS += o.valorPadrao; });
    
    const elSaldo = document.getElementById('saldoDisplay');
    if(elSaldo) {
        elSaldo.innerText = saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        elSaldo.className = saldo >= 0 ? 'text-money display-5 mb-3' : 'text-money display-5 mb-3 text-danger';
    }
    document.getElementById('previstoEntrada').innerText = pendenteE.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('previstoSaida').innerText = pendenteS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderizarHistorico() {
    const container = document.querySelector('.col-lg-7 .glass-card .p-0');
    if(!container) return;
    
    const htmlList = listaTransacoes.slice().reverse().map(t => {
        const isRec = t.tipo === 'Receita';
        return `
            <div class="list-group-item bg-transparent border-secondary text-white d-flex justify-content-between align-items-center py-3">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex justify-content-center align-items-center" 
                         style="width:42px; height:42px; background-color: ${isRec ? 'rgba(25, 135, 84, 0.2)' : 'rgba(220, 53, 69, 0.2)'};">
                        <i class="bi ${isRec ? 'bi-arrow-up' : 'bi-arrow-down'} ${isRec ? 'text-success' : 'text-danger'}"></i>
                    </div>
                    <div>
                        <h6 class="mb-0 text-truncate" style="max-width: 150px;">${t.nome}</h6>
                        <small class="text-muted" style="font-size: 0.75rem">${t.data}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold ${isRec ? 'text-success' : 'text-white'}">
                        ${isRec ? '+' : '-'} R$ ${t.valor.toFixed(2)}
                    </span>
                    <button onclick="deletarTransacao('${t.id}')" class="btn btn-sm text-danger"><i class="bi bi-trash"></i></button>
                </div>
            </div>`;
    }).join('');
    container.innerHTML = htmlList || '<div class="text-center py-5 text-muted">Sem movimentações</div>';
}

function renderizarObrigacoes() {
    const container = document.getElementById('listaObrigacoes');
    if(!container) return;
    container.innerHTML = listaObrigacoes.map(o => `
        <div class="card mb-3" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                <div><h6 class="text-white fw-bold mb-0">${o.nome}</h6><small class="text-white-50">R$ ${o.valorPadrao.toFixed(2)}</small></div>
                <button onclick="excluirObrigacao('${o.id}')" class="btn btn-sm text-muted"><i class="bi bi-x-lg"></i></button>
            </div>
        </div>
    `).join('');
}

function atualizarBarraMeta() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    let totalGasto = 0;
    listaTransacoes.forEach(t => {
        if (t.tipo === 'Despesa') {
             const p = t.data.split('/');
             if (parseInt(p[1]) === mesAtual) totalGasto += t.valor;
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
            elBarra.className = `progress-bar progress-bar-striped progress-bar-animated ${porcentagem < 50 ? 'bg-success' : porcentagem < 85 ? 'bg-warning' : 'bg-danger'}`;
        } else { elBarra.style.width = '0%'; elLimite.innerText = "Defina uma meta na engrenagem"; }
    }
}

function lerValorFormatado(id) {
    const val = document.getElementById(id).value;
    return parseFloat(val.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function formatarData(d) {
    if(!d) return new Date().toLocaleDateString('pt-BR');
    const p = d.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
}

