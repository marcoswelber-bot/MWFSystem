import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("login oferece recuperacao com resposta neutra e redirect publicado", async () => {
  const [page, actions] = await Promise.all([read("app/login/page.tsx"), read("app/login/actions.ts")]);
  assert.match(page, /Esqueci minha senha/);
  assert.match(page, /Recuperar senha/);
  assert.match(actions, /resetPasswordForEmail/);
  assert.match(actions, /https:\/\/mwf-system\.vercel\.app\/redefinir-senha/);
  assert.match(actions, /Se o e-mail estiver cadastrado/);
});

test("redefinicao valida senha e usa sessao de recuperacao", async () => {
  const page = await read("app/redefinir-senha/page.tsx");
  assert.match(page, /PASSWORD_RECOVERY/);
  assert.match(page, /token_hash: tokenHash/);
  assert.match(page, /type: "recovery"/);
  assert.match(page, /password\.length < 8/);
  assert.match(page, /password !== confirmation/);
  assert.match(page, /updateUser\(\{ password \}\)/);
  assert.match(page, /Senha alterada com sucesso/);
  assert.match(page, /invalido, expirou ou ja foi utilizado/);
  assert.match(page, /Mostrar senha/);
});

test("funcionario com acesso exige email normalizado, sem auth_user_id", async () => {
  const actions = await read("app/(app)/funcionarios/actions.ts");
  assert.match(actions, /trim\(\)\.toLowerCase\(\)/);
  assert.match(actions, /syncEmployeeAuthUser/);
  assert.match(actions, /assertLoginEmailAvailable/);
  assert.doesNotMatch(actions, /auth_user_id/);
});

test("paciente com portal exige email normalizado, sem auth_user_id", async () => {
  const actions = await read("app/(app)/pacientes/actions.ts");
  assert.match(actions, /trim\(\)\.toLowerCase\(\)/);
  assert.match(actions, /syncPatientAuthUser/);
  assert.match(actions, /assertLoginEmailAvailable/);
  assert.doesNotMatch(actions, /auth_user_id/);
});

test("ADM Master possui acao oficial e bloqueio sem email", async () => {
  const [employees, patients] = await Promise.all([
    read("components/employees/employees-manager.tsx"),
    read("components/patients/patients-manager.tsx")
  ]);
  for (const source of [employees, patients]) {
    assert.match(source, /Enviar recuperacao de senha/);
    assert.match(source, /Cadastrar e-mail de acesso/);
    assert.match(source, /Cadastre um e-mail de acesso antes de enviar a recuperacao de senha/);
  }
});

test("service role permanece restrita ao servidor", async () => {
  const clientFiles = await Promise.all([read("app/login/page.tsx"), read("app/redefinir-senha/page.tsx"), read("components/employees/employees-manager.tsx"), read("components/patients/patients-manager.tsx")]);
  clientFiles.forEach((source) => assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/));
});
