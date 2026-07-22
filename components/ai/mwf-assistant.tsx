"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bot, ChevronDown, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { askMwfAssistant, type AssistantReply } from "@/app/(app)/dashboard/assistant-actions";
import type { AssistantContext } from "@/lib/assistant/interpreter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Alert = { label: string; value: number; href: import("next").Route; allowed: boolean };
type Message = { role: "user" | "assistant"; text: string; reply?: AssistantReply };

export function MwfAssistant({ alerts, contextKey, userName }: { alerts: Alert[]; contextKey: string; userName?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [context, setContext] = React.useState<AssistantContext>({});
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => { setContext({}); setMessages([]); setMobileOpen(false); }, [contextKey]);
  React.useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  React.useEffect(() => {
    if (!mobileOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", escape); };
  }, [mobileOpen]);

  function ask(value = prompt) {
    const question = value.trim();
    if (!question || pending) return;
    setPrompt("");
    setMessages((current) => [...current.slice(-3), { role: "user", text: question }]);
    startTransition(async () => {
      try {
        const reply = await askMwfAssistant(question, context);
        setContext(reply.context);
        setMessages((current) => [...current.slice(-3), { role: "assistant", text: reply.message, reply }]);
      } catch {
        setMessages((current) => [...current.slice(-3), { role: "assistant", text: "Não foi possível consultar agora. Tente novamente." }]);
      }
    });
  }

  const hour = mounted ? new Date().getHours() : 12;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const content = <AssistantContent alerts={alerts} collapsed={collapsed} greeting={greeting} userName={userName} inputRef={inputRef} messages={messages} pending={pending} prompt={prompt} setCollapsed={setCollapsed} setPrompt={setPrompt} ask={ask} />;
  const mobileAssistant = <>
    <Button type="button" size="icon" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Fechar Assistente MWF" : "Abrir Assistente MWF"} aria-expanded={mobileOpen} aria-controls="mwf-mobile-assistant" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[65] h-12 w-12 rounded-full shadow-xl lg:hidden"><Sparkles className="h-5 w-5" /></Button>
    {mobileOpen ? <div id="mwf-mobile-assistant" className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Assistente MWF">
      <button type="button" aria-label="Fechar assistente" className="absolute inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[min(88vh,760px)] max-h-[min(88dvh,760px)] overflow-y-auto overscroll-contain rounded-t-2xl border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur"><strong className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Assistente MWF</strong><Button type="button" variant="ghost" size="icon" aria-label="Fechar assistente" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button></div>
        <div className="p-4">{content}</div>
      </div>
    </div> : null}
  </>;

  return <>
    <div className="hidden lg:block">{content}</div>
    {mounted ? createPortal(mobileAssistant, document.body) : null}
  </>;
}

type ContentProps = {
  alerts: Alert[];
  collapsed: boolean;
  greeting: string;
  userName?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  messages: Message[];
  pending: boolean;
  prompt: string;
  setCollapsed(value: boolean): void;
  setPrompt(value: string): void;
  ask(value?: string): void;
};

function AssistantContent({ alerts, collapsed, greeting, userName, inputRef, messages, pending, prompt, setCollapsed, setPrompt, ask }: ContentProps) {
  const important = alerts.filter((item) => item.allowed && item.value > 0).slice(0, 4);
  return <Card className="min-w-0 border-primary/20">
    <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
      <div><CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" />{greeting}{userName ? ", " + userName.split(" ")[0] : ""}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Como posso ajudar hoje?</p></div>
      <Button type="button" variant="ghost" size="icon" aria-label={collapsed ? "Expandir assistente" : "Recolher assistente"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} /></Button>
    </CardHeader>
    {!collapsed ? <CardContent className="grid min-w-0 gap-4">
      {messages.length === 0 && important.length ? <div className="rounded-xl border bg-muted/20 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje você possui</p><ul className="grid gap-1.5 text-sm">{important.map((item) => <li key={item.label} className="flex min-w-0 justify-between gap-3"><span className="truncate">{item.label}</span><strong className="text-primary">{item.value}</strong></li>)}</ul></div> : null}
      <form className="flex min-w-0 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); ask(); }}>
        <input ref={inputRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: Quero agendar o Marcos, tem horário amanhã?" aria-label="Como posso ajudar?" autoComplete="off" enterKeyHint="send" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" disabled={pending || !prompt.trim()}><Search className="h-4 w-4" />{pending ? "Consultando..." : "Perguntar"}</Button>
      </form>
      {messages.length ? <div className="grid max-h-80 gap-3 overflow-y-auto pr-1" aria-live="polite">{messages.map((message, index) => <div key={index} className={cn("min-w-0 rounded-xl border p-3 text-sm", message.role === "user" ? "ml-6 bg-muted/40" : "mr-2 border-primary/20")}>
        <p className="font-medium">{message.role === "user" ? message.text : message.reply?.title ?? "Assistente MWF"}</p>
        {message.role === "assistant" ? <p className="mt-1 text-muted-foreground">{message.text}</p> : null}
        {message.reply?.cards.length ? <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">{message.reply.cards.map((card) => <div key={card.title} className={cn("min-w-0 rounded-lg border p-3", card.tone === "warning" && "border-amber-500/40 bg-amber-500/5", card.tone === "success" && "border-emerald-500/40 bg-emerald-500/5")}><strong className="text-xs uppercase tracking-wide">{card.title}</strong><ul className="mt-2 grid gap-1 text-xs">{card.lines.map((line) => <li key={line} className="break-words">{line}</li>)}</ul></div>)}</div> : null}
        {message.reply?.actions.length ? <div className="mt-3 flex flex-wrap gap-2">{message.reply.actions.map((item) => item.href ? <Button key={item.label} asChild size="sm" variant="outline"><Link href={item.href}>{item.label}</Link></Button> : <Button key={item.label} type="button" size="sm" variant="outline" onClick={() => ask(item.prompt)}>{item.label}</Button>)}</div> : null}
      </div>)}</div> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Digite um nome, CPF, telefone ou uma pergunta. Exemplos: “Buscar João”, “Quem está devendo?” ou “Último pagamento do Marcos”.</p>}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />Consultas usam dados reais. Ações abrem fluxos existentes para revisão.</p>
    </CardContent> : null}
  </Card>;
}
