DroneXpress – Sistema de Otimização de Rotas de Entrega por Drone

Contexto:

A startup DroneXpress realiza entregas rápidas com drones em uma cidade pequena. Cada drone parte de uma base principal e precisa entregar pacotes em vários pontos.

O objetivo do sistema é calcular automaticamente a ordem ideal das entregas, garantindo que o drone voe a menor distância possível e retorne à base dentro do limite de bateria.

Problema:

Dada uma matriz de distâncias entre a base e os pontos de entrega, o sistema deve gerar uma rota que:

1. Comece na base,


2. Visite um ou mais destinos,


3. Retorne à base,


4. Respeite o limite de autonomia do drone (bateria).


Passos do Projeto:

Passo 1 – Preparar os dados

Criar um arquivo CSV com a matriz de distâncias entre a base e os pontos de entrega.

Importar os dados no Python e gerar um grafo representando as conexões e distâncias entre os pontos.

O grafo é representado como um dicionário de dicionários, onde cada ponto aponta para seus vizinhos e respectivas distâncias.


Passo 2 – Implementar Dijkstra

Função dijkstra(grafo, inicio, destino) calcula o menor caminho entre dois pontos específicos.

Útil para verificar trajetos individuais ou subcaminhos da rota completa.

Testar com poucos pontos (ex.: base + 1 destino) para garantir que o cálculo está correto.


Passo 3 – Implementar Força Bruta

Função forca_bruta(grafo, base, destinos) gera todas as permutações de destinos e calcula a distância total de cada rota.

O operador informa apenas a base, e o sistema calcula automaticamente a melhor ordem de entregas passando por todos os pontos.

Ao final, retorna a rota de menor distância total e a sequência de pontos visitados.


Passo 4 – Integrar limite de bateria

O programa verifica se a rota ideal calculada excede a autonomia do drone.

Emite alerta caso a bateria seja insuficiente, informando a distância excedida.


Passo 5 – Boas práticas de programação

Uso de nomes claros e descritivos para variáveis (distancias, rota, caminho).

Código modularizado em funções independentes para facilitar manutenção.

Tratamento de exceções para entradas incorretas ou arquivos ausentes.

Mensagens claras de erro para evitar falhas de execução.

Preparação para futuras melhorias: modularização em classes, interface gráfica, heurísticas adicionais, otimização de leitura de dados.


Passo 6 – Comparar métodos e desempenho

Testar Dijkstra e força bruta em diferentes matrizes de distâncias.

Avaliar tempo de execução (import time).

Testar diferentes formatos de arquivo (CSV, JSON, Pickle) para verificar performance de leitura.


Conclusões:

1. É possível calcular o menor caminho entre dois pontos usando Dijkstra.


2. O algoritmo de força bruta encontra a rota ideal que passa por todos os pontos e retorna à base.


3. O sistema valida entradas e alerta sobre limite de bateria, garantindo segurança nas entregas.


4. O código está modularizado, documentado e pronto para futuras melhorias, incluindo interface gráfica, heurísticas e otimização de leitura de dados.

