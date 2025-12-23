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
        e.preventDefault(); 
        console.log("Botão clicado! Tentando salvar...");

        if (!usuarioAtual) {
            alert("Erro: Usuário não identificado. Aguarde um momento ou faça login novamente.");
            return;
        }

        const nomeInput = document.getElementById('nomePerfil');
        const descInput = document.getElementById('descricao');
        const saldoInput = document.getElementById('saldoInicial');

        if(!nomeInput || !saldoInput) {
            alert("Erro: Campos do formulário não encontrados no HTML.");
            return;
        }

        const nome = nomeInput.value;
        const descricao = descInput ? descInput.value : "";
        const saldo = parseFloat(saldoInput.value) || 0;

        const btnSubmit = form.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerHTML;
        btnSubmit.innerHTML = "Salvando...";
        btnSubmit.disabled = true;

        try {
            // A. Tenta salvar o PERFIL no Firebase
            const docRef = await addDoc(collection(db, "perfis"), {
                uid_usuario: usuarioAtual.uid,
                nome: nome,
                descricao: descricao,
                saldo: saldo,
                data_criacao: new Date()
            });

            // B. ADIÇÃO: Criar transação de Saldo Inicial para o valor aparecer no Dashboard
            if (saldo > 0) {
                await addDoc(collection(db, "transacoes"), {
                    perfilId: docRef.id,
                    tipo: 'Receita',
                    nome: 'Saldo Inicial',
                    valor: saldo,
                    data: new Date().toLocaleDateString('pt-BR'),
                    status: 'pago',
                    criadoEm: new Date()
                });
            }

            console.log("Perfil e saldo salvos com ID:", docRef.id);
            
            // Salva no localStorage para o Dashboard saber qual perfil abrir
            localStorage.setItem('perfilAtualID', docRef.id);
            localStorage.setItem('perfilAtualNome', nome);

            // C. Exibir Modal de Sucesso
            const successModalElement = document.getElementById('successModal');
            if (successModalElement) {
                const successModal = new bootstrap.Modal(successModalElement);
                successModal.show();

                document.getElementById('btnGoDashboard').addEventListener('click', () => {
                    window.location.href = "dashboard.html";
                });
            } else {
                window.location.href = "dashboard.html";
            }

        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar no banco de dados: " + error.message);
            btnSubmit.innerHTML = textoOriginal;
            btnSubmit.disabled = false;
        }
    });
}

// Funções de feedback (conforme solicitado)
function mostrarModal(titulo, mensagem) {
    const modalElement = document.getElementById('feedbackModal');
    if(!modalElement) return;
    document.getElementById('feedbackModalLabel').innerText = titulo;
    document.getElementById('feedbackModalBody').innerText = mensagem;
    new bootstrap.Modal(modalElement).show();
}