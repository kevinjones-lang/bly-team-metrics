import { humanError } from "./logic.ts";
import { markSent, writeBackReferral, type Referral } from "./api.ts";

export async function confirmHandoffSent(input: {
  id: string;
  agent: string;
  email: string;
  isa: string;
  shortlist: string;
}): Promise<{ referral: Referral; fubMessage: string }> {
  const referral = await markSent(input);
  try {
    const fub = await writeBackReferral(input.id);
    return { referral, fubMessage: fub.message };
  } catch (e) {
    return { referral, fubMessage: humanError(e) };
  }
}
