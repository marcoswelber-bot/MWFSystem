"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

type PatientsManagerProps = {
  patients: Patient[];
  initialSearch: string;
  loadError?: string;
};

export function PatientsManager({
  patients,
  initialSearch,
  loadError
}: PatientsManagerProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "grid", gap: "12px" }}>
        <label htmlFor="patient-search">Buscar por nome, CPF ou telefone</label>
        <input
          id="patient-search"
          name="q"
          defaultValue={initialSearch}
          placeholder="Buscar por nome, CPF ou telefone"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            padding: "10px",
            width: "100%"
          }}
        />
      </div>

      <button
        style={{ background: "red", padding: "20px" }}
        onClick={() => {
          console.log("CLIQUE");
          alert("CLIQUE");
          setFormOpen(true);
        }}
      >
        Novo paciente
      </button>

      <div>formOpen = {String(formOpen)}</div>

      {formOpen && (
        <div
          style={{
            background: "white",
            color: "black",
            padding: "20px",
            border: "5px solid red"
          }}
        >
          FORMULÁRIO ABERTO
        </div>
      )}

      {loadError ? (
        <div style={{ color: "red", border: "1px solid red", padding: "12px" }}>
          {loadError}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #d1d5db", padding: "8px" }}>
                Nome
              </th>
              <th style={{ borderBottom: "1px solid #d1d5db", padding: "8px" }}>
                CPF
              </th>
              <th style={{ borderBottom: "1px solid #d1d5db", padding: "8px" }}>
                Telefone
              </th>
              <th style={{ borderBottom: "1px solid #d1d5db", padding: "8px" }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.length > 0 ? (
              patients.map((patient) => (
                <tr key={patient.id}>
                  <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                    {patient.full_name}
                  </td>
                  <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                    {patient.cpf ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                    {patient.phone ?? "-"}
                  </td>
                  <td style={{ borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                    {patient.status}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: "16px", textAlign: "center" }}>
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
