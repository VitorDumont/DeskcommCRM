---
impacto: capacidade_nova
secao: corrigido
titulo: O \n literal, os tiques azuis e o convite que falhava calado
---

Três defeitos que o cliente ou quem opera via, e o sistema não.

**A quebra de linha que chegava como texto.** Quando o modelo escrevia `\n` em
vez de quebrar a linha — comum nos modelos menores e nos gratuitos —, a mensagem
saía para o WhatsApp com os caracteres à mostra. Junto, ela perdia a divisão em
bolhas: o separador de parágrafo procura quebra de verdade, não casava com o
escape, e a resposta saía num bloco só.

**Os tiques azuis.** O cliente escrevia, o agente respondia, e a mensagem dele
continuava marcada como não lida no WhatsApp — o que lê como desatenção. O CRM
agora marca a conversa como lida no momento em que responde.

**O convite que falhava calado.** Quando o e-mail não saía, a tela dizia sempre
"Resend não configurado (DEV)" — inclusive para quem tinha a configuração no
lugar e uma chave inválida, em produção. O motivo já era classificado e se
perdia no caminho. Agora a tela diz qual foi a causa e o que fazer; o link de
aceite continua ali para passar o convite por outro canal enquanto isso.
