"use client";

import { useState, useTransition } from "react";
import { saveClinicSettings, type ClinicHoursInput } from "@/app/(app)/clinicas/settings-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Clinic = { id: string; name: string; pix_key_type: string | null; pix_key: string | null; pix_holder: string | null; pix_bank: string | null };
type Hour = Omit<ClinicHoursInput, "opens_at" | "closes_at" | "break_starts_at" | "break_ends_at"> & { clinic_id: string; opens_at: string | null; closes_at: string | null; break_starts_at: string | null; break_ends_at: string | null };
const days = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
const defaults = (weekday: number): ClinicHoursInput => ({ weekday, is_open: weekday > 0 && weekday < 6, opens_at: "08:00", closes_at: "18:00", break_starts_at: "", break_ends_at: "" });

export function ClinicSettingsManager({ clinics, openingHours, canEdit }: { clinics: Clinic[]; openingHours: Hour[]; canEdit: boolean }) {
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const current = clinics.find((clinic) => clinic.id === clinicId);
  const hoursFor = (id: string): ClinicHoursInput[] => days.map((_, weekday) => { const hour = openingHours.find((item) => item.clinic_id === id && item.weekday === weekday); return hour ? { weekday, is_open: hour.is_open, opens_at: hour.opens_at?.slice(0, 5) ?? "08:00", closes_at: hour.closes_at?.slice(0, 5) ?? "18:00", break_starts_at: hour.break_starts_at?.slice(0, 5) ?? "", break_ends_at: hour.break_ends_at?.slice(0, 5) ?? "" } : defaults(weekday); });
  const [pixType, setPixType] = useState(current?.pix_key_type ?? ""); const [pixKey, setPixKey] = useState(current?.pix_key ?? "");
  const [holder, setHolder] = useState(current?.pix_holder ?? ""); const [bank, setBank] = useState(current?.pix_bank ?? "");
  const [hours, setHours] = useState<ClinicHoursInput[]>(hoursFor(clinicId)); const [message, setMessage] = useState(""); const [pending, start] = useTransition();
  function changeClinic(id: string) { const clinic = clinics.find((item) => item.id === id); setClinicId(id); setPixType(clinic?.pix_key_type ?? ""); setPixKey(clinic?.pix_key ?? ""); setHolder(clinic?.pix_holder ?? ""); setBank(clinic?.pix_bank ?? ""); setHours(hoursFor(id)); setMessage(""); }
  function updateDay(index: number, patch: Partial<ClinicHoursInput>) { setHours((value) => value.map((day, item) => item === index ? { ...day, ...patch } : day)); }
  if (!current) return null;
  return <div className="mt-6 grid gap-6">
    <Card><CardHeader><CardTitle>Dados PIX e horario de funcionamento</CardTitle></CardHeader><CardContent className="grid gap-5">
      {clinics.length > 1 ? <label className="grid gap-1 text-sm">Clinica<select className="rounded-md border bg-background px-3 py-2" value={clinicId} onChange={(e) => changeClinic(e.target.value)}>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label> : null}
      <section className="grid gap-3"><h3 className="font-semibold">DADOS PIX</h3><div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">Tipo da chave<select className="rounded-md border bg-background px-3 py-2" value={pixType} onChange={(e) => setPixType(e.target.value)}><option value="">Selecione</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="celular">Celular</option><option value="email">Email</option><option value="aleatoria">Chave Aleatoria</option></select></label>
        <label className="grid gap-1 text-sm">Chave PIX<Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} /></label><label className="grid gap-1 text-sm">Titular<Input value={holder} onChange={(e) => setHolder(e.target.value)} /></label><label className="grid gap-1 text-sm">Banco (opcional)<Input value={bank} onChange={(e) => setBank(e.target.value)} /></label>
      </div></section>
      <section className="grid gap-3"><h3 className="font-semibold">HORARIO DE FUNCIONAMENTO</h3>{hours.map((day, index) => <div key={day.weekday} className="grid items-end gap-2 rounded-md border p-3 md:grid-cols-6"><label className="flex gap-2 text-sm"><input type="checkbox" checked={day.is_open} onChange={(e) => updateDay(index, { is_open: e.target.checked })} />{days[day.weekday]}</label><label className="grid gap-1 text-xs">Inicio<Input type="time" disabled={!day.is_open} value={day.opens_at} onChange={(e) => updateDay(index, { opens_at: e.target.value })} /></label><label className="grid gap-1 text-xs">Fim<Input type="time" disabled={!day.is_open} value={day.closes_at} onChange={(e) => updateDay(index, { closes_at: e.target.value })} /></label><label className="grid gap-1 text-xs">Intervalo inicio<Input type="time" disabled={!day.is_open} value={day.break_starts_at} onChange={(e) => updateDay(index, { break_starts_at: e.target.value })} /></label><label className="grid gap-1 text-xs">Intervalo fim<Input type="time" disabled={!day.is_open} value={day.break_ends_at} onChange={(e) => updateDay(index, { break_ends_at: e.target.value })} /></label><span className="text-sm">{day.is_open ? "Aberto" : "Fechado"}</span></div>)}</section>
      {message ? <p className="text-sm">{message}</p> : null}<Button disabled={!canEdit || pending} onClick={() => start(async () => { const result = await saveClinicSettings({ clinic_id: clinicId, pix_key_type: pixType, pix_key: pixKey, pix_holder: holder, pix_bank: bank, hours }); setMessage(result.message); })}>{pending ? "Salvando..." : "Salvar configuracoes"}</Button>
    </CardContent></Card>
  </div>;
}
