Contexto: Uma startup chamada DroneXpress faz entregas rápidas com drones em uma cidade pequena.Cada drone parte de uma base principal e precisa entregar pacotes em vários pontos.
Por enquanto, o sistema ainda não é automático: o operador precisa inserir manualmente a ordem das entregas.Quero criar um programa que calcule a ordem ideal das entregas para que o drone voe a menor distância possível e volte à base com segurança (a bateria é limitada!).

Problema: Dada uma matriz de distâncias entre os locais de entrega e a base, encontrar a rota de menor custo total que:

1. Começa na base,

2. Visita todos os destinos exatamente uma vez,

3. E retorna à base.

Descrição:
