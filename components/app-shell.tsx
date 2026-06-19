"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { PermissionModuleKey } from "@/lib/permission-modules";

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  visibleModules?: PermissionModuleKey[];
};

export function AppShell({ children, userEmail, visibleModules }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
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

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-72"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate font-semibold">MWFSystem</p>
              <p className="truncate text-xs text-muted-foreground">ADM Master</p>
            </div>
          ) : null}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="border-b p-4">
        <div
          className={cn(
            "rounded-lg border bg-secondary/45 p-3",
            collapsed && "px-2 text-center"
          )}
        >
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {collapsed ? "Clínica" : "Clínica atual"}
          </p>
          {!collapsed ? (
            <>
              <p className="mt-1 truncate text-sm font-semibold">Rede MWF</p>
              <p className="truncate text-xs text-muted-foreground">
                Visualização consolidada
              </p>
            </>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.title}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className={cn("w-full justify-start", collapsed && "justify-center px-0")}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed ? <span>Sair</span> : null}
          </Button>
        </form>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200 lg:pl-72",
          collapsed && "lg:pl-[76px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
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
              <p className="text-sm font-medium">Painel administrativo</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {userEmail ?? "Sessão Supabase"}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
