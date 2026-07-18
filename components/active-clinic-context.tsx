"use client";

import * as React from "react";

export type ActiveClinicOption = { id: string; name: string };
const ActiveClinicContext = React.createContext<ActiveClinicOption | null>(null);

export function ActiveClinicProvider({ clinic, children }: { clinic: ActiveClinicOption | null; children: React.ReactNode }) {
  return <ActiveClinicContext.Provider value={clinic}>{children}</ActiveClinicContext.Provider>;
}

export function useActiveClinic() {
  return React.useContext(ActiveClinicContext);
}
