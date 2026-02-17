import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  // Get all bearings with their latest RUL reading
  const { data: bearings, error: bearingsError } = await supabase
    .from("bearings")
    .select("*")
    .order("name");

  if (bearingsError) {
    return NextResponse.json({ error: bearingsError.message }, { status: 500 });
  }

  // Get RUL + vibration history for each bearing (latest readings)
  const bearingsWithHistory = await Promise.all(
    bearings.map(async (bearing) => {
      const { data: rulReadings, error: rulReadingsError } = await supabase
        .from("rul_readings")
        .select("*")
        .eq("bearing_id", bearing.id)
        .order("batch_number", { ascending: false })
        .limit(10000);

      const { data: vibrationReadings, error: vibrationReadingsError } = await supabase
        .from("vibration_readings")
        .select("*")
        .eq("bearing_id", bearing.id)
        .order("batch_number", { ascending: false })
        .limit(10000);

      if (rulReadingsError || vibrationReadingsError) {
        return {
          ...bearing,
          rulReadings: [],
          vibrationReadings: [],
          latestRul: null,
          lastUpdated: null,
        };
      }

      // Latest readings are the first ones (descending order)
      const latestRulReading = rulReadings.length > 0 ? rulReadings[0] : null;
      const latestVibrationReading =
        vibrationReadings.length > 0 ? vibrationReadings[0] : null;

      // Reverse to get ascending order for chart display
      const sortedRulReadings = [...rulReadings].reverse();
      const sortedVibrationReadings = [...vibrationReadings].reverse();

      const lastUpdatedCandidates = [
        latestRulReading?.created_at,
        latestVibrationReading?.created_at,
      ].filter(Boolean) as string[];

      const lastUpdated =
        lastUpdatedCandidates.length > 0
          ? lastUpdatedCandidates.sort().at(-1) ?? null
          : null;

      return {
        ...bearing,
        rulReadings: sortedRulReadings,
        vibrationReadings: sortedVibrationReadings,
        latestRul: latestRulReading?.rul_percentage ?? null,
        lastUpdated,
      };
    })
  );

  return NextResponse.json({
    bearings: bearingsWithHistory,
    fetchedAt: new Date().toISOString(),
  });
}
