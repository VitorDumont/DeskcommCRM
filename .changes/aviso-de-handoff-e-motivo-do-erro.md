---
impacto: capacidade_nova
secao: corrigido
titulo: Quem atende é avisado quando a conversa passa para uma pessoa
---

Quando a IA parava e a conversa ia para a fila humana, ninguém era avisado. A
conversa aparecia na lista, e só: se não houvesse alguém olhando a tela naquele
instante, o cliente que pediu atendente esperava sem que ninguém soubesse. O
evento `handoff_pending` era emitido desde sempre e não tinha consumidor.

Agora o aviso chega a quem recebeu o atendimento — ou a todos, quando a conversa
cai na fila sem dono — dizendo o motivo pelo qual a IA parou. A categoria
"Conversa passada para uma pessoa" pode ser desligada em Configurações →
Notificações.

No mesmo lote: a tela de teste do agente passa a mostrar o motivo real da falha.
Ela respondia sempre "confira modelo, credencial e materiais do agente", e
quando a causa era do provedor (um 429 de modelo gratuito, por exemplo) os três
lugares sugeridos estavam certos e a causa não estava em nenhum deles.
