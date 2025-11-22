from flask import Flask, render_template, request, jsonify
import math

app = Flask(__name__, static_folder="static", template_folder="templates")

# OBSTÁCULOS NATIVOS (APARECEM NO MAPA AUTOMATICAMENTE)
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
    gerar_circulo(-23.5505, -46.6340, 120)  # círculo de 120m
]

OBSTACULOS = OBSTACULOS_POLIGONOS + OBSTACULOS_CIRCULOS

# Rotas Flask
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/calcular_rota", methods=["POST"])
def calcular_rota():
    
    # Converte obstáculos do formato [{lat:X, lng:Y}] para [[lat,lng]] para o frontend
    obst_front = []
    for pol in OBSTACULOS:
        obst_front.append([[p["lat"], p["lng"]] for p in pol])

    return jsonify({
        "status": "ok",
        "mensagem": "Obstáculos fixos retornados para o frontend.",
        "obstaculos": obst_front
    })

if __name__ == "__main__":
    app.run(debug=True)