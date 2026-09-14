---
impacto: capacidade_nova
secao: corrigido
titulo: O teste do agente deixa de ser interrompido antes de terminar
---

Testar um agente pela tela falhava sempre, com qualquer provedor e qualquer
modelo: a tela desistia em 10 segundos, e um turno real leva de 20 a 35. O
resultado era "Erro inesperado", que não dizia nada — e o teste ficava
registrado como se ainda estivesse rodando.

Agora a tela espera o tempo que o turno precisa. Se mesmo assim passar de 3
minutos, ela diz que passou e sugere desligar capacidades que não se usa.
