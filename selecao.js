import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- NOVIDADE: Importando o Bootstrap diretamente aqui ---
import { Modal } from "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.esm.min.js";

let perfilParaExcluir = null;

// --- 1. FUNÇÕES GLOBAIS ---

// Função de Exclusão "Blindada"
window.prepararExclusao = function(e, id) {
    if(e) {
        e.stopPropagation();
        e.preventDefault();
    }
    
    console.log("Botão lixeira clicado para o ID:", id);
    perfilParaExcluir = id;
    
    const modalEl = document.getElementById('modalExcluirPerfil');
    
    if(modalEl) {
        // Agora usamos a classe "Modal" que importamos lá em cima
        // Não depende mais de 'window.bootstrap'
        const modal = Modal.getInstance(modalEl) || new Modal(modalEl);
        modal.show();
    } else {
        alert("Erro: Modal não encontrado no HTML.");
    }
}

window.selecionarPerfil = function(id, nome) {
    console.log("Selecionando perfil:", id);
    localStorage.setItem('perfilAtualID', id);
    localStorage.setItem('perfilAtualNome', nome);
    window.location.href = "dashboard.html";
};

// --- 2. LÓGICA DO FIREBASE ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Usuário logado:", user.uid);
        carregarPerfis(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

async function carregarPerfis(uid) {
    const loading = document.getElementById('loading');
    const lista = document.getElementById('listaPerfis');
    
    lista.innerHTML = '';

    try {
        const q = query(collection(db, "perfis"), where("uid_usuario", "==", uid));
        const querySnapshot = await getDocs(q);

        loading.classList.add('d-none');
        lista.classList.remove('d-none');

        if (querySnapshot.empty) {
            window.location.href = "perfil.html"; 
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const perfil = docSnap.data();
            const perfilId = docSnap.id;
            
            const cardHTML = `
                <div class="col-md-4 col-sm-6">
                    <div class="glass-card h-100 p-4 text-center position-relative perfil-card" style="transition: transform 0.2s;">
                        
                        <button type="button" onclick="prepararExclusao(event, '${perfilId}')" 
                                class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 m-2" 
                                style="z-index: 1050; cursor: pointer;">
                            <i class="bi bi-trash-fill fs-5"></i>
                        </button>

                        <div onclick="selecionarPerfil('${perfilId}', '${perfil.nome}')" style="cursor: pointer;">
                            <div class="mb-3">
                                <div class="rounded-circle bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
                                    <i class="bi bi-person-circle fs-1 text-success"></i>
                                </div>
                            </div>
                            <h5 class="text-white fw-bold mb-1">${perfil.nome}</h5>
                            <p class="text-white-50 small mb-0">${perfil.descricao || 'Sem descrição'}</p>
                            <div class="mt-3">
                                <span class="badge bg-dark border border-secondary">Saldo Inicial: R$ ${perfil.saldo}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            lista.innerHTML += cardHTML;
        });

    } catch (error) {
        console.error("Erro ao buscar perfis:", error);
        alert("Erro ao carregar perfis.");
    }
}

// --- 3. EVENTOS ---

document.addEventListener("DOMContentLoaded", () => {
    
    // Botão Sair
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = "index.html");
        });
    }

    // Botão Confirmar Exclusão
    const btnConfirmar = document.getElementById('btnConfirmarExclusao');
    if(btnConfirmar) {
        btnConfirmar.addEventListener('click', async () => {
            if (!perfilParaExcluir) return;

            const textoOriginal = btnConfirmar.innerText;
            btnConfirmar.innerText = "Apagando...";
            btnConfirmar.disabled = true;

            try {
                // Apaga tudo relacionado ao perfil
                const promises = [];
                
                // Função auxiliar para deletar coleção
                const deletarColecao = async (nomeColecao) => {
                    const q = query(collection(db, nomeColecao), where("perfilId", "==", perfilParaExcluir));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => promises.push(deleteDoc(doc.ref)));
                };

                await deletarColecao("transacoes");
                await deletarColecao("obrigacoes");
                await deletarColecao("metas");
                
                // Aguarda apagar os sub-dados
                await Promise.all(promises);

                // Apaga o Perfil
                await deleteDoc(doc(db, "perfis", perfilParaExcluir));

                // Fecha Modal
                const modalEl = document.getElementById('modalExcluirPerfil');
                const modal = Modal.getInstance(modalEl); // Uso direto da classe importada
                if(modal) modal.hide();
                
                location.reload();

            } catch (error) {
                console.error("Erro ao excluir perfil:", error);
                alert("Erro ao excluir: " + error.message);
            } finally {
                btnConfirmar.innerText = textoOriginal;
                btnConfirmar.disabled = false;
                perfilParaExcluir = null;
            }
        });
    }
});