import { getDemoLeagueSnapshot } from "@/lib/data/demo-league-state";
import { createMockSnapshot } from "@/lib/data/mock";
import type { LeagueSnapshot } from "@/lib/domain/types";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export async function getLeagueSnapshot(): Promise<LeagueSnapshot> {
  if (!hasSupabaseServerEnv) {
    return getDemoLeagueSnapshot();
  }

  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return createMockSnapshot();
    }

    const { data: championships } = await supabase
      .from("championships")
      .select("*")
      .limit(1);

    if (!championships || championships.length === 0) {
      return getDemoLeagueSnapshot();
    }

    return getDemoLeagueSnapshot();
  } catch {
    return getDemoLeagueSnapshot();
  }
}
