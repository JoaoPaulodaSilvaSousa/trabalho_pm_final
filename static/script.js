// ---------- script.js (FINAL: BATERIA integrada + DIJKSTRA como algoritmo de rota) ----------

// Configuração da bateria do drone (km)
let droneBateriaMaxKm = 20;              // capacidade total da bateria (em km)
let droneBateriaAtualKm = droneBateriaMaxKm; // começa cheia

// ---- Função Haversine (km) ----
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const sa = Math.sin(dLat / 2);
  const sb = Math.sin(dLon / 2);
  const aa = sa * sa + Math.cos(lat1) * Math.cos(lat2) * sb * sb;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

// helper: calcula distância total (km) de uma rota (array de LatLng ou objetos {lat,lng})
function calcularDistanciaRotaKm(rota) {
  if (!rota || rota.length < 2) return 0;
  let soma = 0;
  for (let i = 0; i < rota.length - 1; i++) {
    const a = rota[i];
    const b = rota[i + 1];
    const pa = (typeof a.lat === 'function') ? { lat: a.lat(), lng: a.lng() } : { lat: a.lat, lng: a.lng || a.lon };
    const pb = (typeof b.lat === 'function') ? { lat: b.lat(), lng: b.lng() } : { lat: b.lat, lng: b.lng || b.lon };
    soma += haversineKm(pa, pb);
  }
  return soma;
}

// consome bateria (km). Retorna objeto { ok, restante, mensagem }
function consumirBateria(distanciaKm) {
  if (distanciaKm > droneBateriaAtualKm) {
    return {
      ok: false,
      restante: droneBateriaAtualKm,
      mensagem: `❌ BATERIA INSUFICIENTE\nDistância necessária: ${distanciaKm.toFixed(3)} km\nBateria disponível: ${droneBateriaAtualKm.toFixed(3)} km`
    };
  }
  droneBateriaAtualKm = Math.max(0, droneBateriaAtualKm - distanciaKm);
  return {
    ok: true,
    restante: droneBateriaAtualKm,
    mensagem: `✔ BATERIA OK\nDistância consumida: ${distanciaKm.toFixed(3)} km\nBateria restante: ${droneBateriaAtualKm.toFixed(3)} km`
  };
}

// Recarrega bateria quando o drone "volta" à base
function recarregarBateria() {
  droneBateriaAtualKm = droneBateriaMaxKm;
}

// --------------------
// Constantes / utilitários
// --------------------
const CACHE_TTL_MS = 15 * 60 * 1000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --------------------
// Início do app
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  // === Elements ===
  const elPa = document.getElementById('pa');
  const elPb = document.getElementById('pb');
  const elMr = document.getElementById('mr'); // usado aqui como "metros por 1%" (opcional)
  const btnCalc = document.getElementById('btnCalculate');
  const btnReset = document.getElementById('btnReset');
  const precisionSelect = document.getElementById('precisionSelect');

  if (elPa) elPa.value = elPa.value || "Av. Paulista, São Paulo - SP";
  if (elPb) elPb.value = elPb.value || "";
  if (elMr) elMr.value = elMr.value || "";

  // Icons (garanta que esses caminhos existam no seu projeto)
  const droneIcon = L.icon({ iconUrl: '/static/drone.webp', iconSize: [40,40], iconAnchor: [20,20] });
  const baseIcon  = L.icon({ iconUrl: '/static/base.avif', iconSize: [35,35], iconAnchor: [17,35] });

  // Mapa
  const mapa = L.map('mapa').setView([-23.5505, -46.6333], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);

  // Estado
  let pontoA = L.latLng(-23.5505, -46.6333);
  let pontoB = null;
  let marcadorA = L.marker(pontoA, { icon: baseIcon }).addTo(mapa);
  let marcadorB = null;
  let drone = L.marker(pontoA, { icon: droneIcon }).addTo(mapa); // drone inicialmente na base
  let linha = null;
  let fixedLayers = []; // seus obstáculos "nativos"
  let STEP_METERS = 50;

  marcadorA.bindPopup('📍 Base Central').openPopup();
  setTimeout(()=>{ try{ marcadorA.closePopup(); } catch(e){} }, 2000);

  // exemplos de obstáculos nativos (edite)
  const obstaculosFixos = [
    [
      [-23.5500, -46.6340],
      [-23.5503, -46.6334],
      [-23.5509, -46.6337],
      [-23.5505, -46.6343]
    ]
  ];
  const circulosFixos = [
    { lat: -23.5505, lng: -46.6340, raio: 120 }
  ];
  function desenharFixos() {
    try {
      obstaculosFixos.forEach(coords => {
        const poly = L.polygon(coords, { color: "red", fillColor: "red", fillOpacity: 0.35, weight: 1 }).addTo(mapa);
        fixedLayers.push(poly);
      });
    } catch(e){ console.warn(e); }
    try {
      circulosFixos.forEach(c => {
        const circle = L.circle([c.lat, c.lng], {
          radius: c.raio, color: "purple", fillColor: "purple", fillOpacity: 0.3
        }).addTo(mapa);
        fixedLayers.push(circle);
      });
    } catch(e){ console.warn(e); }
  }
  desenharFixos();

  // utils obstacles
  function getAllObstacleLayers(){ return fixedLayers || []; }

  function estaDentroDeObstaculo(node, obsLayers) {
    if (!obsLayers || obsLayers.length === 0) return false;
    const pt = turf.point([node.lng, node.lat]);
    for (let layer of obsLayers) {
      try {
        if (typeof layer.getRadius === 'function' && typeof layer.getLatLng === 'function') {
          const center = layer.getLatLng();
          const radiusMeters = layer.getRadius();
          const circ = turf.circle([center.lng, center.lat], radiusMeters / 1000, { steps: 36, units: 'kilometers' });
          if (turf.booleanPointInPolygon(pt, circ)) return true;
          continue;
        }
        const latlngs = layer.getLatLngs();
        let ring = latlngs && latlngs.length ? latlngs[0] : [];
        if (!Array.isArray(ring) || ring.length === 0) ring = [].concat(...latlngs);
        const coords = ring.map(p => [p.lng, p.lat]);
        if (coords.length < 3) continue;
        const polyT = turf.polygon([coords]);
        if (turf.booleanPointInPolygon(pt, polyT)) return true;
      } catch(e){ continue; }
    }
    return false;
  }

  // --------------------
  // GRID + DIJKSTRA (substitui A*)
  // --------------------
  function metersToDegLat(m){ return m / 111320; }
  function metersToDegLon(m, lat){ return m / (111320 * Math.cos(lat * Math.PI / 180) || 1e-6); }

  function gerarGridEntre(A, B, STEP_METERS = 50, paddingMeters = 80) {
    const minLat = Math.min(A.lat, B.lat), maxLat = Math.max(A.lat, B.lat);
    const minLng = Math.min(A.lng, B.lng), maxLng = Math.max(A.lng, B.lng);
    const padLat = metersToDegLat(paddingMeters);
    const padLon = metersToDegLon(paddingMeters, (A.lat + B.lat) / 2);
    const lat0 = minLat - padLat, lat1 = maxLat + padLat;
    const lng0 = minLng - padLon, lng1 = maxLng + padLon;
    const stepLat = metersToDegLat(STEP_METERS);
    const stepLon = metersToDegLon(STEP_METERS, (A.lat + B.lat) / 2);
    const nodes = []; let id = 0; const maxNodes = 4000;
    for (let lat = lat0; lat <= lat1 + 1e-12; lat += stepLat) {
      for (let lng = lng0; lng <= lng1 + 1e-12; lng += stepLon) {
        nodes.push({ id: id.toString(), lat: lat, lng: lng });
        id++; if (id >= maxNodes) break;
      }
      if (id >= maxNodes) break;
    }
    return nodes;
  }

  function construirAdjacency(nodes, stepMetersApprox = 50) {
    const adj = {};
    for (let a of nodes) {
      adj[a.id] = [];
      for (let b of nodes) {
        if (a.id === b.id) continue;
        const dkm = haversineKm(a, b), dm = dkm * 1000;
        if (dm <= stepMetersApprox * 1.6) adj[a.id].push({ id: b.id, cost: dm });
      }
    }
    return adj;
  }

  // DIJKSTRA: recebe startId, goalId, nodesMap (id->node), adj (adj list) -> retorna array de ids (path) ou null
  function dijkstraIds(startId, goalId, nodesMap, adj) {
    const dist = {};
    const prev = {};
    const Q = new Set(Object.keys(nodesMap));

    for (let id in nodesMap) { dist[id] = Infinity; prev[id] = null; }
    dist[startId] = 0;

    while (Q.size > 0) {
      // extrai u com menor dist
      let u = null, best = Infinity;
      for (let id of Q) {
        if (dist[id] < best) { best = dist[id]; u = id; }
      }
      if (u === null) break;
      Q.delete(u);
      if (u === goalId) break;

      const neighbors = adj[u] || [];
      for (let nb of neighbors) {
        if (!Q.has(nb.id)) continue; // já visitado
        const alt = dist[u] + nb.cost;
        if (alt < dist[nb.id]) {
          dist[nb.id] = alt;
          prev[nb.id] = u;
        }
      }
    }

    if (prev[goalId] === null && startId !== goalId) return null;
    // reconstruir
    const pathIds = [];
    let cur = goalId;
    while (cur) {
      pathIds.unshift(cur);
      if (cur === startId) break;
      cur = prev[cur];
    }
    return pathIds;
  }

  // encontra o nearest node id dado um ponto e uma lista de nodes (nodes são {id,lat,lng})
  function nearestNodeIdToPoint(pt, nodesList) {
    let best = null, bestD = Infinity;
    for (let n of nodesList) {
      const d = haversineKm(pt, { lat: n.lat, lng: n.lng }) * 1000;
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  // Constrói rota usando Dijkstra (retorna array de L.LatLng ou null)
  async function calcularRotaDijkstra(A, B, STEP_METERS_local = 50, animate = true) {
    const nodesAll = gerarGridEntre(A, B, STEP_METERS_local, 80);
    // filtrar nodes dentro de obstaculos
    const allObstacles = getAllObstacleLayers();
    const nodesFiltrados = nodesAll.filter(n => !estaDentroDeObstaculo(n, allObstacles));

    if (nodesFiltrados.length < 8) { console.warn("Nós insuficientes para Dijkstra"); return null; }
    const nodesMap = {};
    nodesFiltrados.forEach(n => nodesMap[n.id] = n);
    const adj = construirAdjacency(nodesFiltrados, STEP_METERS_local);

    const startId = nearestNodeIdToPoint({ lat: A.lat, lng: A.lng }, nodesFiltrados);
    const goalId = nearestNodeIdToPoint({ lat: B.lat, lng: B.lng }, nodesFiltrados);
    if (!startId || !goalId) { console.warn("start/goal indefinidos (Dijkstra)"); return null; }

    const pathIds = dijkstraIds(startId, goalId, nodesMap, adj);
    if (!pathIds) { console.warn("Dijkstra não encontrou caminho"); return null; }

    const path = pathIds.map(id => L.latLng(nodesMap[id].lat, nodesMap[id].lng));
    if (!path[0].equals(A)) path.unshift(L.latLng(A.lat, A.lng));
    if (!path[path.length-1].equals(B)) path.push(L.latLng(B.lat, B.lng));

    try { if (linha) mapa.removeLayer(linha); } catch(e){}
    linha = L.polyline(path, { color: 'blue', weight: 3, dashArray: '6 4' }).addTo(mapa);

    if (animate) {
      // animação apenas da ida (opcional)
      for (let i=0;i<path.length-1;i++) {
        await animarDronePromessa(path[i], path[i+1]);
      }
      if (elMr) elMr.value = `Melhor rota calculada — ${(calcularDistanciaRotaKm(path) * 1000).toFixed(0)} m (ida)`;
    } else {
      if (elMr) elMr.value = `Melhor rota calculada. Distância estimada: ${(calcularDistanciaRotaKm(path)).toFixed(3)} km`;
    }

    return path;
  }

  // animação do drone (IDA)
  function animarDrone(A, B, callback) {
    try { if (drone) drone.removeFrom(mapa); } catch(e){}
    const offset = 0.0002;
    const start = L.latLng(A.lat + offset, A.lng);
    drone = L.marker(start, { icon: droneIcon }).addTo(mapa);
    const duracao = 900;
    const inicio = performance.now();
    function mover(tempo) {
      const progresso = Math.min((tempo - inicio) / duracao, 1);
      const lat = A.lat + (B.lat - A.lat) * progresso + offset;
      const lng = A.lng + (B.lng - A.lng) * progresso;
      drone.setLatLng([lat, lng]);
      if (progresso < 1) requestAnimationFrame(mover);
      else if (callback) callback();
    }
    requestAnimationFrame(mover);
  }
  function animarDronePromessa(A, B){ return new Promise(resolve => animarDrone(A, B, resolve)); }

  // rota direta bloqueada? (checa interseção linha direta com obstáculos)
  function rotaBloqueada(A, B) {
    const line = turf.lineString([[A.lng, A.lat], [B.lng, B.lat]]);
    const allObstacles = getAllObstacleLayers();
    for (let poly of allObstacles) {
      try {
        if (typeof poly.getRadius === 'function' && typeof poly.getLatLng === 'function') {
          const center = poly.getLatLng();
          const radiusMeters = poly.getRadius();
          const circ = turf.circle([center.lng, center.lat], radiusMeters / 1000, { steps: 36, units: 'kilometers' });
          if (turf.booleanIntersects(line, circ)) return true;
          continue;
        }
        const latlngs = poly.getLatLngs();
        let ring = latlngs && latlngs.length ? latlngs[0] : [];
        if (!Array.isArray(ring) || ring.length === 0) ring = [].concat(...latlngs);
        const coords = ring.map(p => [p.lng, p.lat]);
        if (coords.length < 3) continue;
        const polyT = turf.polygon([coords]);
        if (turf.booleanIntersects(line, polyT)) return true;
      } catch(e) { continue; }
    }
    return false;
  }

  // --------------------
  // Workflow principal (calcular rota + integrar bateria + popup %)
  // --------------------
  async function calcularRotaWorkflow() {
    if (!pontoB) { alert("Defina o destino no mapa primeiro (clique)."); return; }
    const precSelVal = precisionSelect ? parseInt(precisionSelect.value || '50', 10) : 50;
    STEP_METERS = isNaN(precSelVal) ? 50 : precSelVal;

    // ler meters per percent (opcional)
    const metersPerPercentInput = parseFloat((elMr && elMr.value) ? elMr.value : NaN);
    const metersPerPercent = (isFinite(metersPerPercentInput) && metersPerPercentInput > 0)
      ? metersPerPercentInput
      : (droneBateriaMaxKm * 1000 / 100); // default: autonomia total/100

    // 1) se linha direta sem bloquear -> rota direta
    if (!rotaBloqueada(pontoA, pontoB)) {
      try { if (linha) mapa.removeLayer(linha); } catch(e){}
      const pathDirect = [pontoA, pontoB];
      const distanciaKm = haversineKm(pontoA, pontoB);
      const roundTripKm = distanciaKm * 2;

      // Verifica se consegue ida+volta (em km)
      if (roundTripKm > droneBateriaAtualKm) {
        const consumoPercent = ( (distanciaKm*2*1000) / metersPerPercent );
        const mensagem = `🔴 Bateria insuficiente para ida e volta.\n\n` +
                         `Ida (km): ${distanciaKm.toFixed(3)} km\n` +
                         `Ida+Volta (km): ${roundTripKm.toFixed(3)} km\n` +
                         `Bateria disponível: ${droneBateriaAtualKm.toFixed(3)} km\n\n` +
                         `Consumo estimado: ${consumoPercent.toFixed(2)}%`;
        marcadorB.bindPopup(`<pre>${mensagem}</pre>`).openPopup();
        if (elMr) elMr.value = `Melhor rota calculada — ${ (distanciaKm).toFixed(3) } km (ida)`;
        return;
      }

      // Se consegue ida+volta: desenha e anima só a ida
      linha = L.polyline(pathDirect, { color: 'red', weight: 3 }).addTo(mapa);
      await animarDronePromessa(pontoA, pontoB);

      // Consome bateria só para ida (simula voo real)
      consumirBateria(distanciaKm);

      // "Volta" sem animação e recarrega bateria
      recarregarBateria();

      const consumoPercentFinal = ( (distanciaKm*2*1000) / metersPerPercent );
      const mensagemOk =
        `✅ Rota viável (ida + volta)\n\n` +
        `Ida: ${distanciaKm.toFixed(3)} km\n` +
        `Ida + Volta: ${roundTripKm.toFixed(3)} km\n` +
        `Bateria (após recarga): ${droneBateriaAtualKm.toFixed(3)} km\n\n` +
        `Consumo estimado: ${consumoPercentFinal.toFixed(2)}%`;

      marcadorB.bindPopup(`<pre>${mensagemOk}</pre>`).openPopup();
      if (elMr) elMr.value = `Melhor rota calculada — ${ (distanciaKm).toFixed(3) } km (ida)`;
      return;
    }

    // 2) rota direta bloqueada -> usar DIJKSTRA para calcular melhor rota evitando obstáculos
    const pathCalc = await calcularRotaDijkstra(pontoA, pontoB, STEP_METERS, false);
    if (!pathCalc) {
      alert("Não foi possível calcular rota com Dijkstra. Tente mudar a precisão.");
      if (elMr) elMr.value = "Falha ao calcular rota (Dijkstra).";
      return;
    }

    const distanciaKm = calcularDistanciaRotaKm(pathCalc);
    const roundTripKm = distanciaKm * 2;

    // Verifica se consegue ida+volta (em km)
    if (roundTripKm > droneBateriaAtualKm) {
      const consumoPercent = ( (distanciaKm*2*1000) / metersPerPercent );
      const mensagem = `🔴 Bateria insuficiente para ida e volta na melhor rota (Dijkstra).\n\n` +
                       `Rota (ida) estimada: ${distanciaKm.toFixed(3)} km\n` +
                       `Ida + Volta: ${roundTripKm.toFixed(3)} km\n` +
                       `Bateria disponível: ${droneBateriaAtualKm.toFixed(3)} km\n\n` +
                       `Consumo estimado: ${consumoPercent.toFixed(2)}%`;
      marcadorB.bindPopup(`<pre>${mensagem}</pre>`).openPopup();
      if (elMr) elMr.value = `Melhor rota calculada — ${ (distanciaKm).toFixed(3) } km (ida)`;
      return;
    }

    // Se OK: anima ida (recalcula+anima)
    const rotaAnimada = await calcularRotaDijkstra(pontoA, pontoB, STEP_METERS, true);

    // Consome bateria só para ida
    consumirBateria(distanciaKm);

    // Volta sem animação e recarrega
    recarregarBateria();

    const consumoPercentFinal = ( (distanciaKm*2*1000) / metersPerPercent );
    const mensagemOk =
      `✅ Melhor rota calculada (Dijkstra - evitando obstáculos)\n\n` +
      `Ida: ${distanciaKm.toFixed(3)} km\n` +
      `Ida + Volta: ${roundTripKm.toFixed(3)} km\n` +
      `Bateria (após recarga): ${droneBateriaAtualKm.toFixed(3)} km\n\n` +
      `Consumo estimado: ${consumoPercentFinal.toFixed(2)}%`;

    marcadorB.bindPopup(`<pre>${mensagemOk}</pre>`).openPopup();
    if (elMr) elMr.value = `Melhor rota calculada — ${ (distanciaKm).toFixed(3) } km (ida)`;
  }

  // --------------------
  // Bind buttons
  // --------------------
  if (btnCalc) {
    btnCalc.addEventListener('click', async () => {
      btnCalc.disabled = true;
      try { await calcularRotaWorkflow(); } finally { btnCalc.disabled = false; }
    });
  } else console.warn("btnCalculate ausente no DOM");

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      try { if (marcadorB) mapa.removeLayer(marcadorB); } catch(e){}
      marcadorB = null; pontoB = null;
      try { if (linha) mapa.removeLayer(linha); } catch(e){}
      linha = null;
      try { if (drone) drone.removeFrom(mapa); } catch(e){}
      drone = L.marker(pontoA, { icon: droneIcon }).addTo(mapa); // reposiciona drone na base
      if (elPb) elPb.value = "";
      if (elMr) elMr.value = "";
      // reset bateria opcional:
      droneBateriaAtualKm = droneBateriaMaxKm;
    });
  } else console.warn("btnReset ausente no DOM");

  // mapa click: define destino
  mapa.on('click', (e) => {
    if (marcadorB) { try{ mapa.removeLayer(marcadorB); } catch(e){} marcadorB = null; pontoB = null; }
    const dist = mapa.distance(pontoA, e.latlng);
    if (dist > 10000) { alert("Destino fora do raio máximo (10 km)."); return; }
    marcadorB = L.marker(e.latlng).addTo(mapa).bindPopup('📦 Destino').openPopup();
    setTimeout(()=>{ try{ marcadorB.closePopup(); } catch(e){} }, 1500);
    pontoB = e.latlng;
    if (elPb) elPb.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });

  // carregar fixos silencioso (já desenhados acima)
}); // end DOMContentLoaded

// ---------- Fim do script ----------
