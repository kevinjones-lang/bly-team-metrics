import { supabase } from "../sb";

export type StaffGate = "staff" | "restricted" | "error";

/** Staff stay on is_staff(). Google and email can claim an unclaimed staff row with the same confirmed email. */
export async function resolveStaff(): Promise<StaffGate> {
  const first = await supabase.rpc("is_staff");
  if (first.error) return "error";
  if (first.data === true) return "staff";
  const linked = await supabase.rpc("link_staff_identity");
  if (linked.error || linked.data !== true) return "restricted";
  return "staff";
}
