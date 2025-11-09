from flask import Flask, render_template, request, jsonify
import math

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/calcular_rota', methods=['POST'])
def calcular_rota():
    data = request.get_json()
    pontoA = data['pontoA']
    pontoB = data['pontoB']

    # 🔹 Aqui você colocaria sua lógica de Dijkstra real.
    # Por enquanto, vamos simular uma distância simples:
    distancia = math.sqrt((pontoB['x'] - pontoA['x'])**2 + (pontoB['y'] - pontoA['y'])**2)

    # Simulando uma “rota” simples (A -> B)
    rota = [pontoA, pontoB]

    return jsonify({
        'distancia': round(distancia, 2),
        'rota': rota
    })

if __name__ == '__main__':
    app.run(debug=True)