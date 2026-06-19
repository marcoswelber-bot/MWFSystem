export const permissionActions = [
  "view",
  "create",
  "edit",
  "delete",
  "toggle"
] as const;

export type PermissionAction = (typeof permissionActions)[number];

export const permissionModules = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "pacientes", label: "Pacientes", href: "/pacientes" },
  { key: "clinicas", label: "Clinicas", href: "/clinicas" },
  { key: "agenda", label: "Agenda", href: "/agenda" },
  { key: "funcionarios", label: "Funcionarios", href: "/funcionarios" },
  { key: "financeiro", label: "Financeiro", href: "/financeiro" },
  { key: "servicos", label: "Servicos", href: "/servicos" },
  { key: "tipos_servico", label: "Tipos de Servico", href: "/servicos" },
  { key: "servicos_basicos", label: "Servicos Basicos", href: "/servicos" },
  { key: "servicos_avancados", label: "Servicos Avancados", href: "/servicos" },
  { key: "comissoes", label: "Comissoes", href: "/funcionarios" },
  { key: "pacotes", label: "Pacotes", href: "/servicos" },
  { key: "descontos", label: "Descontos", href: "/servicos" },
  { key: "regras", label: "Regras", href: "/servicos" },
  { key: "protocolos", label: "Protocolos", href: "/servicos" },
  { key: "recursos", label: "Recursos", href: "/servicos" },
  { key: "notificacoes", label: "Notificacoes", href: "/servicos" },
  { key: "prontuarios", label: "Prontuarios", href: "/prontuarios" },
  { key: "relatorios", label: "Relatorios", href: "/relatorios" },
  { key: "configuracoes", label: "Configuracoes", href: "/configuracoes" }
] as const;

export type PermissionModuleKey = (typeof permissionModules)[number]["key"];

export type PermissionSet = Record<PermissionAction, boolean>;

export const emptyPermissionSet: PermissionSet = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  toggle: false
};

export const fullPermissionSet: PermissionSet = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  toggle: true
};

export const permissionActionLabels: Record<PermissionAction, string> = {
  view: "visualizar",
  create: "criar",
  edit: "editar",
  delete: "excluir",
  toggle: "ativar/inativar"
};

export function isAdmRole(role?: string | null) {
  const normalizedRole = role
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return normalizedRole === "adm_master";
}

export type PermissionMap = Record<PermissionModuleKey, PermissionSet>;

export function getEmptyPermissionMap() {
  return Object.fromEntries(
    permissionModules.map((module) => [module.key, { ...emptyPermissionSet }])
  ) as PermissionMap;
}

export function getFullPermissionMap() {
  return Object.fromEntries(
    permissionModules.map((module) => [module.key, { ...fullPermissionSet }])
  ) as PermissionMap;
}
