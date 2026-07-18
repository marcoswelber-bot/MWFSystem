"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { setActiveClinic } from "@/app/(app)/clinic-actions";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { PermissionModuleKey } from "@/lib/permission-modules";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  clinics?: Array<{ id: string; name: string }>;
  activeClinicId?: string | null;
  isAdmMaster?: boolean;
  visibleModules?: PermissionModuleKey[];
};

export function AppShell({
  children,
  userEmail,
  userName,
  userRole,
  clinics = [],
  activeClinicId,
  isAdmMaster = false,
  visibleModules
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChangingClinic, startClinicTransition] = React.useTransition();
  const [collapsed, setCollapsed] = React.useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = React.useState(false);
  const [hoverExpanded, setHoverExpanded] = React.useState(false);
  const hoverCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [clinicPickerOpen, setClinicPickerOpen] = React.useState(false);
  const [clinicQuery, setClinicQuery] = React.useState("");
  const visibleModuleSet = React.useMemo(
    () => new Set(visibleModules ?? appNavigation.map((item) => item.moduleKey)),
    [visibleModules]
  );
  const visibleNavigation = appNavigation.filter((item) =>
    visibleModuleSet.has(item.moduleKey)
  );

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("mwf-sidebar-collapsed");
    if (stored === "true" || stored === "false") {
      setCollapsed(stored === "true");
    } else if (window.innerWidth < 1280) {
      setCollapsed(true);
    }
    setSidebarPreferenceLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    window.localStorage.setItem("mwf-sidebar-collapsed", String(collapsed));
  }, [collapsed, sidebarPreferenceLoaded]);

  React.useEffect(() => () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
  }, []);

  const sidebarCollapsed = collapsed && !hoverExpanded;

  const activeClinic = clinics.find((clinic) => clinic.id === activeClinicId);
  const clinicLabel =
    activeClinic?.name ?? (isAdmMaster ? "Todas as clinicas" : "Sem clinica");
  const hasClinicSelector = isAdmMaster ? clinics.length > 0 : clinics.length > 1;
  const normalizedClinicQuery = clinicQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredClinics = clinics.filter((clinic) =>
    clinic.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedClinicQuery)
  );

  function changeActiveClinic(value: string) {
    startClinicTransition(async () => {
      await setActiveClinic(value === "__all" ? "" : value);
      setClinicPickerOpen(false);
      setClinicQuery("");
      router.refresh();
    });
  }

  const sidebar = (
    <aside
      onMouseEnter={() => {
        if (!collapsed || window.matchMedia("(hover: hover)").matches === false) return;
        if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
        setHoverExpanded(true);
      }}
      onMouseLeave={() => {
        if (!collapsed) return;
        hoverCloseTimer.current = setTimeout(() => setHoverExpanded(false), 220);
      }}
      className={cn(
        "app-sidebar flex h-full flex-col bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] shadow-xl transition-[width] duration-200",
        sidebarCollapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/30">
            <Activity className="h-5 w-5" />
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">MWFSystem</p>
              <p className="truncate text-xs text-white/60">
                {userRole ?? "Painel administrativo"}
              </p>
            </div>
          ) : null}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Fixar sidebar expandida" : "Recolher sidebar"}
          title={collapsed ? "Fixar sidebar expandida" : "Recolher sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="border-b border-white/10 p-3">
        <div
          className={cn(
            "rounded-lg bg-white/5 p-2.5",
            sidebarCollapsed && "px-2 text-center"
          )}
        >
          <p className="text-xs font-medium uppercase text-white/50">
            {sidebarCollapsed ? "Clinica" : "Clinica atual"}
          </p>
          {!sidebarCollapsed ? (
            <>
              {hasClinicSelector ? (
                <button
                  type="button"
                  onClick={() => setClinicPickerOpen(true)}
                  disabled={isChangingClinic}
                  className="mt-2 min-h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold leading-5 text-white hover:bg-white/10"
                >
                  <span className="block break-words">{clinicLabel}</span>
                </button>
              ) : (
                <p className="mt-1 truncate text-sm font-semibold text-white">{clinicLabel}</p>
              )}
              <p className="truncate text-xs text-white/50">
                {isChangingClinic
                  ? "Atualizando..."
                  : isAdmMaster
                    ? "Escopo ADM Master"
                    : "Clinica vinculada"}
              </p>
            </>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const visibleChildren = item.children?.filter((child) => {
            if (child.moduleKey === "tipos_servico" && !isAdmMaster) {
              return false;
            }

            return visibleModuleSet.has(child.moduleKey);
          });

          return (
            <div key={item.href}>
              <Link
                href={item.href as Route}
                title={item.title}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                  active && "bg-[hsl(var(--sidebar-accent))]/15 text-[hsl(var(--sidebar-accent))] hover:bg-[hsl(var(--sidebar-accent))]/15 hover:text-[hsl(var(--sidebar-accent))]",
                  sidebarCollapsed && "justify-center px-0"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed ? <span className="truncate">{item.title}</span> : null}
              </Link>
              {!sidebarCollapsed && visibleChildren?.length ? (
                <div className="ml-8 mt-1 space-y-1">
                  {visibleChildren.map((child) => {
                    const childActive = pathname === child.href;

                    return (
                      <Link
                        key={child.href}
                        href={child.href as Route}
                        title={child.title}
                        className={cn(
                          "flex h-9 items-center rounded-md px-3 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white",
                          childActive && "bg-white/10 text-white"
                        )}
                      >
                        {child.title}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className={cn("w-full justify-start text-white/70 hover:bg-white/10 hover:text-white", sidebarCollapsed && "justify-center px-0")}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed ? <span>Sair</span> : null}
          </Button>
        </form>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="app-sidebar hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="app-sidebar fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      ) : null}

      {clinicPickerOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/65 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Selecionar clínica">
          <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-background p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Selecionar clínica</h2><p className="text-sm text-muted-foreground">Escolha o escopo de trabalho.</p></div>
              <Button type="button" variant="ghost" onClick={() => setClinicPickerOpen(false)}>Fechar</Button>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <input autoFocus value={clinicQuery} onChange={(event) => setClinicQuery(event.target.value)} placeholder="Pesquisar clínica" className="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="mt-3 grid min-h-0 gap-2 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {isAdmMaster ? <button type="button" onClick={() => changeActiveClinic("__all")} className={cn("min-h-12 rounded-md border p-3 text-left font-medium hover:bg-muted", !activeClinicId && "border-primary bg-primary/5")}>Todas as clínicas</button> : null}
              {filteredClinics.map((clinic) => <button key={clinic.id} type="button" onClick={() => changeActiveClinic(clinic.id)} className={cn("min-h-12 rounded-md border p-3 text-left font-medium hover:bg-muted", activeClinicId === clinic.id && "border-primary bg-primary/5")}>{clinic.name}</button>)}
              {filteredClinics.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma clínica encontrada.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200 lg:pl-72",
          collapsed && "lg:pl-[68px]"
        )}
      >
        <header className="app-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/70 bg-background/80 px-4 backdrop-blur-xl dark:border-white/10 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-sm font-medium">{userName ?? userEmail ?? "Usuario"}</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {userRole ?? "Perfil do sistema"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
              aria-label="Buscar"
              title="Buscar"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Notificacoes"
              title="Notificacoes"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-primary" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <main className="app-main relative mx-auto w-full max-w-7xl p-4 md:p-6" aria-busy={isChangingClinic}>
          {isChangingClinic ? (
            <div className="absolute inset-0 z-20 flex min-h-40 items-start justify-center bg-background/70 pt-12 backdrop-blur-sm" role="status">
              <span className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm">Atualizando dados da clinica...</span>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

