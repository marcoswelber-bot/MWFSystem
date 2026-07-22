"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Maximize2, Minimize2, Trash2, X } from "lucide-react";
import { askMwfAssistant, type AssistantReply } from "@/app/(app)/dashboard/assistant-actions";
import type { AssistantContext } from "@/lib/assistant/interpreter";
import { MwfAiIcon } from "@/components/ai/mwf-ai-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = { id: number; role: "user" | "assistant"; text: string; reply?: AssistantReply };
type MwfAssistantProps = { contextKey: string; userName?: string };

export function MwfAssistant({ contextKey, userName }: MwfAssistantProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [context, setContext] = React.useState<AssistantContext>({});
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [pending, startTransition] = React.useTransition();
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const historyRef = React.useRef<HTMLDivElement>(null);
  const messageId = React.useRef(0);
  const wasOpen = React.useRef(false);

  function clearConversation() {
    setMessages([]);
    setContext({});
    setPrompt("");
    messageId.current = 0;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    setContext({});
    setMessages([]);
    setPrompt("");
    setOpen(false);
    setExpanded(false);
  }, [contextKey]);
  React.useEffect(() => {
    setOpen(false);
    setExpanded(false);
  }, [pathname]);
  React.useEffect(() => {
    if (!open) {
      if (wasOpen.current) launcherRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  React.useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function ask(value = prompt) {
    const question = value.trim();
    if (!question || pending) return;
    setPrompt("");
    const userMessage: Message = { id: ++messageId.current, role: "user", text: question };
    setMessages((current) => [...current.slice(-11), userMessage]);
    startTransition(async () => {
      try {
        const reply = await askMwfAssistant(question, context);
        setContext(reply.context);
        setMessages((current) => [...current.slice(-11), { id: ++messageId.current, role: "assistant", text: reply.message, reply }]);
      } catch {
        setMessages((current) => [...current.slice(-11), {
          id: ++messageId.current,
          role: "assistant",
          text: "Não foi possível consultar agora. Tente novamente em instantes."
        }]);
      }
    });
  }

  if (!mounted) return null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = userName?.trim().split(/\s+/)[0];

  return createPortal(
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Fechar MWF IA" : "Abrir MWF IA"}
        aria-expanded={open}
        aria-controls="mwf-ai-panel"
        className={cn(
          "group fixed right-4 z-[75] grid h-16 w-16 place-items-center rounded-full bg-transparent outline-none transition duration-200 hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-sky-400/50 motion-reduce:transform-none motion-reduce:transition-none lg:bottom-6 lg:right-6",
          "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
          open && "pointer-events-none scale-95 opacity-0"
        )}
      >
        <span className="sr-only">MWF IA — Assistente Inteligente</span>
        <MwfAiIcon className={cn("h-16 w-16 transition group-hover:drop-shadow-lg", pending && "opacity-80")} />
      </button>

      {open ? (
        <div className="pointer-events-none fixed inset-0 z-[74]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fechar MWF IA"
            onClick={() => setOpen(false)}
            className="pointer-events-auto absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
          />
          <section
            ref={panelRef}
            id="mwf-ai-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mwf-ai-title"
            className={cn(
              "pointer-events-auto absolute flex min-w-0 flex-col overflow-hidden border border-border/70 bg-background shadow-2xl",
              "inset-x-0 bottom-0 h-[90vh] h-[90dvh] rounded-t-[24px] pb-[env(safe-area-inset-bottom)]",
              "animate-in fade-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none",
              "lg:inset-x-auto lg:bottom-[100px] lg:right-6 lg:h-[min(720px,calc(100dvh-124px))] lg:w-[410px] lg:max-w-[calc(100vw-32px)] lg:rounded-[24px] lg:pb-0 lg:slide-in-from-bottom-2",
              expanded && "h-screen h-[100dvh] rounded-none pt-[env(safe-area-inset-top)]"
            )}
          >
            <header className="flex min-h-[76px] shrink-0 items-center gap-3 bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-500 px-4 py-3 text-white">
              <MwfAiIcon className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 id="mwf-ai-title" className="truncate text-lg font-bold leading-tight">MWF IA</h2>
                <p className="truncate text-xs font-medium text-white/85">Assistente Inteligente</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white lg:hidden" aria-label={expanded ? "Reduzir MWF IA" : "Expandir MWF IA"} onClick={() => setExpanded((value) => !value)}>
                {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-30"
                aria-label="Limpar conversa"
                title="Limpar conversa"
                onClick={clearConversation}
                disabled={messages.length === 0 && !prompt.trim() && Object.keys(context).length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" aria-label="Fechar MWF IA" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div ref={historyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 px-4 py-4" aria-live="polite" aria-busy={pending}>
              {messages.length === 0 ? (
                <div className="mr-8 rounded-2xl rounded-tl-md border bg-card p-4 text-sm shadow-sm">
                  <p className="font-semibold text-foreground">{greeting}{firstName ? `, ${firstName}` : ""}! 👋</p>
                  <p className="mt-2 text-muted-foreground">Como está seu dia hoje?</p>
                  <p className="mt-1 text-muted-foreground">Em que posso ajudar?</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {messages.map((message) => (
                    <article key={message.id} className={cn("min-w-0", message.role === "user" ? "ml-10" : "mr-5")}>
                      <div className={cn(
                        "min-w-0 rounded-2xl px-3.5 py-3 text-sm shadow-sm",
                        message.role === "user"
                          ? "rounded-tr-md bg-gradient-to-r from-violet-600 to-blue-600 text-white"
                          : "rounded-tl-md border bg-card text-card-foreground"
                      )}>
                        {message.role === "assistant" && message.reply?.title ? <p className="mb-1 font-semibold">{message.reply.title}</p> : null}
                        <p className={cn("whitespace-pre-line break-words", message.role === "assistant" && "text-muted-foreground")}>{message.text}</p>
                        {message.reply?.cards.length ? (
                          <div className="mt-3 grid gap-2">
                            {message.reply.cards.map((card, cardIndex) => (
                              <div key={`${card.title}-${cardIndex}`} className={cn(
                                "rounded-xl border bg-background/80 p-3",
                                card.tone === "warning" && "border-amber-500/40 bg-amber-500/5",
                                card.tone === "success" && "border-emerald-500/40 bg-emerald-500/5"
                              )}>
                                <strong className="text-xs uppercase tracking-wide">{card.title}</strong>
                                <ul className="mt-2 grid gap-1.5 text-xs">
                                  {card.lines.map((line, lineIndex) => <li key={`${line}-${lineIndex}`} className="break-words">{line}</li>)}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {message.reply?.actions.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.reply.actions.map((item, actionIndex) => item.externalHref ? (
                            <Button key={`${item.label}-${actionIndex}`} asChild size="sm" variant="outline" className="h-8 rounded-full bg-background text-xs">
                              <a href={item.externalHref} target="_blank" rel="noreferrer">{item.label}</a>
                            </Button>
                          ) : item.href ? (
                            <Button key={`${item.label}-${actionIndex}`} asChild size="sm" variant="outline" className="h-8 rounded-full bg-background text-xs">
                              <Link href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
                            </Button>
                          ) : (
                            <Button key={`${item.label}-${actionIndex}`} type="button" size="sm" variant="outline" className="h-8 rounded-full bg-background text-xs" onClick={() => ask(item.prompt)}>
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      {message.role === "assistant" ? <p className="mt-2 text-xs text-muted-foreground">Posso ajudar com mais alguma coisa?</p> : null}
                    </article>
                  ))}
                </div>
              )}
              {pending ? (
                <div className="mt-4 mr-24 flex w-fit items-center gap-1 rounded-2xl rounded-tl-md border bg-card px-4 py-3" role="status" aria-label="MWF IA está consultando">
                  {[0, 1, 2].map((index) => <span key={index} className="h-2 w-2 animate-bounce rounded-full bg-primary motion-reduce:animate-pulse" style={{ animationDelay: `${index * 120}ms` }} />)}
                </div>
              ) : null}
            </div>

            <form className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3" onSubmit={(event) => { event.preventDefault(); ask(); }}>
              <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-muted/30 p-1.5 focus-within:ring-2 focus-within:ring-ring">
                <input
                  ref={inputRef}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Digite sua mensagem..."
                  aria-label="Mensagem para a MWF IA"
                  autoComplete="off"
                  enterKeyHint="send"
                  className="h-10 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="icon" disabled={pending || !prompt.trim()} aria-label="Enviar mensagem" className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm">
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>,
    document.body
  );
}
