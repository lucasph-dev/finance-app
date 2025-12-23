import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- LOGIN (Funciona no index.html) ---
const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // IDs batendo com index.html
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value; // ID é 'password', não 'senha'

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                window.location.href = "selecao.html";
            })
            .catch((error) => {
                console.error(error);
                alert("Erro ao entrar: Verifique e-mail e senha.");
            });
    });
}

// --- CADASTRO (Funciona no cadastro.html) ---
const registerForm = document.getElementById('form-register');
if(registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // IDs batendo com cadastro.html
        const nome = document.getElementById('regNome').value;
        const email = document.getElementById('regEmail').value;
        const senha = document.getElementById('regPassword').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;

            await updateProfile(user, {
                displayName: nome
            });

            console.log("Conta criada:", nome);
            window.location.href = "perfil.html"; // Vai para criação de perfil financeiro

        } catch (error) {
            console.error(error);
            alert("Erro ao cadastrar: " + error.message);
        }
    });
}

// --- RECUPERAR SENHA (Funciona no index.html) ---
const btnRecuperar = document.getElementById('btnRecuperar');
if (btnRecuperar) {
    btnRecuperar.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Tenta pegar o email preenchido
        const campoEmail = document.getElementById('email');
        const email = campoEmail ? campoEmail.value : "";

        if (!email) {
            alert("Por favor, digite seu e-mail no campo acima primeiro.");
            return;
        }

        sendPasswordResetEmail(auth, email)
            .then(() => {
                alert("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
            })
            .catch((error) => {
                console.error(error);
                alert("Erro: " + error.message);
            });
    });
}