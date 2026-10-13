import { db } from "@/lib/db";
import demoAccount from "@/lib/demo-account.json";
import { AuthForm } from "../AuthForm";

export const metadata = { title: "Log in · ExamPrep AI" };

export default async function LoginPage() {
  // Only advertise the demo login when the demo account has been seeded (npm run db:seed).
  const demoExists = await db.user.count({ where: { email: demoAccount.email } });
  const demo = demoExists ? { email: demoAccount.email, password: demoAccount.password } : null;
  return <AuthForm mode="login" demo={demo} />;
}
