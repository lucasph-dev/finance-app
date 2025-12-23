import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    updateProfile // Importante: Função para atualizar o nome
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- Lógica de Login ---
const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;

        signInWithEmailAndPassword(auth, email, senha)
            .then(() => {
                // O redirecionamento acontece, e a próxima página vai mostrar o modal
                window.location.href = "selecao.html";
            })
            .catch((error) => {
                alert("Erro ao entrar: " + error.message);
            });
    });
}

// --- Lógica de Cadastro (COM NOME) ---
const registerForm = document.getElementById('form-register'); // Certifique-se que o ID no HTML é form-register
if(registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('regNome').value;
        const email = document.getElementById('regEmail').value;
        const senha = document.getElementById('regPassword').value;

        try {
            // 1. Criar o usuário
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;

            // 2. Atualizar o perfil com o NOME
            await updateProfile(user, {
                displayName: nome
            });

            console.log("Conta criada para:", nome);
            // 3. Redirecionar
            window.location.href = "criar-perfil.html";

        } catch (error) {
            console.error(error);
            alert("Erro ao cadastrar: " + error.message);
        }
    });
}