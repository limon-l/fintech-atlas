"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, setActiveOrg, signIn, signInDemo, signOut } from "@/lib/auth";
import { homeFor, safeNext } from "@/lib/home";

export interface AuthState {
  error?: string;
}

export async function signInAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { error: "Enter your email and password." };

  const result = await signIn(email, password);
  if (!result.ok) return { error: result.message };

  const user = await getCurrentUser();
  redirect(next ?? (user ? homeFor(user) : "/app"));
}

export async function demoSignInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const result = await signInDemo(email);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.message ?? "Unable to sign in")}`);
  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : "/app");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

export async function switchOrgAction(formData: FormData): Promise<void> {
  const orgId = String(formData.get("orgId") ?? "");
  if (orgId) await setActiveOrg(orgId);
  redirect("/business");
}
