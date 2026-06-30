import { PayrollManager } from "@/components/finance/payroll-manager";
import { PageHeader } from "@/components/page-header";
import { getCurrentClinicScope } from "@/lib/access-control";
import { getCurrentPermissionMap, isCurrentUserAdmMaster } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PayrollEntry = Database["public"]["Tables"]["payroll_entries"]["Row"];
type FinancialTransaction = Database["public"]["Tables"]["financial_transactions"]["Row"];
type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];

type HydratedPayrollEntry = PayrollEntry & {
  clinic_name: string;
  employee_name: string;
  financial_status: string;
  financial_paid_amount: number;
  financial_open_amount: number;
};

type HydratedFinancialTransaction = FinancialTransaction & {
  clinic_name: string;
  employee_name: string;
};

function appendLoadError(currentError: string | undefined, nextError: unknown) {
  const message = getErrorMessage(nextError);
  return currentError ? `${currentError} ${message}` : message;
}

async function readSupabaseList<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
) {
  try {
    const { data, error } = await query;
    if (error) return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
    return { data: data ?? [], error: undefined };
  } catch (error) {
    return { data: [], error: `[${label}] ${getErrorMessage(error)}` };
  }
}

function getOpenAmount(transaction?: FinancialTransaction) {
  if (!transaction || transaction.status === "pago" || transaction.status === "cancelado") return 0;
  const row = transaction as FinancialTransaction & { open_amount?: number | null; paid_amount?: number | null };
  if (typeof row.open_amount === "number") return Math.max(row.open_amount, 0);
  return Math.max(transaction.amount - Number(row.paid_amount ?? 0), 0);
}

function getPaidAmount(transaction?: FinancialTransaction) {
  const row = transaction as (FinancialTransaction & { paid_amount?: number | null }) | undefined;
  if (typeof row?.paid_amount === "number") return Math.max(row.paid_amount, 0);
  return transaction?.status === "pago" ? transaction.amount : 0;
}

export default async function FolhaFinanceiroPage() {
  const permissions = await getCurrentPermissionMap();
  const isAdmMaster = await isCurrentUserAdmMaster();
  const clinicScope = await getCurrentClinicScope();
  let entries: PayrollEntry[] = [];
  let transactions: FinancialTransaction[] = [];
  let clinics: Clinic[] = [];
  let employees: Employee[] = [];
  let loadError: string | undefined;

  if (!clinicScope.isAdmMaster && !clinicScope.clinicId) {
    loadError = "Usuario sem clinica vinculada.";
  } else {
    try {
      const supabase = await createClient();
      const clinicFilter = clinicScope.clinicId;
      const clinicsQuery = clinicFilter ? supabase.from("clinics").select("*").eq("id", clinicFilter) : supabase.from("clinics").select("*");
      const employeesQuery = clinicFilter ? supabase.from("employees").select("*").eq("clinic_id", clinicFilter) : supabase.from("employees").select("*");
      const entriesQuery = clinicFilter ? supabase.from("payroll_entries").select("*").eq("clinic_id", clinicFilter) : supabase.from("payroll_entries").select("*");
      const transactionsQuery = clinicFilter ? supabase.from("financial_transactions").select("*").eq("clinic_id", clinicFilter) : supabase.from("financial_transactions").select("*");

      const [entriesResult, transactionsResult, clinicsResult, employeesResult] = await Promise.all([
        readSupabaseList<PayrollEntry>("payroll_entries", entriesQuery.order("created_at", { ascending: false })),
        readSupabaseList<FinancialTransaction>("financial_transactions", transactionsQuery.order("due_date", { ascending: false })),
        readSupabaseList<Clinic>("clinics", clinicsQuery.order("name", { ascending: true })),
        readSupabaseList<Employee>("employees", employeesQuery.order("name", { ascending: true }))
      ]);

      entries = entriesResult.data;
      transactions = transactionsResult.data;
      clinics = clinicsResult.data;
      employees = employeesResult.data;

      [entriesResult.error, transactionsResult.error, clinicsResult.error, employeesResult.error].forEach((error) => {
        if (error) loadError = appendLoadError(loadError, error);
      });
    } catch (error) {
      loadError = appendLoadError(loadError, error);
    }
  }

  const clinicsById = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const employeesById = new Map(employees.map((employee) => [employee.id, employee.name]));
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));

  const hydratedEntries: HydratedPayrollEntry[] = entries.map((entry) => {
    const transaction = entry.financial_transaction_id ? transactionsById.get(entry.financial_transaction_id) : undefined;
    return {
      ...entry,
      clinic_name: clinicsById.get(entry.clinic_id) ?? "Clinica nao encontrada",
      employee_name: employeesById.get(entry.employee_id) ?? "Funcionario nao encontrado",
      financial_status: transaction?.status ?? entry.status,
      financial_paid_amount: getPaidAmount(transaction),
      financial_open_amount: getOpenAmount(transaction)
    };
  });

  const payrollTransactionIds = new Set(entries.map((entry) => entry.financial_transaction_id).filter(Boolean));
  const hydratedCommissions: HydratedFinancialTransaction[] = transactions
    .filter((transaction) => transaction.transaction_type === "despesa" && transaction.commission_status === "generated" && !payrollTransactionIds.has(transaction.id))
    .map((transaction) => ({
      ...transaction,
      clinic_name: clinicsById.get(transaction.clinic_id) ?? "Clinica nao encontrada",
      employee_name: transaction.employee_id ? employeesById.get(transaction.employee_id) ?? "Funcionario nao encontrado" : "Funcionario nao encontrado"
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Gestao financeira"
        title="Folha / Contracheque"
        description="Lance salario, vales, descontos e encargos vinculados ao funcionario, integrando automaticamente ao Financeiro."
      />
      <PayrollManager
        entries={hydratedEntries}
        commissionTransactions={hydratedCommissions}
        clinics={clinics}
        employees={employees}
        currentClinicId={clinicScope.clinicId}
        isAdmMaster={isAdmMaster}
        loadError={loadError}
        permissions={permissions.financeiro}
      />
    </div>
  );
}