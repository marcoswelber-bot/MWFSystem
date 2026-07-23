export type PermissionEmployeeFilter = {
  id: string;
  clinic_id: string | null;
  name: string;
  email?: string | null;
  login_email?: string | null;
  role?: string | null;
  status: string;
};

export function normalizePermissionSearch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function filterPermissionEmployees<T extends PermissionEmployeeFilter>(
  employees: T[],
  clinicId: string,
  filters: { search?: string; role?: string; status?: string } = {}
) {
  const term = normalizePermissionSearch(filters.search);
  return employees.filter((employee) => {
    if (employee.clinic_id !== clinicId) return false;
    const matchesSearch =
      !term ||
      [employee.name, employee.email, employee.login_email, employee.role].some(
        (value) => normalizePermissionSearch(value).includes(term)
      );
    const matchesRole =
      !filters.role || filters.role === "all" || employee.role === filters.role;
    const matchesStatus =
      !filters.status ||
      filters.status === "all" ||
      employee.status === filters.status;
    return matchesSearch && matchesRole && matchesStatus;
  });
}
