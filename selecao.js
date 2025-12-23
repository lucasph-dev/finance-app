import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Monitorar Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Usuário logado:", user.uid);
        carregarPerfis(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// Carregar Perfis do Firestore
async function carregarPerfis(uid) {
    const loading = document.getElementById('loading');
    const lista = document.getElementById('listaPerfis');
    
    try {
        const q = query(collection(db, "perfis"), where("uid_usuario", "==", uid));
        const querySnapshot = await getDocs(q);

        loading.classList.add('d-none');
        lista.classList.remove('d-none');

        // SE NÃO TIVER PERFIL NENHUM -> Manda criar o primeiro
        if (querySnapshot.empty) {
            window.location.href = "perfil.html"; 
            return;
        }

        // SE TIVER PERFIS -> Renderiza os cards
        querySnapshot.forEach((doc) => {
            const perfil = doc.data();
            const perfilId = doc.id;
            
            // Cria o Card do Perfil
            const cardHTML = `
                <div class="col-md-4 col-sm-6">
                    <div class="glass-card h-100 p-4 text-center perfil-card" onclick="selecionarPerfil('${perfilId}', '${perfil.nome}')" style="cursor: pointer; transition: transform 0.2s;">
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
            `;
            lista.innerHTML += cardHTML;
        });

    } catch (error) {
        console.error("Erro ao buscar perfis:", error);
        alert("Erro ao carregar perfis.");
    }
}

// Função Global para clique (salva no localStorage e vai pro dashboard)
window.selecionarPerfil = function(id, nome) {
    // Salva qual perfil estamos usando agora (opcional, para uso futuro no dashboard)
    localStorage.setItem('perfilAtualID', id);
    localStorage.setItem('perfilAtualNome', nome);
    
    // Redireciona
    window.location.href = "dashboard.html";
};

// Botão Sair
document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});