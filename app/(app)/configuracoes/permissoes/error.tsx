"use client";

export default function PermissoesUsuariosError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <div>
        <p className="text-sm font-medium uppercase text-muted-foreground">
          Configuracoes
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Permissoes de Usuarios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nao foi possivel carregar a interface de permissoes neste momento.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-destructive p-4 text-destructive">
        {error.message || "Erro inesperado ao carregar permissoes."}
      </div>

      <button
        type="button"
        className="mt-4 rounded-md border px-4 py-2 text-sm font-semibold"
        onClick={reset}
      >
        Tentar novamente
      </button>
    </div>
  );
}
