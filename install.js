let deferredPrompt;

// --- Lógica Android / PC ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    mostrarModalInstalacao();
});

function mostrarModalInstalacao() {
    // Tenta pegar o modal. Se o Bootstrap ainda não carregou, tenta de novo em 500ms
    const modalEl = document.getElementById('modalInstall');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        setTimeout(mostrarModalInstalacao, 500);
    }
}

window.instalarApp = async () => {
    if (!deferredPrompt) return;
    const modalEl = document.getElementById('modalInstall');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Escolha: ${outcome}`);
    deferredPrompt = null;
};

// --- Lógica iPhone (iOS) ---
document.addEventListener("DOMContentLoaded", () => {
    // Detecta se é iPhone/iPad
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    // Detecta se JÁ ESTÁ instalado (modo tela cheia)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    // Se for iPhone E NÃO estiver instalado
    if (isIos && !isInStandaloneMode) {
        // Espera 3 segundos para não ser chato logo de cara
        setTimeout(() => {
            const modalEl = document.getElementById('modalInstallIOS');
            if (modalEl && window.bootstrap) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        }, 3000);
    }
});