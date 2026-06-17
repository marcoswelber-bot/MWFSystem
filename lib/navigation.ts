import {
  BarChart3,
  BriefcaseMedical,
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
    icon: LayoutDashboard
  },
  {
    title: "Pacientes",
    href: "/pacientes",
    icon: UsersRound
  },
  {
    title: "Agenda",
    href: "/agenda",
    icon: CalendarDays
  },
  {
    title: "Funcionários",
    href: "/funcionarios",
    icon: Stethoscope
  },
  {
    title: "Financeiro",
    href: "/financeiro",
    icon: WalletCards
  },
  {
    title: "Serviços",
    href: "/servicos",
    icon: BriefcaseMedical
  },
  {
    title: "Prontuários",
    href: "/prontuarios",
    icon: ClipboardList
  },
  {
    title: "Relatórios",
    href: "/relatorios",
    icon: BarChart3
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings
  }
] as const;

export const dashboardStats = [
  {
    label: "Clínicas ativas",
    value: "04",
    helper: "Operação multiclínica",
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
    label: "Receita mês",
    value: "R$ 86,4k",
    helper: "Previsto no financeiro",
    icon: WalletCards
  }
];
