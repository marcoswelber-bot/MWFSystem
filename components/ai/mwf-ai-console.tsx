"use client";
import { useState } from "react";
import { Bot, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Insight = { label: string; value: string; detail: string };
export function MwfAiConsole({ insights, lists }: { insights: Insight[]; lists: Record<string, string[]> }) {
  const [prompt, setPrompt] = useState(""); const [answer, setAnswer] = useState("Faça uma pergunta sobre a operação da clínica.");
  function interpret() {
    const query = prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const key = query.includes("sem retorno") ? "semRetorno" : query.includes("pendenc") || query.includes("deve") ? "pendencias" : query.includes("venc") ? "vencendo" : query.includes("ocioso") || query.includes("vag") ? "agendaVazia" : "";
    if (query.includes("agendar") || query.includes("remarcar") || query.includes("enviar") || query.includes("baixar") || query.includes("cancelar")) { setAnswer("Posso preparar essa ação e verificar conflitos, mas nunca vou executá-la automaticamente. Abra a Agenda ou o Financeiro para revisar os dados e confirmar explicitamente."); return; }
    if (key) { const rows = lists[key] ?? []; setAnswer(rows.length ? rows.join(" • ") : "Nenhum registro encontrado para este critério na clínica selecionada."); return; }
    const match = insights.find((item) => query.includes(item.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
    setAnswer(match ? `${match.label}: ${match.value}. ${match.detail}` : "Posso consultar agenda, recebimentos, valores vencidos, pacotes, pendências, pacientes sem retorno e ocupação. Os resultados sempre respeitam a clínica e as permissões atuais.");
  }
  return <div className="grid gap-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{insights.map((item) => <Card key={item.label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{item.label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Chat inteligente</CardTitle></CardHeader><CardContent className="grid gap-4"><div className="flex gap-2"><Input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") interpret(); }} placeholder="Ex.: Mostrar pacientes com pendencias" /><Button onClick={interpret}><Search className="h-4 w-4" />Consultar</Button></div><div className="rounded-md border bg-muted/30 p-4 text-sm">{answer}</div><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Modo seguro: apenas consultas. Toda ação exige revisão e confirmação na tela responsável.</p></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{Object.entries({ pendencias: "Cobrança inteligente", vencendo: "Pacotes vencendo", semRetorno: "Pacientes sem retorno", agendaVazia: "Agenda ociosa" }).map(([key, title]) => <Card key={key}><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{(lists[key] ?? []).length ? <ul className="grid gap-2 text-sm">{lists[key].map((row, index) => <li key={`${row}-${index}`} className="rounded border p-2">{row}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma ocorrência.</p>}</CardContent></Card>)}</div>
  </div>;
}
