// Importando do CDN para funcionar direto no navegador
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// SUAS CHAVES REAIS
const firebaseConfig = {
  apiKey: "AIzaSyCP77ggB6RKNZl6q2DeijNlFSMQWHDRSCY",
  authDomain: "finapp-5feb2.firebaseapp.com",
  projectId: "finapp-5feb2",
  storageBucket: "finapp-5feb2.firebasestorage.app",
  messagingSenderId: "149860010854",
  appId: "1:149860010854:web:d6d8541ddd095ad200d6a7",
  measurementId: "G-YR1JTP8M56"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Opcional por enquanto
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar para usar nos outros arquivos (auth.js, perfil.js, etc)
export { auth, db };