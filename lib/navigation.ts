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

export const appNavigation = [
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
    moduleKey: "servicos"
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
    moduleKey: "configuracoes"
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
