import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("Script perfil.js carregado!");

let usuarioAtual = null;
let welcomeModal;

// 1. Monitorar Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuário detectado:", user.uid);
        usuarioAtual = user;
        
        // Tenta configurar o Modal
        try {
            const nomeSpan = document.getElementById('modalUserName');
            const primeiroNome = user.displayName ? user.displayName.split(' ')[0] : 'Viajante';
            if(nomeSpan) nomeSpan.innerText = primeiroNome;

            const modalElement = document.getElementById('welcomeModal');
            if (modalElement && window.bootstrap) {
                welcomeModal = new bootstrap.Modal(modalElement);
                welcomeModal.show();
            }
        } catch (err) {
            console.warn("Erro ao abrir modal (não impede o cadastro):", err);
        }

    } else {
        console.log("Nenhum usuário logado. Redirecionando...");
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = "index.html";
    }
});

// 2. Lógica do Formulário
const form = document.getElementById('perfilForm');

if (!form) {
    alert("ERRO CRÍTICO: O formulário com id 'perfilForm' não foi encontrado no HTML.");
} else {
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede recarregar a página
        console.log("Botão clicado! Tentando salvar...");

        // Verificação de Segurança
        if (!usuarioAtual) {
            alert("Erro: Usuário não identificado. Aguarde um momento ou faça login novamente.");
            return;
        }

        // Pegando os valores
        const nomeInput = document.getElementById('nomePerfil');
        const descInput = document.getElementById('descricao');
        const saldoInput = document.getElementById('saldoInicial');

        if(!nomeInput || !saldoInput) {
            alert("Erro: Campos do formulário não encontrados no HTML.");
            return;
        }

        const nome = nomeInput.value;
        const descricao = descInput ? descInput.value : "";
        const saldo = parseFloat(saldoInput.value);

        console.log("Dados capturados:", { nome, saldo });

        // Botão visual de carregando
        const btnSubmit = form.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "Salvando...";
        btnSubmit.disabled = true;

        try {
            // Tenta salvar no Firebase
            const docRef = await addDoc(collection(db, "perfis"), {
                uid_usuario: usuarioAtual.uid,
                nome: nome,
                descricao: descricao,
                saldo: saldo,
                data_criacao: new Date()
            });

            console.log("Perfil salvo com ID:", docRef.id);
            
            // --- MUDANÇA: Exibir Modal em vez de Alert ---
            const successModalElement = document.getElementById('successModal');
            const successModal = new bootstrap.Modal(successModalElement);
            successModal.show();

            // Configura o botão do modal para ir pra dashboard
            document.getElementById('btnGoDashboard').addEventListener('click', () => {
                window.location.href = "dashboard.html";
            });

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar no banco de dados: " + error.message);
            
            // Restaura o botão se der erro
            btnSubmit.innerHTML = textoOriginal;
            btnSubmit.disabled = false;
        }
    });
}

function mostrarModal(titulo, mensagem) {
    const modalElement = document.getElementById('feedbackModal');
    const modalTitle = document.getElementById('feedbackModalLabel');
    const modalBody = document.getElementById('feedbackModalBody');

    // Define o conteúdo
    modalTitle.innerText = titulo;
    modalBody.innerText = mensagem;

    // Inicializa e mostra o modal usando Bootstrap 5
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// --- Exemplo para OBRIGAÇÕES ---
function cadastrarObrigacao() {
    // 1. Pegar dados (exemplo)
    const nome = document.getElementById('inputNomeObrigacao').value;
    const valor = parseFloat(document.getElementById('inputValorObrigacao').value);

    if (!nome || isNaN(valor)) {
        mostrarModal("Erro", "Preencha todos os campos corretamente.");
        return;
    }

    const novaObrigacao = { nome, valor, data: new Date().toLocaleDateString() };

    // 2. Salvar (Exemplo usando LocalStorage ou Array Global)
    let obrigacoes = JSON.parse(localStorage.getItem('obrigacoes')) || [];
    obrigacoes.push(novaObrigacao);
    localStorage.setItem('obrigacoes', JSON.stringify(obrigacoes));

    // 3. ATUALIZAR A TELA (A parte que faltava)
    atualizarDashboard(); // Recalcula totais
    renderizarHistorico(); // Redesenha a tabela/lista

    // 4. Feedback visual
    mostrarModal("Sucesso", "Obrigação cadastrada com sucesso!");
    
    // Limpar formulário (opcional)
    document.getElementById('formObrigacao').reset();
}

// --- Exemplo para RECEITAS ---
function cadastrarReceita() {
    const valor = parseFloat(document.getElementById('inputValorReceita').value);
    
    // ... validações ...

    const novaReceita = { tipo: 'Receita', valor, data: new Date().toLocaleDateString() };

    let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
    transacoes.push(novaReceita);
    localStorage.setItem('transacoes', JSON.stringify(transacoes));

    // 3. ATUALIZAR A TELA
    atualizarDashboard(); 
    renderizarHistorico(); 

    // 4. Feedback visual
    mostrarModal("Sucesso", "Receita adicionada!");
}

function renderizarHistorico() {
    const lista = document.getElementById('listaTransacoes'); // O <tbody> ou <ul> da sua lista
    lista.innerHTML = ''; // Limpa a lista atual para não duplicar

    // Pega os dados atualizados
    const transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];

    // Recria o HTML
    transacoes.forEach(t => {
        const linha = `
            <tr>
                <td>${t.data}</td>
                <td>${t.tipo}</td>
                <td class="text-success">R$ ${t.valor.toFixed(2)}</td>
            </tr>
        `;
        lista.innerHTML += linha;
    });
}