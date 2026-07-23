import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Agenda separa a composicao Mobile da grade Desktop preservada", async () => {
  const source = await read("components/agenda/agenda-manager.tsx");
  for (const component of ["AgendaMobileUpcoming", "AgendaMobilePending", "AgendaMobileDayList"]) assert.match(source, new RegExp(`function ${component}`));
  assert.match(source, /className="grid gap-3 lg:hidden"/);
  assert.match(source, /hidden items-start gap-3 lg:grid lg:grid-cols/);
  assert.match(source, /hidden lg:block"><DailyAppointmentsList/);
  assert.match(source, /Buscar paciente, telefone ou CPF/);
});

test("Baixas e Repasses mantem tabela no Desktop e todas as informacoes nos cards Mobile", async () => {
  const source = await read("components/finance/settlements-manager.tsx");
  assert.match(source, /className="hidden lg:block"/);
  assert.match(source, /className="grid gap-3 p-3 lg:hidden"/);
  for (const label of ["Valor total", "Valor pago", "Valor em aberto", "Valor bruto", "Descontos", "Valor liquido", "Vencimento"]) assert.match(source, new RegExp(label));
  assert.match(source, /PatientMobileCard/);
  assert.match(source, /StaffMobileCard/);
});

test("Login oferece visibilidade e persistencia sem armazenar senha", async () => {
  const [form, actions, middleware] = await Promise.all([
    read("components/login/login-form.tsx"),
    read("app/login/actions.ts"),
    read("lib/supabase/middleware.ts")
  ]);
  assert.match(form, /Mostrar senha/);
  assert.match(form, /Ocultar senha/);
  assert.match(form, /name="rememberMe"/);
  assert.match(form, /Manter conectado/);
  assert.doesNotMatch(form + actions, /localStorage.*password|sessionStorage.*password/i);
  assert.match(actions, /cookieStore\.set/);
  assert.match(actions, /supabase\.auth\.signOut\(\)/);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(middleware, /signOut\(/);
});

test("IA cede espaco a menu, modal, select e controles de data", async () => {
  const [assistant, shell] = await Promise.all([
    read("components/ai/mwf-assistant.tsx"),
    read("components/app-shell.tsx")
  ]);
  assert.match(shell, /suppressed=\{mobileOpen \|\| clinicPickerOpen\}/);
  assert.match(assistant, /input\[type="date"\]/);
  assert.match(assistant, /input\[type="time"\]/);
  assert.match(assistant, /role="listbox"/);
  assert.match(assistant, /interfaceBlocked/);
  assert.match(assistant, /safe-area-inset-bottom/);
});
