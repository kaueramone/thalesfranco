import { notFound } from "next/navigation";
import { admin, uuid } from "@/lib/server";
import { workoutSchema } from "@/lib/model";
import WorkoutView from "@/components/workout-view";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!uuid.test(token)) notFound();
  const { data } = await admin()
    .from("publications")
    .select("content")
    .eq("token", token)
    .eq("revoked", false)
    .maybeSingle();
  if (!data) notFound();
  return (
    <WorkoutView workout={workoutSchema.parse(data.content)} token={token} />
  );
}
