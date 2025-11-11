// Inicializa o mapa (centrado em São Paulo)
const mapa = L.map('mapa').setView([-23.5505, -46.6333], 13);

// Camada base do OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(mapa);

let linha = null;
let drone = null;
let pontoB = null;
let marcadorB = null;
let droneChegou = false; // controla se o drone chegou

// Ícone do drone
const droneIcon = L.icon({
    iconUrl: 'static/drone.webp',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Ícone da base
const baseIcon = L.icon({
    iconUrl: 'static/base.avif',
    iconSize: [35, 35],
    iconAnchor: [17, 35]
});

// 🔹 Ponto fixo da base (centro de São Paulo)
const pontoA = L.latLng(-23.5505, -46.6333);
const marcadorA = L.marker(pontoA, { icon: baseIcon }).addTo(mapa);
marcadorA.bindPopup('📍 Base Central').openPopup();
setTimeout(() => marcadorA.closePopup(), 2000);

// Preenche o input da base
const inputA = document.getElementById('pa');
inputA.value = "Av. Paulista, São Paulo - SP";
inputA.setAttribute('readonly', true);

// 🔹 Raio máximo permitido em metros
const RAIO_MAXIMO = 10000; // 10 km

// 🔍 Campo de busca (por CEP ou endereço)
const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false
})
.on('markgeocode', function (e) {
    if (droneChegou) {
        alert("O drone já chegou ao destino. É necessário resetar os pontos antes de definir outro destino.");
        return;
    }
    verificarDistanciaEPonto(e.geocode.center, e.geocode.name);
})
.addTo(mapa);

// 🖱️ Clique no mapa define o ponto B (destino)
mapa.on('click', (e) => {
    if (droneChegou) {
        alert("O drone já chegou ao destino. É necessário resetar os pontos antes de definir outro destino.");
        return;
    }
    verificarDistanciaEPonto(e.latlng, `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
});

// 🔸 Verifica se o ponto está dentro do raio permitido
function verificarDistanciaEPonto(latlng, descricao) {
    const distancia = mapa.distance(pontoA, latlng);
    if (distancia > RAIO_MAXIMO) {
        alert(`❌ O destino está fora do raio máximo permitido (${RAIO_MAXIMO / 1000} km).`);
        return;
    }
    definirPontoB(latlng, descricao);
}

// 🔹 Define o ponto B, desenha a linha e anima o drone
function definirPontoB(latlng, descricao = '') {
    if (pontoB) return;

    marcadorB = L.marker(latlng).addTo(mapa).bindPopup('📦 Ponto B (Destino)').openPopup();
    setTimeout(() => marcadorB.closePopup(), 2000);
    pontoB = latlng;
    document.getElementById('pb').value = descricao;

    desenharLinha(pontoA, latlng);
    animarDrone(pontoA, latlng);
}

// 🔹 Desenha a linha entre Base e Destino
function desenharLinha(A, B) {
    if (linha) linha.remove();
    linha = L.polyline([A, B], { color: 'red', weight: 3 }).addTo(mapa);
}

// 🚁 Anima o drone indo de A até B
function animarDrone(A, B) {
    if (drone) mapa.removeLayer(drone);

    const offset = 0.0002;
    const start = L.latLng(A.lat + offset, A.lng);
    drone = L.marker(start, { icon: droneIcon }).addTo(mapa);

    const duracao = 3000;
    const inicio = performance.now();

    function mover(tempo) {
        const progresso = Math.min((tempo - inicio) / duracao, 1);
        const lat = A.lat + (B.lat - A.lat) * progresso + offset;
        const lng = A.lng + (B.lng - A.lng) * progresso;
        drone.setLatLng([lat, lng]);

        if (progresso < 1) {
            requestAnimationFrame(mover);
        } else {
            alert("🚁 O drone chegou ao destino com sucesso!");
            droneChegou = true; // sinaliza que chegou
        }
    }

    requestAnimationFrame(mover);
}

// 🔁 Resetar ponto B e rota
function resetarPontos() {
    if (marcadorB) {
        mapa.removeLayer(marcadorB);
        marcadorB = null;
        pontoB = null;
    }
    if (linha) {
        mapa.removeLayer(linha);
        linha = null;
    }
    if (drone) {
        mapa.removeLayer(drone);
        drone = null;
    }

    document.getElementById('pb').value = '';
    mapa.setView(pontoA, 13);
    marcadorA.openPopup();
    setTimeout(() => marcadorA.closePopup(), 3000);

    droneChegou = false; // reseta a flag
    console.log("🔄 Ponto B e rota resetados!");
}

window.resetarPontos = resetarPontos;
