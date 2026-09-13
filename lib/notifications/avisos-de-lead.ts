/**
 * Quais avisos um UPDATE de lead merece — e por que isso não pode sair do
 * `old` do Realtime.
 *
 * ## O defeito
 *
 * `useCrmAlerts` decidia comparando com o registro ANTERIOR do payload:
 *
 *     if (owner && owner === user.id && owner !== ownerAntes) → "Lead atribuído"
 *     if (status === "won"  && statusAntes !== "won")         → "Lead ganho"
 *     if (status === "lost" && statusAntes !== "lost")        → "Lead perdido"
 *
 * Só que `crm_leads` está com REPLICA IDENTITY **default**, e nesse modo o
 * Postgres publica em `old` apenas as colunas da CHAVE PRIMÁRIA. Conferido no
 * banco desta instalação:
 *
 *     relname        | replica_identity
 *     crm_leads      | default(PK)
 *     conversations  | default(PK)
 *
 * Então `ownerAntes` e `statusAntes` são SEMPRE `null`, e as três comparações
 * são sempre verdadeiras. O efeito não é alerta que não chega — é o contrário:
 *
 *   - qualquer edição num lead seu reanuncia "Lead atribuído a você";
 *   - qualquer edição num lead JÁ ganho reanuncia "Lead ganho";
 *   - idem para "Lead perdido".
 *
 * Mudar uma tag reanuncia a venda. O aviso que deveria marcar uma transição
 * vira barulho a cada toque, e barulho demais é como se desliga um aviso que
 * um dia importa.
 *
 * ## Por que memória do cliente, e não REPLICA IDENTITY FULL
 *
 * Ligar FULL em `crm_leads` resolveria e cobraria WAL de toda atualização de
 * lead do parque inteiro — para servir três avisos de interface. A tela já vê
 * os leads passarem; guardar o que ela viu é de graça.
 *
 * A regra da PRIMEIRA VEZ é o que evita trocar um falso positivo por outro:
 * sem `old` e sem memória, não dá para saber se houve transição, e um aviso
 * disparado no primeiro UPDATE depois de abrir a tela seria exatamente o
 * defeito de novo, com outra roupa. Na dúvida, cala — a transição seguinte
 * (essa sim conhecida) anuncia.
 *
 * `antigo` continua sendo consultado primeiro: se um dia a tabela virar FULL,
 * esta função melhora sozinha, sem precisar ser reescrita.
 */

export type TipoDeAvisoDeLead = "lead_assigned" | "lead_won" | "lead_lost";

/** O que a tela já viu deste lead, para saber se houve transição. */
export interface MemoriaDoLead {
  owner: string | null;
  status: string | null;
}

export interface EntradaDeAvisos {
  novo: Record<string, unknown>;
  /** O `old` do Realtime. Com REPLICA IDENTITY default, vem só com a PK. */
  antigo: Record<string, unknown> | null;
  userId: string;
  /** `undefined` = nunca vimos este lead nesta sessão. */
  memoria: MemoriaDoLead | undefined;
}

export interface ResultadoDeAvisos {
  avisos: TipoDeAvisoDeLead[];
  /** O que guardar para o próximo evento deste lead. */
  memoria: MemoriaDoLead;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * O valor anterior de um campo: do `old` quando ele veio, da memória quando
 * não. `indefinido` distingue "não havia" de "era null" — e é o que segura o
 * aviso na primeira vez.
 */
function anterior(
  antigo: Record<string, unknown> | null,
  memoria: MemoriaDoLead | undefined,
  campo: "owner_user_id" | "status",
  chaveMemoria: keyof MemoriaDoLead,
): { conhecido: boolean; valor: string | null } {
  if (antigo && campo in antigo) return { conhecido: true, valor: texto(antigo[campo]) };
  if (memoria) return { conhecido: true, valor: memoria[chaveMemoria] };
  return { conhecido: false, valor: null };
}

export function decidirAvisosDeLead(entrada: EntradaDeAvisos): ResultadoDeAvisos {
  const { novo, antigo, userId, memoria } = entrada;
  const owner = texto(novo.owner_user_id);
  const status = texto(novo.status);
  const memoriaNova: MemoriaDoLead = { owner, status };

  const donoAnterior = anterior(antigo, memoria, "owner_user_id", "owner");
  const statusAnterior = anterior(antigo, memoria, "status", "status");

  const avisos: TipoDeAvisoDeLead[] = [];
  const meu = owner !== null && owner === userId;

  if (meu && donoAnterior.conhecido && donoAnterior.valor !== owner) {
    avisos.push("lead_assigned");
  }
  if (meu && statusAnterior.conhecido && status === "won" && statusAnterior.valor !== "won") {
    avisos.push("lead_won");
  }
  if (meu && statusAnterior.conhecido && status === "lost" && statusAnterior.valor !== "lost") {
    avisos.push("lead_lost");
  }

  return { avisos, memoria: memoriaNova };
}
