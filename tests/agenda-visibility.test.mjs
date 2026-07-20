import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/(app)/agenda/page.tsx", import.meta.url);
const managerPath = new URL("../components/agenda/agenda-manager.tsx", import.meta.url);

test("agenda uses a centralized visible range and bounded Supabase queries", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /getAgendaVisibleRange\(selectedDate\)/);
  assert.match(source, /\.gte\("appointment_date", rangeStart\)/);
  assert.match(source, /\.lte\("appointment_date", rangeEnd\)/);
  assert.match(source, /\.eq\("clinic_id", clinicScope\.clinicId\)/);
  assert.match(source, /getAvailableClinicsForProfile\(clinicScope\.profile\)/);
  assert.match(source, /clinic\.id === clinicScope\.clinicId/);
});

test("saved appointments navigate to their actual date and refresh the current date", async () => {
  const source = await readFile(managerPath, "utf8");

  assert.match(source, /selectAgendaDate\(appointmentPayload\.appointment_date\)/);
  assert.match(source, /if \(previousDate === date\) \{\s*router\.refresh\(\)/);
  const selectDateSource = source.slice(
    source.indexOf("function selectAgendaDate"),
    source.indexOf("function refresh", source.indexOf("function selectAgendaDate"))
  );
  assert.doesNotMatch(selectDateSource, /isPastDate|isFullDayBlocked/);
});

test("grid, daily list and detail panel share the loaded appointment collection", async () => {
  const source = await readFile(managerPath, "utf8");

  assert.match(source, /<DailyAppointmentsList[\s\S]*appointments=\{dayAppointments\}/);
  assert.match(source, /<AppointmentDetailsPanel/);
  assert.match(source, /appointments=\{visibleAppointments\.filter/);
});

test("premium agenda layout remains connected to real loaded data", async () => {
  const source = await readFile(managerPath, "utf8");

  assert.match(source, /xl:grid-cols-\[240px_minmax\(0,1fr\)_300px\]/);
  assert.match(source, /<MiniMonthCalendar[\s\S]*appointments=\{visibleAppointments\}/);
  assert.match(source, /<AgendaDaySummary appointments=\{dayAppointments\}/);
  assert.match(source, /<AgendaRightRail appointments=\{dayAppointments\}/);
  assert.match(source, /<DailyAppointmentsList[\s\S]*appointments=\{dayAppointments\}/);
  assert.match(source, /<table className="w-full min-w-\[980px\]/);
});

test("compact cards and contextual actions preserve operational callbacks", async () => {
  const source = await readFile(managerPath, "utf8");

  assert.match(source, /height: Math\.max\(Math\.min\(base\.height, 90\), 58\)/);
  assert.match(source, /function AppointmentActionsMenu/);
  assert.match(source, /actions\.has\("confirm"\)/);
  assert.match(source, /actions\.has\("finalize"\)/);
  assert.match(source, /actions\.has\("absence"\)/);
  assert.match(source, /document\.addEventListener\("mousedown",close\)/);
});

test("calendar and responsive agenda prevent broken day numbers and page overflow", async () => {
  const source = await readFile(managerPath, "utf8");

  assert.match(source, /aspect-square min-w-0 whitespace-nowrap/);
  assert.match(source, /overflow-x-hidden/);
  assert.match(source, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
});
