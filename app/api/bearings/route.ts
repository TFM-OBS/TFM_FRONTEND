import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PAGE_SIZE = 1000;

async function fetchAllReadingsByBearing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "rul_readings" | "vibration_readings",
  bearingId: string
) {
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("bearing_id", bearingId)
      .order("batch_number", { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error };
    }

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

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
      const {
        data: rulReadingsRaw,
        error: rulReadingsError,
      } = await fetchAllReadingsByBearing(supabase, "rul_readings", bearing.id);

      const {
        data: vibrationReadingsRaw,
        error: vibrationReadingsError,
      } = await fetchAllReadingsByBearing(supabase, "vibration_readings", bearing.id);

      if (rulReadingsError || vibrationReadingsError) {
        return {
          ...bearing,
          rulReadings: [],
          vibrationReadings: [],
          latestRul: null,
          lastUpdated: null,
        };
      }

      const rulReadings = (rulReadingsRaw ?? []) as {
        id: string;
        bearing_id: string;
        batch_number: number;
        rul_percentage: number;
        created_at: string;
      }[];
      const vibrationReadings = (vibrationReadingsRaw ?? []) as {
        id: string;
        bearing_id: string;
        batch_number: number;
        vibration_horizontal: number;
        vibration_vertical: number;
        created_at: string;
      }[];

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
