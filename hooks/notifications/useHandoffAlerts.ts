"use client";

import { useCallback, useRef } from "react";

import { useActiveOrg, useUser } from "@/hooks/auth/AuthProvider";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { entregarAviso } from "@/lib/notifications/deliver";

/**
 * O aviso de que uma conversa passou da IA para uma pessoa.
 *
 * ## Por que escuta a TABELA e não o broadcast
 *
 * `triggerHandoff` emite `handoff_pending` no canal `org:<id>:queue` — e esse
 * evento não tinha consumidor nenhum (anti-pattern nº 3 do CLAUDE.md: emite e
 * ninguém escuta). Escutar o broadcast consertaria metade: o repo tem DOIS
 * motores de passagem para humano, e `performHumanHandoff` (o do agent-engine)
 * não passa por ele. O que os dois têm em comum é o UPDATE que grava
 * `status='pending'` — então é a tabela que sabe de todos os gatilhos.
 *
 * ## Por que a janela de tempo, e não "antes vs depois"
 *
 * `conversations` está com REPLICA IDENTITY default (só a PK), então o payload
 * de UPDATE do Realtime chega SEM o registro antigo: `old` traz `{id}` e nada
 * mais. Comparar `status` anterior — como `useCrmAlerts` tenta fazer com
 * `owner_user_id` — não funciona aqui, e dá falso positivo em vez de silêncio.
 * O sinal honesto é `last_handoff_at`: o orchestrator o grava no mesmo UPDATE,
 * então "virou pending agora" é `last_handoff_at` dentro da janela. Mudar a
 * tabela para REPLICA IDENTITY FULL resolveria também, e custa WAL em toda
 * conversa do parque para servir um aviso — não compensa.
 *
 * O `Set` de ids já avisados cobre o resto: UPDATEs seguintes na mesma conversa
 * (atribuição, leitura, tag) reentram aqui dentro da janela e não repetem o
 * aviso.
 */

const JANELA_MS = 2 * 60 * 1000;

const MOTIVO_LEGIVEL: Record<string, string> = {
  requested_human: "o cliente pediu uma pessoa",
  low_sentiment: "o cliente demonstrou insatisfação",
  low_confidence: "a IA não teve confiança na resposta",
  critical_stage: "a conversa chegou a uma etapa crítica",
  legal_mention: "a conversa citou assunto jurídico",
  refund_mention: "a conversa citou reembolso",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function recente(iso: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= JANELA_MS;
}

export function useHandoffAlerts(): void {
  const orgId = useActiveOrg()?.orgId ?? null;
  const user = useUser();
  const jaAvisados = useRef<Set<string>>(new Set());

  const onConversation = useCallback(
    (payload: unknown) => {
      const novo = (payload as { new?: unknown })?.new;
      if (!novo || typeof novo !== "object" || Array.isArray(novo)) return;
      const row = novo as Record<string, unknown>;

      if (str(row.status) !== "pending") return;
      if (!recente(str(row.last_handoff_at))) return;

      const id = str(row.id);
      if (!id || jaAvisados.current.has(id)) return;

      const assignee = str(row.assigned_to_user_id);
      // Atribuída a outra pessoa: o aviso é dela, não meu.
      if (assignee && assignee !== user.id) return;

      const motivo = str(row.last_handoff_reason);
      const porque = motivo ? (MOTIVO_LEGIVEL[motivo] ?? motivo) : null;
      const title = assignee ? "Atendimento passado para você" : "Conversa esperando na fila";
      const body = porque
        ? `A IA parou porque ${porque}.`
        : "A IA parou e a conversa aguarda uma pessoa.";

      jaAvisados.current.add(id);
      entregarAviso({
        category: "handoff",
        kind: "handoff_pending",
        title,
        body,
        tag: id,
        href: `/app/inbox?id=${id}`,
      });
    },
    [user.id],
  );

  useRealtimeChannel({
    name: orgId ? `alerts-handoff-${orgId}` : "alerts-handoff-disabled",
    postgresChanges: orgId
      ? {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${orgId}`,
        }
      : undefined,
    onChange: onConversation,
    enabled: !!orgId,
  });
}
