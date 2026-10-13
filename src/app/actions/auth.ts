"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import demo from "@/lib/demo-account.json";
import { createSession, deleteSession } from "@/lib/session";
import type { ActionState } from "./types";

const SignupSchema = z.object({
  name: z.string("Enter your name.").trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  password: z.string("Enter a password.").min(8, "Password must be at least 8 characters."),
});

export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists." };
  }
  let userId: string;
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
    });
    userId = user.id;
  } catch (err) {
    // Two sign-ups racing for the same email: the unique index rejects the second.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "An account with that email already exists." };
    }
    throw err;
  }
  await createSession(userId);
  redirect("/dashboard");
}

const LoginSchema = z.object({
  email: z.string("Enter your email.").trim().toLowerCase().min(1, "Enter your email."),
  password: z.string("Enter your password.").min(1, "Enter your password."),
});

// Compared against when the email is unknown, so both failure paths take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Incorrect email or password." };
  await createSession(user.id);
  redirect("/dashboard");
}

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string("Enter your current password.").min(1, "Enter your current password."),
    newPassword: z.string("Enter a new password.").min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string("Confirm your new password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "The new passwords don't match." })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "Choose a password you aren't already using." });

export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const { id, email } = await requireUser();
  const parsed = ChangePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The login page advertises the demo credentials, so they must keep working.
  if (email === demo.email) {
    return { error: "The demo account's password can't be changed. Create your own account to try this." };
  }

  const user = await db.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  await db.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  return { ok: "Password updated. Use your new password next time you log in." };
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
