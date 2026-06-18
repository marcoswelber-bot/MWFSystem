"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import {
  createPatient,
  deactivatePatient,
  type PatientActionResult,
  type PatientFormInput,
  updatePatient
} from "@/app/(app)/pacientes/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/types/database";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

type PatientsManagerProps = {
  patients: Patient[];
  initialSearch: string;
  loadError?: string;
};

const emptyForm: PatientFormInput = {
  full_name: "",
  cpf: "",
  birth_date: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  status: "active"
};

function patientToForm(patient: Patient): PatientFormInput {
  return {
    full_name: patient.full_name,
    cpf: patient.cpf ?? "",
    birth_date: patient.birth_date ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    notes: patient.notes ?? "",
    status: patient.status
  };
}

export function PatientsManager({
  patients,
  initialSearch,
  loadError
}: PatientsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState(initialSearch);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [form, setForm] = React.useState<PatientFormInput>(emptyForm);
  const [message, setMessage] = React.useState<PatientActionResult | null>(
    loadError ? { ok: false, message: loadError } : null
  );

  function updateForm(field: keyof PatientFormInput, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function openCreateForm() {
    setEditingPatient(null);
    setForm(emptyForm);
    setMessage(null);
    setFormOpen(true);
  }

  function openEditForm(patient: Patient) {
    setEditingPatient(patient);
    setForm(patientToForm(patient));
    setMessage(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingPatient(null);
    setForm(emptyForm);
    setFormOpen(false);
  }

  function refreshPatients() {
    router.refresh();
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/pacientes?q=${encodeURIComponent(query)}` : "/pacientes");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.full_name.trim()) {
      setMessage({ ok: false, message: "Nome do paciente e obrigatorio." });
      return;
    }

    startTransition(async () => {
      const result = editingPatient
        ? await updatePatient(editingPatient.id, form)
        : await createPatient(form);

      setMessage(result);

      if (result.ok) {
        closeForm();
        refreshPatients();
      }
    });
  }

  function handleDeactivate(patient: Patient) {
    const confirmed = window.confirm(
      `Deseja excluir o paciente ${patient.full_name}?`
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deactivatePatient(patient.id);
      setMessage(result);

      if (result.ok) {
        refreshPatients();
      }
    });
  }

  const activeCount = patients.filter((patient) => patient.status === "active").length;
  const inactiveCount = patients.length - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <form onSubmit={submitSearch} className="flex max-w-xl flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, CPF ou telefone"
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>

        <Button
          type="button"
          aria-expanded={formOpen}
          aria-controls="patient-form"
          onClick={openCreateForm}
        >
          <Plus className="h-4 w-4" />
          Novo paciente
        </Button>
      </div>

      {message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.ok
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {message.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{activeCount}</CardTitle>
            <CardDescription>Pacientes ativos</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{patients.length}</CardTitle>
            <CardDescription>Registros encontrados</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{inactiveCount}</CardTitle>
            <CardDescription>Pacientes inativos</CardDescription>
          </CardHeader>
        </Card>
      </section>

      {formOpen ? (
        <Card id="patient-form">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>
                {editingPatient ? "Editar paciente" : "Novo paciente"}
              </CardTitle>
              <CardDescription>
                Preencha os dados principais do cadastro.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeForm}
              aria-label="Fechar formulario"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(event) => updateForm("full_name", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(event) => updateForm("cpf", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={form.birth_date}
                  onChange={(event) => updateForm("birth_date", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Endereco</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Observacoes</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pacientes cadastrados</CardTitle>
          <CardDescription>
            Dados carregados diretamente do Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-medium">Nome</th>
                <th className="py-3 pr-4 font-medium">CPF</th>
                <th className="py-3 pr-4 font-medium">Telefone</th>
                <th className="py-3 pr-4 font-medium">Email</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <tr key={patient.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{patient.full_name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {patient.cpf ?? "-"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {patient.phone ?? "-"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {patient.email ?? "-"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                        {patient.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditForm(patient)}
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending || patient.status === "inactive"}
                          onClick={() => handleDeactivate(patient)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
