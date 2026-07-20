import { BarChart3, Bot, BriefcaseMedical, Building2, CalendarDays, ClipboardList, LayoutDashboard, PackageCheck, Settings, Stethoscope, UsersRound, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionModuleKey } from "@/lib/permission-modules";
export type NavigationItem={title:string;href:string;icon:LucideIcon;moduleKey:PermissionModuleKey;children?:Array<{title:string;href:string;moduleKey:PermissionModuleKey}>};
export const appNavigation:NavigationItem[]=[
 {title:"Dashboard",href:"/dashboard",icon:LayoutDashboard,moduleKey:"dashboard"},
 {title:"Pacientes",href:"/pacientes",icon:UsersRound,moduleKey:"pacientes"},
 {title:"Agenda",href:"/agenda",icon:CalendarDays,moduleKey:"agenda"},
 {title:"Financeiro",href:"/financeiro",icon:WalletCards,moduleKey:"financeiro",children:[
  {title:"Baixas e Repasses",href:"/financeiro/baixas",moduleKey:"financeiro"},
  {title:"Folha / Contracheque",href:"/financeiro/folha",moduleKey:"financeiro"}]},
 {title:"Prontuarios",href:"/prontuarios",icon:ClipboardList,moduleKey:"prontuarios"},
 {title:"Pacotes",href:"/pacotes",icon:PackageCheck,moduleKey:"pacotes"},
 {title:"Relatorios",href:"/relatorios",icon:BarChart3,moduleKey:"relatorios"},
 {title:"Funcionarios",href:"/funcionarios",icon:Stethoscope,moduleKey:"funcionarios"},
 {title:"Servicos",href:"/servicos",icon:BriefcaseMedical,moduleKey:"servicos",children:[
  {title:"Tipos de Servico",href:"/servicos?tab=serviceTypes",moduleKey:"tipos_servico"}]},
 {title:"Clinicas",href:"/clinicas",icon:Building2,moduleKey:"clinicas"},
 {title:"MWF IA",href:"/mwf-ia",icon:Bot,moduleKey:"mwf_ia"},
 {title:"Configuracoes",href:"/configuracoes",icon:Settings,moduleKey:"configuracoes",children:[
  {title:"Funcoes",href:"/configuracoes/funcoes",moduleKey:"funcoes"},
  {title:"Permissoes de Usuarios",href:"/configuracoes/permissoes",moduleKey:"configuracoes"}]}
];
