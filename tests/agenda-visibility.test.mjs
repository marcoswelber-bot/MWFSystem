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
  assert.match(source, /\.from\("clinics"\)[\s\S]*?\.eq\("id", clinicScope\.clinicId\)/);
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
