import { PageHeader } from "@/components/page-header";
import { ServicesManager } from "@/components/services/services-manager";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Category = Database["public"]["Tables"]["service_categories"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
type ProfessionalLink =
  Database["public"]["Tables"]["service_professionals"]["Row"] & {
    service_name: string;
    employee_name: string;
  };
type ServicePackage = Database["public"]["Tables"]["service_packages"]["Row"];
type Discount = Database["public"]["Tables"]["service_discounts"]["Row"] & {
  service_name: string;
};
type CommercialRule = Database["public"]["Tables"]["commercial_rules"]["Row"];
type TreatmentGoal = Database["public"]["Tables"]["treatment_goals"]["Row"];
type Protocol = Database["public"]["Tables"]["treatment_protocols"]["Row"] & {
  goal_name: string;
};
type Resource = Database["public"]["Tables"]["service_resources"]["Row"] & {
  service_name: string;
};
type InternalNotification =
  Database["public"]["Tables"]["internal_notifications"]["Row"] & {
    service_name: string;
    employee_name: string;
  };
type AuditLog = Database["public"]["Tables"]["service_audit_logs"]["Row"] & {
  service_name: string;
};

type ServicosPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function escapeSearchTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", " ");
}

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

export default async function ServicosPage({ searchParams }: ServicosPageProps) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  let services: Service[] = [];
  let categories: Category[] = [];
  let employees: Employee[] = [];
  let rawProfessionalLinks: Database["public"]["Tables"]["service_professionals"]["Row"][] = [];
  let packages: ServicePackage[] = [];
  let rawDiscounts: Database["public"]["Tables"]["service_discounts"]["Row"][] = [];
  let commercialRules: CommercialRule[] = [];
  let goals: TreatmentGoal[] = [];
  let rawProtocols: Database["public"]["Tables"]["treatment_protocols"]["Row"][] = [];
  let rawResources: Database["public"]["Tables"]["service_resources"]["Row"][] = [];
  let rawNotifications: Database["public"]["Tables"]["internal_notifications"]["Row"][] = [];
  let rawAuditLogs: Database["public"]["Tables"]["service_audit_logs"]["Row"][] = [];
  let loadError: string | undefined;

  try {
    const supabase = await createClient();
    let servicesQuery = supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const term = escapeSearchTerm(search);
      servicesQuery = servicesQuery.or(
        `name.ilike.%${term}%,internal_code.ilike.%${term}%,category.ilike.%${term}%,classification.ilike.%${term}%`
      );
    }

    const servicesResult = await servicesQuery;
    if (servicesResult.error) {
      loadError = appendLoadError(loadError, servicesResult.error);
    } else {
      services = servicesResult.data ?? [];
    }

    const [
      categoriesResult,
      employeesResult,
      professionalLinksResult,
      packagesResult,
      discountsResult,
      rulesResult,
      goalsResult,
      protocolsResult,
      resourcesResult,
      notificationsResult,
      auditLogsResult
    ] = await Promise.all([
      supabase.from("service_categories").select("*").order("name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true }),
      supabase
        .from("service_professionals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_packages")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_discounts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("commercial_rules")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("treatment_goals").select("*").order("name", { ascending: true }),
      supabase
        .from("treatment_protocols")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_resources")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("internal_notifications")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
    ]);

    if (categoriesResult.error) {
      loadError = appendLoadError(loadError, categoriesResult.error);
    } else {
      categories = categoriesResult.data ?? [];
    }

    if (employeesResult.error) {
      loadError = appendLoadError(loadError, employeesResult.error);
    } else {
      employees = employeesResult.data ?? [];
    }

    if (professionalLinksResult.error) {
      loadError = appendLoadError(loadError, professionalLinksResult.error);
    } else {
      rawProfessionalLinks = professionalLinksResult.data ?? [];
    }

    if (packagesResult.error) {
      loadError = appendLoadError(loadError, packagesResult.error);
    } else {
      packages = packagesResult.data ?? [];
    }

    if (discountsResult.error) {
      loadError = appendLoadError(loadError, discountsResult.error);
    } else {
      rawDiscounts = discountsResult.data ?? [];
    }

    if (rulesResult.error) {
      loadError = appendLoadError(loadError, rulesResult.error);
    } else {
      commercialRules = rulesResult.data ?? [];
    }

    if (goalsResult.error) {
      loadError = appendLoadError(loadError, goalsResult.error);
    } else {
      goals = goalsResult.data ?? [];
    }

    if (protocolsResult.error) {
      loadError = appendLoadError(loadError, protocolsResult.error);
    } else {
      rawProtocols = protocolsResult.data ?? [];
    }

    if (resourcesResult.error) {
      loadError = appendLoadError(loadError, resourcesResult.error);
    } else {
      rawResources = resourcesResult.data ?? [];
    }

    if (notificationsResult.error) {
      loadError = appendLoadError(loadError, notificationsResult.error);
    } else {
      rawNotifications = notificationsResult.data ?? [];
    }

    if (auditLogsResult.error) {
      loadError = appendLoadError(loadError, auditLogsResult.error);
    } else {
      rawAuditLogs = auditLogsResult.data ?? [];
    }
  } catch (error) {
    loadError = appendLoadError(loadError, error);
  }

  const servicesById = new Map(services.map((service) => [service.id, service.name]));
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee.name])
  );
  const goalsById = new Map(goals.map((goal) => [goal.id, goal.name]));

  const professionalLinks: ProfessionalLink[] = rawProfessionalLinks.map((link) => ({
    ...link,
    service_name: servicesById.get(link.service_id) ?? "Servico nao encontrado",
    employee_name: employeesById.get(link.employee_id) ?? "Profissional nao encontrado"
  }));
  const discounts: Discount[] = rawDiscounts.map((discount) => ({
    ...discount,
    service_name: discount.service_id
      ? servicesById.get(discount.service_id) ?? "Servico nao encontrado"
      : "-"
  }));
  const protocols: Protocol[] = rawProtocols.map((protocol) => ({
    ...protocol,
    goal_name: protocol.goal_id
      ? goalsById.get(protocol.goal_id) ?? "Objetivo nao encontrado"
      : "-"
  }));
  const resources: Resource[] = rawResources.map((resource) => ({
    ...resource,
    service_name: servicesById.get(resource.service_id) ?? "Servico nao encontrado"
  }));
  const notifications: InternalNotification[] = rawNotifications.map(
    (notification) => ({
      ...notification,
      service_name: notification.service_id
        ? servicesById.get(notification.service_id) ?? "Servico nao encontrado"
        : "-",
      employee_name: notification.employee_id
        ? employeesById.get(notification.employee_id) ?? "Profissional nao encontrado"
        : "-"
    })
  );
  const auditLogs: AuditLog[] = rawAuditLogs.map((log) => ({
    ...log,
    service_name: log.service_id
      ? servicesById.get(log.service_id) ?? "Servico nao encontrado"
      : "-"
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Catalogo clinico"
        title="Servicos"
        description="Base completa de servicos, procedimentos, pacotes, protocolos, descontos, recursos e notificacoes internas."
      />

      <ServicesManager
        services={services}
        categories={categories}
        employees={employees}
        professionalLinks={professionalLinks}
        packages={packages}
        discounts={discounts}
        commercialRules={commercialRules}
        goals={goals}
        protocols={protocols}
        resources={resources}
        notifications={notifications}
        auditLogs={auditLogs}
        initialSearch={search}
        loadError={loadError}
      />
    </div>
  );
}
