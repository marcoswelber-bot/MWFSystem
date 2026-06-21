import {
  BarChart3,
  BriefcaseMedical,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  Stethoscope,
  UsersRound,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionModuleKey } from "@/lib/permission-modules";

export type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  moduleKey: PermissionModuleKey;
  children?: Array<{
    title: string;
    href: string;
    moduleKey: PermissionModuleKey;
  }>;
};

export const appNavigation: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    moduleKey: "dashboard"
  },
  {
    title: "Pacientes",
    href: "/pacientes",
    icon: UsersRound,
    moduleKey: "pacientes"
  },
  {
    title: "Clinicas",
    href: "/clinicas",
    icon: Building2,
    moduleKey: "clinicas"
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarDays,
    moduleKey: "agenda"
  },
  {
    title: "Funcionarios",
    href: "/funcionarios",
    icon: Stethoscope,
    moduleKey: "funcionarios"
  },
  {
    title: "Financeiro",
    href: "/financeiro",
    icon: WalletCards,
    moduleKey: "financeiro"
  },
  {
    title: "Servicos",
    href: "/servicos",
    icon: BriefcaseMedical,
    moduleKey: "servicos",
    children: [
      {
        title: "Tipos de Servico",
        href: "/servicos?tab=serviceTypes",
        moduleKey: "tipos_servico"
      }
    ]
  },
  {
    title: "Prontuarios",
    href: "/prontuarios",
    icon: ClipboardList,
    moduleKey: "prontuarios"
  },
  {
    title: "Relatorios",
    href: "/relatorios",
    icon: BarChart3,
    moduleKey: "relatorios"
  },
  {
    title: "Configuracoes",
    href: "/configuracoes",
    icon: Settings,
    moduleKey: "configuracoes",
    children: [
      {
        title: "Permissoes de Usuarios",
        href: "/configuracoes/permissoes",
        moduleKey: "configuracoes"
      }
    ]
  }
] as const;

export const dashboardStats = [
  {
    label: "Clinicas ativas",
    value: "04",
    helper: "Operacao multiclinica",
    icon: CreditCard
  },
  {
    label: "Pacientes",
    value: "1.284",
    helper: "Base consolidada",
    icon: UsersRound
  },
  {
    label: "Agenda hoje",
    value: "38",
    helper: "Consultas e procedimentos",
    icon: CalendarDays
  },
  {
    label: "Receita mes",
    value: "R$ 86,4k",
    helper: "Previsto no financeiro",
    icon: WalletCards
  }
];
