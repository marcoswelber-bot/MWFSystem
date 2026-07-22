import { capabilityRegistry } from "./capability-registry.ts";
import type { MwfAiDomain, MwfAiInterpretation } from "./types.ts";

export type DiscoveryPlan = { primary: MwfAiDomain[]; expansion: MwfAiDomain[]; perDomainLimit: number; progressive: true };

export function buildDiscoveryPlan(interpretation: MwfAiInterpretation, canView: (permission: string) => boolean): DiscoveryPlan {
  const allowed: MwfAiDomain[] = capabilityRegistry.filter(capability => canView(capability.permission)).map(capability => capability.domain);
  const contextual = [interpretation.domain, interpretation.currentDomain].filter((domain): domain is MwfAiDomain => Boolean(domain && domain !== "unknown" && allowed.includes(domain)));
  const entityDomains: MwfAiDomain[] = interpretation.entities.some(entity => entity.type === "number")
    ? ["pacientes", "agenda", "financeiro", "pacotes"]
    : [];
  const primary = [...new Set([...contextual, ...entityDomains.filter(domain => allowed.includes(domain))])].slice(0, 3);
  return { primary, expansion: allowed.filter(domain => !primary.includes(domain)), perDomainLimit: 5, progressive: true };
}
