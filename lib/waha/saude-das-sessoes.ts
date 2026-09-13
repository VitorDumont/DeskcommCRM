/**
 * O WAHA está de pé é uma pergunta; o WhatsApp está CONECTADO é outra.
 *
 * ## O buraco que isto fecha
 *
 * `checkWaha` chamava `/api/sessions` e conferia só o código HTTP. Um 200 ali
 * prova que o contêiner responde e que a API key confere — e não prova nada
 * sobre o número estar pareado. Quando a sessão cai (celular sem rede por
 * tempo demais, sessão expirada, número deslogado no aparelho), o WAHA segue
 * respondendo 200 com a sessão em `FAILED` ou `SCAN_QR_CODE`.
 *
 * O efeito é o pior tipo de falha para quem vende por WhatsApp: o canal
 * principal para, `/api/v1/health` continua dizendo `healthy`, e o alerta de
 * uptime — que exige exatamente essa palavra no corpo — não dispara. Ninguém é
 * avisado até um cliente reclamar que ninguém respondeu.
 *
 * ## As três decisões, e o que cada uma evita
 *
 * 1. **Nenhuma sessão ⇒ ok.** Instalação recém-feita ainda não conectou número,
 *    e chamar isso de degradado faria toda instalação nova nascer alertando —
 *    alerta que toca no primeiro dia é alerta que se desliga antes do segundo.
 * 2. **Ao menos uma `WORKING` ⇒ ok.** Quem tem dois números e perde um está
 *    degradado, sim, mas segue atendendo; a distinção fica no corpo
 *    (`trabalhando` vs `sessoes`) para quem quiser olhar, sem virar alarme.
 * 3. **Sessões existem e nenhuma trabalha ⇒ degradado.** É o caso que importa.
 *
 * ## O que NÃO entra na resposta
 *
 * Nome de sessão (carrega o id da organização), número, `me.id`, push name. O
 * cabeçalho de `health/route.ts` já trata o endereço do WAHA como superfície de
 * ataque; identificar o WhatsApp de quem opera seria pior. Saem contagens e os
 * ESTADOS — que são vocabulário do WAHA, não dado de ninguém.
 */

export interface SaudeDasSessoes {
  status: "ok" | "degraded";
  /** Quantas sessões o WAHA conhece. */
  sessoes: number;
  /** Quantas estão em `WORKING`. */
  trabalhando: number;
  /** Os estados vistos, sem identificar nenhuma. Ex.: "FAILED,SCAN_QR_CODE". */
  estados?: string;
}

/** O estado que significa "pareado e atendendo". Vocabulário do WAHA. */
const TRABALHANDO = "WORKING";

export function avaliarSessoesWaha(corpo: unknown): SaudeDasSessoes {
  // Corpo inesperado não é falha de sessão: pode ser versão do WAHA que mudou o
  // formato. Dizer `degraded` aqui transformaria um upgrade do WAHA em alarme
  // de WhatsApp caído, e mandaria quem opera procurar no lugar errado.
  if (!Array.isArray(corpo)) return { status: "ok", sessoes: 0, trabalhando: 0 };

  const estados = corpo.map((s) => {
    const st = (s as { status?: unknown })?.status;
    return typeof st === "string" && st.length > 0 ? st.toUpperCase() : "DESCONHECIDO";
  });

  const sessoes = estados.length;
  const trabalhando = estados.filter((e) => e === TRABALHANDO).length;

  if (sessoes === 0 || trabalhando > 0) {
    return { status: "ok", sessoes, trabalhando };
  }

  return {
    status: "degraded",
    sessoes,
    trabalhando,
    estados: [...new Set(estados)].sort().join(","),
  };
}
