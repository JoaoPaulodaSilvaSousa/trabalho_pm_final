from flask import Flask, render_template, request, jsonify
import math
import itertools

app = Flask(__name__, static_folder="static", template_folder="templates")

# -------------------------------------------------------------
# 🔵 OBSTÁCULOS NATIVOS (APARECEM NO MAPA AUTOMATICAMENTE)
# -------------------------------------------------------------
OBSTACULOS_POLIGONOS = [
    [
        {"lat": -23.5510, "lng": -46.6333},
        {"lat": -23.5520, "lng": -46.6325},
        {"lat": -23.5530, "lng": -46.6335},
        {"lat": -23.5510, "lng": -46.6333}
    ]
]

# círculo convertido em polígono
def gerar_circulo(lat, lng, raio_m, passos=36):
    pts = []
    R = 6371000
    for i in range(passos + 1):
        ang = math.radians(i * (360 / passos))
        dlat = (raio_m / R) * math.cos(ang)
        dlng = (raio_m / (R * math.cos(math.radians(lat)))) * math.sin(ang)
        pts.append({"lat": lat + math.degrees(dlat), "lng": lng + math.degrees(dlng)})
    pts.append(pts[0])
    return pts

OBSTACULOS_CIRCULOS = [
    gerar_circulo(-23.5505, -46.6340, 120)   # círculo de 120m
]

OBSTACULOS = OBSTACULOS_POLIGONOS + OBSTACULOS_CIRCULOS

# -------------------------------------------------------------
# 🔵 Distância
# -------------------------------------------------------------
def haversine_km(p1, p2):
    R = 6371.0
    lat1 = math.radians(p1["lat"])
    lon1 = math.radians(p1["lng"])
    lat2 = math.radians(p2["lat"])
    lon2 = math.radians(p2["lng"])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

# -------------------------------------------------------------
# 🔵 Interseção segmento ↔ polígono
# -------------------------------------------------------------
def intersecao_segmento_poligono(A, B, poligono):

    def ccw(A, B, C):
        return (C["lat"] - A["lat"]) * (B["lng"] - A["lng"]) > (B["lat"] - A["lat"]) * (C["lng"] - A["lng"])

    def intersect(A, B, C, D):
        return ccw(A, C, D) != ccw(B, C, D) and ccw(A, B, C) != ccw(A, B, D)

    for i in range(len(poligono) - 1):
        C = poligono[i]
        D = poligono[i+1]
        if intersect(A, B, C, D):
            return True
    return False

# -------------------------------------------------------------
# 🔵 Grafo com bloqueio automático de trechos proibidos
# -------------------------------------------------------------
def construir_grafo(pontos):
    grafo = {str(i): {} for i in range(len(pontos))}

    for i in range(len(pontos)):
        for j in range(len(pontos)):
            if i == j:
                continue

            A, B = pontos[i], pontos[j]

            proibido = any(intersecao_segmento_poligono(A, B, obs) for obs in OBSTACULOS)

            if proibido:
                continue

            grafo[str(i)][str(j)] = haversine_km(A, B)

    return grafo

# -------------------------------------------------------------
# 🔵 Força bruta — respeitando obstáculos
# -------------------------------------------------------------
def forca_bruta(grafo, base, destinos):
    menor = float("inf")
    melhor = None

    for perm in itertools.permutations(destinos):
        rota = [base] + list(perm) + [base]
        dist = 0
        ok = True

        for i in range(len(rota)-1):
            a, b = rota[i], rota[i+1]
            if b not in grafo.get(a, {}):
                ok = False
                break
            dist += grafo[a][b]

        if ok and dist < menor:
            menor = dist
            melhor = rota

    return melhor, menor

# -------------------------------------------------------------
# 🔵 Rotas Flask
# -------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/calcular_rota", methods=["POST"])
def calcular_rota():
    data = request.get_json() or {}
    pontos = data.get("pontos") or []

    if len(pontos) < 2:
        return jsonify({"status":"erro", "mensagem":"Envie pelo menos 2 pontos (base + 1 destino)."}), 400

    grafo = construir_grafo(pontos)
    base = "0"
    destinos = [str(i) for i in range(1, len(pontos))]

    rota, dist = forca_bruta(grafo, base, destinos)

    if not rota:
        return jsonify({"status":"erro", "mensagem":"Nenhuma rota possível sem atravessar obstáculos."}), 400

    rota_convertida = [pontos[int(i)] for i in rota]

    # converte obstáculos para lista de listas de [lat,lng] para o frontend desenhar
    obst_front = []
    for pol in OBSTACULOS:
        obst_front.append([[p["lat"], p["lng"]] for p in pol])

    return jsonify({
        "status": "ok",
        "rota": rota_convertida,
        "distancia_km": round(dist, 4),
        "obstaculos": obst_front
    })

if __name__ == "__main__":
    app.run(debug=True)
