import { cn } from "@/lib/utils";

type ResultProps = { title: string; lines: string[]; tone?: "default" | "warning" | "success" };

function ResultCard({ title, lines, tone }: ResultProps) {
  return <div className={cn("rounded-xl border bg-background/80 p-3", tone === "warning" && "border-amber-500/40 bg-amber-500/5", tone === "success" && "border-emerald-500/40 bg-emerald-500/5")}><strong className="text-xs uppercase tracking-wide">{title}</strong><ul className="mt-2 grid gap-1.5 text-xs">{lines.map((line, index) => <li key={`${line}-${index}`} className="break-words">{line}</li>)}</ul></div>;
}

export const PatientResults = (props: ResultProps) => <ResultCard {...props} />;
export const EmployeeResults = (props: ResultProps) => <ResultCard {...props} />;
export const AppointmentResults = (props: ResultProps) => <ResultCard {...props} />;
export const CommissionResults = (props: ResultProps) => <ResultCard {...props} />;
export const PayrollResults = (props: ResultProps) => <ResultCard {...props} />;
export const FinancialResults = (props: ResultProps) => <ResultCard {...props} />;
export const ClarificationOptions = (props: ResultProps) => <ResultCard {...props} />;
export const ConfirmationCard = (props: ResultProps) => <ResultCard {...props} />;
export const EmptyState = (props: ResultProps) => <ResultCard {...props} />;
export const ErrorState = (props: ResultProps) => <ResultCard {...props} />;

const resultComponents = { PatientResults, EmployeeResults, AppointmentResults, CommissionResults, PayrollResults, FinancialResults, ClarificationOptions, ConfirmationCard, EmptyState, ErrorState };
export function AssistantResponseCard(props: ResultProps) {
  const Component = resultComponents[props.title as keyof typeof resultComponents] ?? ResultCard;
  return <Component {...props} />;
}
