"use server";

import { cookies } from "next/headers";
import {
  ACTIVE_CLINIC_COOKIE,
  getAvailableClinicsForProfile,
  getCurrentAccessProfile
} from "@/lib/access-control";

export async function setActiveClinic(clinicId: string) {
  const profile = await getCurrentAccessProfile();
  const availableClinics = await getAvailableClinicsForProfile(profile);
  const cookieStore = await cookies();

  if (!profile || profile.kind === "blocked" || profile.kind === "unknown") {
    cookieStore.delete(ACTIVE_CLINIC_COOKIE);
    return;
  }

  if (profile.kind === "adm_master" && !clinicId) {
    cookieStore.delete(ACTIVE_CLINIC_COOKIE);
    return;
  }

  const canUseClinic = availableClinics.some((clinic) => clinic.id === clinicId);

  if (!canUseClinic) {
    cookieStore.delete(ACTIVE_CLINIC_COOKIE);
    return;
  }

  cookieStore.set(ACTIVE_CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}
