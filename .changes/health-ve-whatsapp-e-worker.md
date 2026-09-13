---
impacto: capacidade_nova
secao: corrigido
titulo: A verificação de saúde enxerga o WhatsApp desconectado e o worker parado
---

A verificação de saúde dizia "tudo certo" em duas situações em que ninguém
estava sendo atendido: com o número do WhatsApp desconectado (ela só perguntava
se o serviço respondia, não se o número estava pareado) e com o worker parado —
que é quem faz o agente responder e que ela não consultava.

Nos dois casos o atendimento parava em silêncio. Agora aparece, e quem monitora
de fora enxerga junto.
