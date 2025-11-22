let droneBateriaMaxKm = 20;
let droneBateriaAtualKm = droneBateriaMaxKm;
const droneSpeedKmh = 60;
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";

const basesDrone = [
    { nome: 'Base Central (A1)', latlng: L.latLng(-23.5505, -46.6333), raioMaxKm: 10, altMeters: 750 }, // Paulista
    { nome: 'Base Norte (A2)', latlng: L.latLng(-23.498, -46.65), raioMaxKm: 10, altMeters: 780 },       // Santana/Tucuruvi
    { nome: 'Base Sul (A3)', latlng: L.latLng(-23.63, -46.69), raioMaxKm: 10, altMeters: 730 },         // Santo Amaro
    { nome: 'Base Leste (A4)', latlng: L.latLng(-23.54, -46.54), raioMaxKm: 10, altMeters: 710 }         // Tatuapé
];
const RAIO_MAXIMO_PADRAO = 10;

function distance3D(a, b, za = 0, zb = 0) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const sa = Math.sin(dLat / 2), sb = Math.sin(dLon / 2);
  const aa = sa * sa + Math.cos(lat1) * Math.cos(lat2) * sb * sb;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  
  const distHorizontalKm = R * c;
  
  const dzKm = Math.abs(za - zb) / 1000;
  
  const dist3DKm = Math.sqrt(distHorizontalKm * distHorizontalKm + dzKm * dzKm);
  
  return dist3DKm;
}

function haversineKm(a, b) {
  return distance3D(a, b, 0, 0);
}


function calcularDistanciaRotaKm(rota, baseA, pontoB) {
  if (!rota || rota.length < 2) return 0;
  let soma = 0;
  const baseStart = baseA;
  const destinoEnd = pontoB;
  
  const finalAltMeters = destinoEnd && destinoEnd.altMeters !== undefined 
    ? destinoEnd.altMeters 
    : baseStart.altMeters + 100;
    
  function getAltitude(idx, path) {
    if (idx === 0) return baseStart.altMeters;
    if (idx === path.length - 1) return finalAltMeters;
    
    const startZ = baseStart.altMeters;
    const endZ = finalAltMeters;
    const fraction = idx / (path.length - 1);
    return startZ + (endZ - startZ) * fraction;
  }

  for (let i = 0; i < rota.length - 1; i++) {
    const a = rota[i], b = rota[i+1];
    
    const pa = (typeof a.lat === 'function') ? { lat: a.lat(), lng: a.lng() } : { lat: a.lat, lng: a.lng || a.lon };
    const pb = (typeof b.lat === 'function') ? { lat: b.lat(), lng: b.lng() } : { lat: b.lat, lng: b.lng || b.lon };
    
    const za = getAltitude(i, rota);
    const zb = getAltitude(i + 1, rota);
    
    soma += distance3D(pa, pb, za, zb);
  }
  return soma;
}


function consumirBateria(distanciaKm) {
  if (distanciaKm > droneBateriaAtualKm) {
    return { ok:false, restante: droneBateriaAtualKm, mensagem: `❌ BATERIA INSUFICIENTE\nDistância necessária: ${distanciaKm.toFixed(3)} km\nBateria disponível: ${droneBateriaAtualKm.toFixed(3)} km` };
  }
  droneBateriaAtualKm = Math.max(0, droneBateriaAtualKm - distanciaKm);
  return { ok:true, restante: droneBateriaAtualKm, mensagem: `✔ BATERIA OK\nDistância consumida: ${distanciaKm.toFixed(3)} km\nBateria restante: ${droneBateriaAtualKm.toFixed(3)} km` };
}

function recarregarBateria(){ droneBateriaAtualKm = droneBateriaMaxKm; }

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchOsrmDurationFromCoords(coordsArray) {

  if (!coordsArray || coordsArray.length < 2) return null;

  const start = coordsArray[0], end = coordsArray[coordsArray.length-1];
  const coordsStr = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `${OSRM_BASE}${coordsStr}?overview=false&geometries=geojson&alternatives=false&steps=false`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("OSRM error " + resp.status);
    const j = await resp.json();
    if (j && j.routes && j.routes.length > 0) {
      return j.routes[0].duration;
    }
    return null;
  } catch (e){
    console.warn("OSRM fetch failed:", e);
    return null;
  }
}

function formatSecondsToHms(totalSeconds) {
  if (totalSeconds === null || isNaN(totalSeconds)) return "N/A";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = [];
  if (h > 0) parts.push(h + 'h');
  if (m > 0 || h > 0) parts.push(m + 'min');
  parts.push(s + 's');
  return parts.join(' ');
}

function encontrarMelhorBase(pontoDestino) {
    let melhorBase = null;
    let menorDistancia = Infinity;

    basesDrone.forEach(base => {
        const distanciaKm = haversineKm(base.latlng, pontoDestino);
        
        // Verifica se a base está dentro do raio máximo
        if (distanciaKm <= base.raioMaxKm) {
            if (distanciaKm < menorDistancia) {
                menorDistancia = distanciaKm;
                melhorBase = base;
            }
        }
    });

    return melhorBase;
}


document.addEventListener("DOMContentLoaded", () => {
  const elPa = document.getElementById('pa');
  const elPb = document.getElementById('pb');
  const elMr = document.getElementById('mr');
  const btnCalc = document.getElementById('btnCalculate');
  const btnReset = document.getElementById('btnReset');
  const precisionSelect = document.getElementById('precisionSelect');

  if (elPa) elPa.value = basesDrone[0].nome;
  if (elPb) elPb.value = elPb.value || "";
  if (elMr) elMr.value = elMr.value || "";

  const droneIcon = L.icon({ iconUrl: '/static/drone.webp', iconSize: [40,40], iconAnchor: [20,20] });
  const baseIcon  = L.icon({ iconUrl: '/static/base.avif', iconSize: [35,35], iconAnchor: [17,35] });

  const mapa = L.map('mapa').setView(basesDrone[0].latlng, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapa);

  let pontoA = basesDrone[0].latlng; // Base de partida ATUAL (será atualizada ao clicar)
  let pontoB = null;
  
  // Lista para guardar todos os marcadores de base
  const baseMarkers = []; 
  let marcadorB = null;
  let drone = L.marker(pontoA, { icon: droneIcon }).addTo(mapa);
  let linha = null;
  let fixedLayers = [];
  let animationFrameId = null;
  let rotaCalculada = false;
  let STEP_METERS = 50;

  // Desenha todas as bases no mapa
  basesDrone.forEach(base => {
    const marcador = L.marker(base.latlng, { icon: baseIcon }).addTo(mapa);
    marcador.bindPopup(`📍 ${base.nome} (Raio máx: ${base.raioMaxKm} km, Alt: ${base.altMeters}m)`);
    baseMarkers.push(marcador);
    
    // Desenha um círculo de alcance para cada base
    L.circle(base.latlng, { 
      radius: base.raioMaxKm * 1000, 
      color: 'green', 
      fillColor: '#80ff80', 
      fillOpacity: 0.1 
    }).addTo(mapa);
  });

  // Abre o popup da Base Central para dar um destaque inicial
  baseMarkers[0].openPopup();
  setTimeout(()=>{ try{ baseMarkers[0].closePopup(); } catch(e){} }, 2000);


  const obstaculosFixos = []; 

  const circulosFixos = []; 

  function desenharFixos() {
    try {
      obstaculosFixos.forEach(coords => {
        const poly = L.polygon(coords, { color:"red", fillColor:"red", fillOpacity:0.35, weight:1 }).addTo(mapa);
        fixedLayers.push(poly);
      });
    } catch(e){ console.warn(e); }
    try {
      circulosFixos.forEach(c => {
        const circle = L.circle([c.lat, c.lng], { radius:c.raio, color:"purple", fillColor:"purple", fillOpacity:0.3 }).addTo(mapa);
        fixedLayers.push(circle);
      });
    } catch(e){ console.warn(e); }
  }
  desenharFixos();
  function getAllObstacleLayers(){ return fixedLayers || []; }

  function estaDentroDeObstaculo(node, obsLayers) {
    if (!obsLayers || obsLayers.length === 0) return false;

    const pt = turf.point([node.lng, node.lat]);
    for (let layer of obsLayers) {
      try {
        if (typeof layer.getRadius === 'function' && typeof layer.getLatLng === 'function') {
          const center = layer.getLatLng();
          const radiusMeters = layer.getRadius();
          const circ = turf.circle([center.lng, center.lat], radiusMeters / 1000, { steps:36, units:'kilometers' });
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

        const dkm = haversineKm(a, b) * 1000;
        if (dkm <= stepMetersApprox * 1.6) adj[a.id].push({ id: b.id, cost: dkm });
      }
    }
    return adj;
  }

  // Implementação do DIJKSTRA
  function dijkstraIds(startId, goalId, nodesMap, adj) {
    const dist = {}, prev = {}, Q = new Set(Object.keys(nodesMap));
    for (let id in nodesMap) { dist[id] = Infinity; prev[id] = null; }
    dist[startId] = 0;
    while (Q.size > 0) {
      let u = null, best = Infinity;
      for (let id of Q) if (dist[id] < best) { best = dist[id]; u = id; }
      if (u === null) break;
      Q.delete(u);
      if (u === goalId) break;
      const neighbors = adj[u] || [];
      for (let nb of neighbors) {
        if (!Q.has(nb.id)) continue;
        const alt = dist[u] + nb.cost;
        if (alt < dist[nb.id]) { dist[nb.id] = alt; prev[nb.id] = u; }
      }
    }
    if (prev[goalId] === null && startId !== goalId) return null;
    const pathIds = []; let cur = goalId;
    while (cur) { pathIds.unshift(cur); if (cur === startId) break; cur = prev[cur]; }
    return pathIds;
  }

  function nearestNodeIdToPoint(pt, nodesList) {
    let best = null, bestD = Infinity;
    for (let n of nodesList) {
      const d = haversineKm(pt, { lat: n.lat, lng: n.lng }) * 1000;
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return best;
  }

  // CALCULAR ROTA COM DIJKSTRA (retorna array L.LatLng ou null)
  async function calcularRotaDijkstra(A, B, STEP_METERS_local = 50, animate = true) {
    const nodesAll = gerarGridEntre(A, B, STEP_METERS_local, 80);
    const allObstacles = getAllObstacleLayers();
    
    const nodesFiltrados = nodesAll.filter(n => !estaDentroDeObstaculo(n, allObstacles));
    
    if (nodesFiltrados.length < 8) { console.warn("Nós insuficientes para Dijkstra"); return null; }
    const nodesMap = {}; nodesFiltrados.forEach(n => nodesMap[n.id] = n);
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
    // A linha azul pontilhada para desvio de obstáculos (agora será a rota mais direta no grid)
    linha = L.polyline(path, { color:'blue', weight:3, dashArray:'6 4' }).addTo(mapa);
    
    const baseA_obj = basesDrone.find(b => b.latlng.equals(A)) || { altMeters: 0 };
    if (!animate) {
      if (elMr) elMr.value = `Melhor rota calculada. Distância estimada: ${(calcularDistanciaRotaKm(path, baseA_obj, B)).toFixed(3)} km (3D)`;
    }
    return path;
  }

  // anima drone (posiciona marker "drone" e move ao longo do path com duração total em segundos)
  // também atualiza o ETA box (criado abaixo)
  function animatePathWithDuration(path, totalSeconds) {
    if (!path || path.length < 2) return Promise.resolve();
    
    // Cancelar qualquer animação anterior antes de iniciar uma nova
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // calcular comprimentos por segmento
    const segLen = [];
    let totalMeters = 0;
    for (let i=0;i<path.length-1;i++) {
      const d = mapa.distance(path[i], path[i+1]); segLen.push(d); totalMeters += d;
    }
    // criar/atualizar caixa ETA
    let etaBox = document.getElementById('etaBox');
    if (!etaBox) {
      etaBox = L.DomUtil.create('div', 'eta-box');
      etaBox.id = 'etaBox';
      etaBox.style.cssText = "background:rgba(0,0,0,0.7);color:white;padding:8px;border-radius:6px;font-size:14px;";
      const ctrl = L.control({position:'topright'});
      ctrl.onAdd = () => etaBox;
      ctrl.addTo(mapa);
    }
    // set initial drone marker at path[0]
    try { if (drone) drone.removeFrom(mapa); } catch(e){}
    drone = L.marker(path[0], { icon: droneIcon }).addTo(mapa);

    return new Promise(resolve => {
      const startT = performance.now();
      function step(now) {
        const elapsed = (now - startT) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);
        // atualização do ETA display
        const mins = Math.floor(remaining/60), secs = Math.floor(remaining%60);
        etaBox.innerHTML = `<b>ETA:</b> ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} (voando)`;
        if (elapsed >= totalSeconds) {

          drone.setLatLng(path[path.length-1]);
          etaBox.innerHTML = `<b>ETA:</b> 00:00 (chegou)`;
          setTimeout(()=>{ try{ mapa.removeControl(mapa._controls.find(c=>c._container && c._container.id === 'etaBox')); }catch(e){} }, 5000);
          animationFrameId = null; // Zera o ID ao terminar
          resolve();
          return;
        }

        const fraction = elapsed / totalSeconds;
        const traveledMeters = totalMeters * fraction;
        let acc = 0, idx = 0;
        while (idx < segLen.length && acc + segLen[idx] < traveledMeters) {
          acc += segLen[idx]; idx++;
        }

        if (idx >= segLen.length) {
          drone.setLatLng(path[path.length-1]);
          animationFrameId = null; 
          return;
        }
        const segStart = path[idx], segEnd = path[idx+1];
        const segDistance = segLen[idx];
        const segTraveled = traveledMeters - acc;
        const segFrac = segDistance === 0 ? 0 : (segTraveled / segDistance);
        const lat = segStart.lat + (segEnd.lat - segStart.lat) * segFrac;
        const lng = segStart.lng + (segEnd.lng - segStart.lng) * segFrac;
        drone.setLatLng([lat, lng]);
        
        animationFrameId = requestAnimationFrame(step);
      }
      animationFrameId = requestAnimationFrame(step);
    });
  }
  
  // NOVA FUNÇÃO: Anima a transição do drone para a nova base (ponto A)
  function animateDroneToNewBase(newBaseLatLng) {
    return new Promise(resolve => {
      if (!drone) { resolve(); return; }
      
      const currentPos = drone.getLatLng();
      if (currentPos.equals(newBaseLatLng)) { resolve(); return; }
      
      const totalDistance = mapa.distance(currentPos, newBaseLatLng);
      // Define a duração da animação (ex: 1 segundo a cada 10km de distância)
      const durationSeconds = Math.min(2, totalDistance / 10000); // Max 2s

      const startTime = performance.now();
      
      const animate = (time) => {
        const elapsed = time - startTime;
        const fraction = Math.min(1, elapsed / (durationSeconds * 1000));
        
        const lat = currentPos.lat + (newBaseLatLng.lat - currentPos.lat) * fraction;
        const lng = currentPos.lng + (newBaseLatLng.lng - currentPos.lng) * fraction;
        
        drone.setLatLng([lat, lng]);
        
        if (fraction < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve(); // Animação concluída
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  // rotaBloqueada (checa interseção linha direta com obstáculos)
  function rotaBloqueada(A,B) {
    const line = turf.lineString([[A.lng, A.lat], [B.lng, B.lat]]);
    const allObstacles = getAllObstacleLayers();
    
    for (let poly of allObstacles) {
      try {
        if (typeof poly.getRadius === 'function' && typeof poly.getLatLng === 'function') {
          const center = poly.getLatLng();
          const radiusMeters = poly.getRadius();
          const circ = turf.circle([center.lng, center.lat], radiusMeters / 1000, { steps:36, units:'kilometers' });
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
      } catch(e){ continue; }
    }
    return false;
  }
  
  // Calcula e exibe a estimativa de tempo (ETA) inicial no popup
  async function updateDestinationPopupWithEta(latlng, baseA) {
    const baseA_obj = basesDrone.find(b => b.latlng.equals(baseA)) || { altMeters: 0, nome: 'Base Desconhecida' };
    
    // 1. Calcular distância 3D da base selecionada para o popup
    const distanciaKm = distance3D(baseA_obj.latlng, latlng, baseA_obj.altMeters, baseA_obj.altMeters + 100); // Simula 100m de subida
    const roundTripKm = distanciaKm * 2;
    const nomeBase = baseA_obj.nome;
    
    // 2. Tentar obter a duração OSRM (apenas ida)
    let osrmDurationSec = await fetchOsrmDurationFromCoords([baseA, latlng]);
    let tempoEstimadoStr = "Calculando...";
    
    if (osrmDurationSec !== null) {
      tempoEstimadoStr = formatSecondsToHms(osrmDurationSec);
    } else {
      // Fallback: usar velocidade fixa (droneSpeedKmh)
      tempoEstimadoStr = formatSecondsToHms((distanciaKm / droneSpeedKmh) * 3600) + " (aprox.)";
    }

    // 3. Checar Bateria (usando a variável atual, mas sem consumir)
    let bateriaStatus = "Bateria: OK (ida/volta)";
    if (roundTripKm > droneBateriaAtualKm) {
        const faltaKm = roundTripKm - droneBateriaAtualKm;
        bateriaStatus = `⚠️ Bateria insuficiente. Faltam ${faltaKm.toFixed(2)} km.`;
    }

    // 4. Montar o conteúdo do popup
    const popupContent = `
      <b>📦 Destino</b><br>
      Base de Partida: <b>${nomeBase}</b><br>
      Distância (3D direta): ${distanciaKm.toFixed(2)} km<br>
      Tempo estimado (ida): ${tempoEstimadoStr}<br>
      ${bateriaStatus}<br>
      <hr style="margin: 4px 0;">
      <i>Clique em 'Calcular Rota' para iniciar.</i>
    `;
    
    // 5. Atualizar ou abrir o popup do marcador B
    if (marcadorB) {
      marcadorB.bindPopup(popupContent);
      // Se o popup estiver aberto, ele será atualizado e reaberto.
      if(marcadorB._popup && marcadorB._map && marcadorB.isPopupOpen()) {
          marcadorB.openPopup();
      }
    }
  }


  // WORKFLOW principal (Dijkstra visual + OSRM tempo real + ETA)
  async function calcularRotaWorkflow() {
    if (!pontoB) { alert("Defina o destino no mapa primeiro (clique)."); return; }
    
    // Fecha o popup do destino
    if (marcadorB) {
        try { marcadorB.closePopup(); } catch(e) { console.warn("Erro ao fechar popup do marcador B:", e); }
    }
    
    const precSelVal = precisionSelect ? parseInt(precisionSelect.value || '50', 10) : 50;
    STEP_METERS = isNaN(precSelVal) ? 50 : precSelVal;

    const metersPerPercentInput = parseFloat((elMr && elMr.value) ? elMr.value : NaN);
    const metersPerPercent = (isFinite(metersPerPercentInput) && metersPerPercentInput > 0)
      ? metersPerPercentInput
      : (droneBateriaMaxKm * 1000 / 100);
      
    // Usa a base ATUAL (pontoA) que foi definida no clique
    const baseDePartida = basesDrone.find(b => b.latlng.equals(pontoA));
    const baseNome = baseDePartida.nome || 'Base Selecionada';


    const pathCalc = await calcularRotaDijkstra(baseDePartida.latlng, pontoB, STEP_METERS, false);
    if (!pathCalc) {
      alert("Não foi possível calcular rota com Dijkstra. Tente mudar a precisão.");
      if (elMr) elMr.value = "Falha ao calcular rota (Dijkstra).";
      return;
    }

    // Passa a base e o destino para o cálculo da distância 3D
    const distanciaKm = calcularDistanciaRotaKm(pathCalc, baseDePartida, pontoB); 
    const roundTripKm = distanciaKm * 2;

    let osrmSeconds = await fetchOsrmDurationFromCoords(pathCalc);
    if (!osrmSeconds) osrmSeconds = (distanciaKm / droneSpeedKmh) * 3600;

    if (roundTripKm > droneBateriaAtualKm) {
      const consumoPercent = ( (distanciaKm*2*1000) / metersPerPercent );
      const mensagem = `🔴 Bateria insuficiente para ida e volta na rota (Dijkstra - Partida: ${baseNome}).\n\n` +
                       `Rota (ida) estimada: ${distanciaKm.toFixed(3)} km (3D)\n` +
                       `Ida + Volta: ${roundTripKm.toFixed(3)} km\n` +
                       `Bateria disponível: ${droneBateriaAtualKm.toFixed(3)} km\n\n` +
                       `Consumo estimado: ${consumoPercent.toFixed(2)}%`;
      marcadorB.bindPopup(`<pre>${mensagem}</pre>`).openPopup();
      if (elMr) elMr.value = `Rota de desvio calculada — ${ (distanciaKm).toFixed(3) } km (ida 3D) da ${baseNome}`;
      rotaCalculada = true; // Define a flag mesmo com erro de bateria, pois o cálculo foi feito
      return;
    }

    // anima seguindo o PATH Dijkstra (visual), mas usando osrmSeconds para tempo total
    await animatePathWithDuration(pathCalc, osrmSeconds);

    // consumir bateria (apenas ida)
    consumirBateria(distanciaKm);

    // volta e recarrega
    recarregarBateria();

    const consumoPercentFinal = ( (distanciaKm*2*1000) / metersPerPercent );
    const mensagemOk = `✅ Rota calculada (Dijkstra - Partida: ${baseNome})\n\nIda: ${distanciaKm.toFixed(3)} km (3D)\nIda + Volta: ${roundTripKm.toFixed(3)} km\nBateria (após recarga): ${droneBateriaAtualKm.toFixed(3)} km\n\nConsumo estimado: ${consumoPercentFinal.toFixed(2)}%`;
    marcadorB.bindPopup(`<pre>${mensagemOk}</pre>`).openPopup();
    if (elMr) elMr.value = `Rota calculada — ${ (distanciaKm).toFixed(3) } km (ida 3D) da ${baseNome}`;
    rotaCalculada = true; // Define a flag ao sucesso
  }

  if (btnCalc) {
    btnCalc.addEventListener('click', async () => {
      btnCalc.disabled = true;
      try { await calcularRotaWorkflow(); } finally { btnCalc.disabled = false; }
    });
  } else console.warn("btnCalculate ausente no DOM");

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      // Cancela a animação
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      try { if (marcadorB) mapa.removeLayer(marcadorB); } catch(e){}
      marcadorB = null; pontoB = null;
      try { if (linha) mapa.removeLayer(linha); } catch(e){}
      linha = null;
      try { if (drone) drone.removeFrom(mapa); } catch(e){}
      
      // Garante que o drone retorne à base central (inicial)
      pontoA = basesDrone[0].latlng; 
      drone = L.marker(pontoA, { icon: droneIcon }).addTo(mapa);
      
      if (elPa) elPa.value = basesDrone[0].nome; // Atualiza o nome da base no input
      if (elPb) elPb.value = "";
      if (elMr) elMr.value = "";
      droneBateriaAtualKm = droneBateriaMaxKm;
      rotaCalculada = false; // Reset da flag de bloqueio
      
      // Reativa o botão de calcular
      if (btnCalc) btnCalc.disabled = false; 

      // remove ETA box
      const el = document.getElementById('etaBox'); if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  } else console.warn("btnReset ausente no DOM");

  // mapa click: define destino
  mapa.on('click', async (e) => { // MUDANÇA: Adicionado 'async' para esperar a animação
    // Bloqueio: Verifica se já houve um cálculo
    if (rotaCalculada) {
        alert("A rota já foi calculada! Por favor, clique no botão 'RESETAR' para iniciar um novo cálculo.");
        return;
    }
    
    // 1. Encontrar a melhor base
    const destinoLatLng = e.latlng;
    const melhorBase = encontrarMelhorBase(destinoLatLng);

    if (!melhorBase) {
        alert(`Destino fora do raio de alcance de todas as bases (máximo ${RAIO_MAXIMO_PADRAO} km).`);
        return;
    }
    
    // 2. Armazena a nova base
    const novaBaseLatLng = melhorBase.latlng;
    
    // 3. Anima o drone até a nova base *antes* de atualizar o ponto A
    if (!pontoA.equals(novaBaseLatLng)) {
        // Espera a animação do drone para a nova base
        await animateDroneToNewBase(novaBaseLatLng);
    }
    
    // 4. Atualizar o Ponto A para a base mais próxima
    pontoA = novaBaseLatLng; 
    if (elPa) elPa.value = melhorBase.nome; 
    
    // 5. Remover e adicionar o marcador B
    if (marcadorB) { try{ mapa.removeLayer(marcadorB); } catch(e){} marcadorB = null; pontoB = null; }
    
    pontoB = destinoLatLng;
    
    // 6. Criar marcador B e abrir o popup
    marcadorB = L.marker(pontoB).addTo(mapa).bindPopup('📦 Destino (Estimando...)').openPopup();
    
    // 7. Mostrar coordenadas no input
    if (elPb) elPb.value = `${destinoLatLng.lat.toFixed(5)}, ${destinoLatLng.lng.toFixed(5)}`;

    // 8. Imediatamente iniciar o cálculo de estimativa e atualizar o popup (usando a nova base)
    updateDestinationPopupWithEta(pontoB, pontoA);
  });

});