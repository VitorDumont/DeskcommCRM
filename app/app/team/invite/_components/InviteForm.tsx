"use client";
import { InterfaceEditor } from "@/components/team/InterfaceEditor";
import {
  INTERFACE_COMPLETA,
  interfaceSettingsSchema,
  interfaceTemDestino,
} from "@/lib/navigation/interface";
import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { useInviteMembers } from "@/hooks/team/useInviteMembers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, type Role } from "@/lib/schemas/team";
import { descreverMotivoDaFalha } from "./motivo-da-falha";

interface ResultState {
  sent: Array<{
    email: string;
    accept_url: string;
    email_dispatched: boolean;
    email_error?: string | null;
    expires_at: string;
  }>;
  failed: Array<{ email: string; reason: string }>;
}

/**
 * O que dizer quando o e-mail não saiu.
 *
 * A mensagem era uma só — "Resend não configurado — link copiável abaixo
 * (DEV)" — para qualquer causa, e errava em três frentes ao mesmo tempo: dizia
 * NÃO CONFIGURADO a quem tinha a chave configurada e inválida (medido nesta
 * instalação: `{"statusCode":400,"message":"API key is invalid"}`), sugeria com
 * o "(DEV)" que aquilo era coisa de ambiente de desenvolvimento enquanto
 * acontecia em produção, e não dizia o que fazer. O motivo já existia
 * classificado em `sendEmail` e morria no caminho.
 *
 * O link de aceite continua na tela em todos os casos: ele é a saída imediata,
 * e mandar o convite pelo WhatsApp enquanto o e-mail não volta é trabalho que
 * quem opera consegue fazer sozinho.
 */
function motivoDoNaoEnvio(erro: string | null | undefined, t: (s: string) => string): string {
  switch (erro) {
    case "not_configured":
      return t("E-mail não enviado: falta configurar RESEND_API_KEY e RESEND_FROM_EMAIL. Use o link abaixo.");
    case "dominio_nao_verificado":
      return t("E-mail não enviado: o domínio do remetente não está verificado no Resend. Use o link abaixo.");
    case "rate_limited":
      return t("E-mail não enviado: o provedor atingiu o limite de envio. Tente de novo em instantes ou use o link abaixo.");
    case "send_failed":
      return t("E-mail não enviado: o provedor recusou o envio (chave inválida ou remetente incorreto). Use o link abaixo.");
    default:
      return t("E-mail não enviado. Use o link abaixo para passar o convite por outro canal.");
  }
}

export function InviteForm() {
  const t = useT();
  const [emailsRaw, setEmailsRaw] = useState("");
  const [settings, setSettings] = useState(INTERFACE_COMPLETA);
  const [role, setRole] = useState<Role>("agent");
  const [result, setResult] = useState<ResultState | null>(null);
  const invite = useInviteMembers();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailsRaw
      .split(/[\n,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const unique = Array.from(new Set(emails));
    if (unique.length === 0) {
      toast.error(t("Adicione ao menos um email."));
      return;
    }
    if (unique.length > 20) {
      toast.error(t("Máximo 20 emails por convite."));
      return;
    }
    try {
      const res = await invite.mutateAsync({
        invitations: unique.map((email) => ({ email, role, interface_settings: settings })),
      });
      setResult(res.data);
      const ok = res.data.sent.length;
      const ko = res.data.failed.length;
      toast.success(
        `${ok} ${t("convite(s) enviado(s)")}${ko > 0 ? `, ${ko} ${t("falha(s).")}` : "."}`,
      );
      setEmailsRaw("");
    } catch {
      /* showApiError handled */
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr,2fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="emails">Emails</Label>
          <Textarea
            id="emails"
            value={emailsRaw}
            onChange={(e) => setEmailsRaw(e.target.value)}
            rows={8}
            placeholder={"alice@empresa.com\nbob@empresa.com"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <InterfaceEditor
          value={settings}
          onChange={setSettings}
          role={role}
          disabled={invite.isPending}
        />
        <Button
          type="submit"
          disabled={
            invite.isPending ||
            !interfaceSettingsSchema.safeParse(settings).success ||
            !interfaceTemDestino(settings, role)
          }
        >
          {invite.isPending ? t("Enviando…") : t("Enviar convites")}
        </Button>
      </form>

      <div className="space-y-4">
        {result ? (
          <>
            {result.sent.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold">
                  {t("Enviados")} ({result.sent.length})
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {result.sent.map((s) => (
                    <li key={s.email} className="rounded-md border p-2">
                      <div className="font-medium">{s.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.email_dispatched ? t("Email enviado.") : motivoDoNaoEnvio(s.email_error, t)}
                      </div>
                      {!s.email_dispatched ? (
                        <code className="mt-1 block text-xs break-all">{s.accept_url}</code>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {result.failed.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold text-destructive">
                  {t("Falhas")} ({result.failed.length})
                </h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {result.failed.map((f) => (
                    <li key={f.email}>
                      <span className="font-medium">{f.email}</span>{" "}
                      <span className="text-muted-foreground">— {t(descreverMotivoDaFalha(f.reason))}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("Resultados aparecerão aqui após o envio.")}
          </p>
        )}
      </div>
    </div>
  );
}
