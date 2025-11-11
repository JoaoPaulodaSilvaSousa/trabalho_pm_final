import heapq
import itertools
import os
import csv
import time  

# Lê o arquivo CSV com as distâncias entre os pontos e cria um grafo (dicionário)

def carregar_grafo(caminho_arquivo):
    try:
        if not os.path.exists(caminho_arquivo):
            print(f"Erro: Arquivo '{caminho_arquivo}' não encontrado.")
            return None

        grafo = {}
        with open(caminho_arquivo, newline='') as csvfile:
            leitor = csv.reader(csvfile)
            cabecalho = next(leitor)[1:]  # Pega os nomes dos pontos (A, B, C...)

            for linha in leitor:
                if not linha:  
                    continue
                ponto = linha[0]
                grafo[ponto] = {}
                i = 0
                for valor in linha[1:]:
                    if valor:
                        grafo[ponto][cabecalho[i]] = float(valor)
                    i += 1
        return grafo
    except FileNotFoundError:
        print("Erro: Arquivo não encontrado.")
        return None
    except Exception as e:
        print(f"Erro ao carregar o grafo: {e}")
        return None

# Calcula o menor caminho entre dois pontos (início → destino)

def dijkstra(grafo, inicio, destino):
    try:
        distancias = {no: float('inf') for no in grafo}  # Inicializa todas as distâncias como infinito
        distancias[inicio] = 0
        caminho = {inicio: None}

        fila = [(0, inicio)]  # Fila de prioridade (menor distância primeiro)

        while fila:
            dist_atual, no_atual = heapq.heappop(fila)

            if no_atual == destino:
                break  # Se chegou ao destino, termina

            for vizinho in grafo[no_atual]:
                peso = grafo[no_atual][vizinho]
                nova_dist = dist_atual + peso
                if nova_dist < distancias[vizinho]:
                    distancias[vizinho] = nova_dist
                    caminho[vizinho] = no_atual
                    heapq.heappush(fila, (nova_dist, vizinho))

        # Reconstrói o caminho percorrido
        rota = []
        atual = destino
        while atual is not None:
            rota.insert(0, atual)
            atual = caminho.get(atual)

        return rota, distancias[destino]
    except KeyError as e:
        print(f"Erro: ponto inválido no grafo ({e}).")
        return [], float('inf')
    except Exception as e:
        print(f"Erro durante execução do Dijkstra: {e}")
        return [], float('inf')

# Testa todas as rotas possíveis entre os destinos e retorna a menor

def forca_bruta(grafo, base, destinos):
    try:
        menor_distancia = float('inf')
        melhor_rota = []

        # Tenta todas as combinações possíveis de destinos
        for perm in itertools.permutations(destinos):
            rota = [base] + list(perm) + [base]
            distancia_total = 0

            # Soma as distâncias de cada trecho
            j = 0
            while j < len(rota) - 1:
                distancia_total += grafo[rota[j]][rota[j + 1]]
                j += 1

            if distancia_total < menor_distancia:
                menor_distancia = distancia_total
                melhor_rota = rota

        return melhor_rota, menor_distancia
    except KeyError as e:
        print(f"Erro: ponto inválido no cálculo da rota ({e}).")
        return [], float('inf')
    except Exception as e:
        print(f"Erro na força bruta: {e}")
        return [], float('inf')


#Função Principal
def main():
    try:
        grafo = carregar_grafo("templates/distancias.csv")
        if not grafo:
            return

        print("Grafo carregado com sucesso!\n")
        print("Escolha uma das opções abaixo:\n")
        print("1 - Calcular rota ideal (força bruta)")
        print("2 - Calcular menor caminho entre dois pontos (Dijkstra)\n")

        opcao = input("Digite a opção desejada: ")

        # Opção 1 → Rota completa (força bruta)
        
        if opcao == "1":
            base = input("Digite o nome da base:")
            base = ''.join(base.split())  
            try:
                limite_bateria = float(input("Informe o limite de bateria (em km): "))
            except ValueError:
                print("Erro: valor inválido para limite de bateria.")
                return

            if base not in grafo:
                print("Erro: Base inválida!")
                return

            destinos = [p for p in grafo.keys() if p != base]

            print("\nCalculando rotas ideais...\n")

            rota_bruta, dist_bruta = forca_bruta(grafo, base, destinos)

            # Calcula um exemplo com Dijkstra: base até o primeiro destino
            destino_teste = destinos[0]
            rota_dijkstra, dist_dijkstra = dijkstra(grafo, base, destino_teste)

            print("\n================= RESULTADOS =================")
            print(f"Rota ideal (força bruta): {' → '.join(rota_bruta)}")
            print(f"Distância total: {dist_bruta:.2f} km")

            print("\nMenor trajeto (Dijkstra)")
            print(f"De {base} até {destino_teste}: {' → '.join(rota_dijkstra)}")
            print(f"Distância: {dist_dijkstra:.2f} km")

            if dist_bruta <= limite_bateria:
                print("Status: dentro do limite de bateria")
            else:
                print("Alerta: rota excede o limite de bateria!")
                print(f"Distância excedida: {dist_bruta - limite_bateria:.2f} km")
            print("=============================================\n")

        # Opção 2 → Caminho entre dois pontos (Dijkstra)
        
        elif opcao == "2":
            inicio = input("Digite o ponto inicial:")
            destino = input("Digite o ponto final:")
            inicio = ''.join(inicio.split())
            destino = ''.join(destino.split())

            if inicio not in grafo or destino not in grafo:
                print("Erro: Um dos pontos informados não existe no grafo.")
                return

            rota, distancia = dijkstra(grafo, inicio, destino)
            print("\n================ RESULTADO ================")
            print(f"Ponto inicial: {inicio}")
            print(f"Ponto final: {destino}")
            print(f"Rota: {' → '.join(rota)}")
            print(f"Distância total: {distancia:.2f} km")
            print("===========================================\n")

        else:
            print("Opção inválida. Encerrando o programa.")
    except KeyboardInterrupt:
        print("\nExecução interrompida pelo usuário.")
    except Exception as e:
        print(f"Erro inesperado: {e}")

if __name__ == "__main__":
    main()
