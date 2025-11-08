const mapa = document.getElementById('mapa');
const img = document.getElementById('mapaImg');
const canvas = document.getElementById('mapaCanvas');
const ctx = canvas.getContext('2d');

let pontos = [];
let linha = null;
let drone = null;

// Ajusta o tamanho do canvas ao tamanho da imagem
img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
};

// Captura os cliques no mapa
mapa.addEventListener('click', (e) => {
    if (pontos.length >= 2) return; // só permite dois pontos (A e B)

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ponto = document.createElement('div');
    ponto.classList.add('ponto');
    const label = pontos.length === 0 ? 'A' : 'B';
    ponto.classList.add(pontos.length === 0 ? 'a' : 'b');
    ponto.textContent = label;
    ponto.style.left = `${x}px`;
    ponto.style.top = `${y}px`;

    mapa.appendChild(ponto);
    pontos.push({ x, y });

    if (pontos.length === 2) {
        const pontoA = document.querySelector('.ponto.a');
        pontoA.classList.add('no-drone');
        desenharLinha();
        animarDrone();
    }

    console.log(`Ponto ${label}:`, { x, y });
});

function desenharLinha() {
    const [A, B] = pontos;

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const comprimento = Math.sqrt(dx * dx + dy * dy);
    const angulo = Math.atan2(dy, dx) * (180 / Math.PI);

    linha = document.createElement('div');
    linha.classList.add('linha');
    linha.style.width = `${comprimento}px`;
    linha.style.left = `${A.x}px`;
    linha.style.top = `${A.y}px`;
    linha.style.transform = `rotate(${angulo}deg)`;

    mapa.appendChild(linha);
}

// 🔹 Animação do drone indo de A até B
function animarDrone() {
    if (drone) drone.remove(); // remove drone anterior

    const [A, B] = pontos;
    drone = document.createElement('img');
    drone.src = "/static/drone.webp";
    drone.classList.add('drone');
    drone.style.left = `${A.x}px`;
    drone.style.top = `${A.y}px`;
    mapa.appendChild(drone);

    const duracao = 2000; // duração da animação em ms
    const inicio = performance.now();

    function mover(tempo) {
        const progresso = Math.min((tempo - inicio) / duracao, 1);
        const x = A.x + (B.x - A.x) * progresso;
        const y = A.y + (B.y - A.y) * progresso;

        drone.style.left = `${x}px`;
        drone.style.top = `${y}px`;

        if (progresso < 1) {
            requestAnimationFrame(mover);
        } else {
            console.log("🚁 Drone chegou ao ponto B!");
        }
    }

    requestAnimationFrame(mover);
}

// 🔸 Resetar tudo
function resetarPontos() {
    pontos = [];
    if (linha) linha.remove();
    if (drone) drone.remove();
    document.querySelectorAll('.ponto').forEach(p => p.remove());
    console.log('Pontos resetados!');
}
