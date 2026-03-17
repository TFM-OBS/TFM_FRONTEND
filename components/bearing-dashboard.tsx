"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { BearingCard } from "./bearing-card";
import { RefreshCw, Activity, AlertTriangle, Clock } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const DEFAULT_BATCH_STEP = 100;
const DEMO_BATCH_STEP = Math.max(
  1,
  Number(process.env.NEXT_PUBLIC_DEMO_BATCH_STEP ?? DEFAULT_BATCH_STEP)
);
const DEMO_BATCH_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.NEXT_PUBLIC_DEMO_BATCH_INTERVAL_MS ?? 5000)
);
const DEMO_START_BATCH = Math.max(
  1,
  Number(process.env.NEXT_PUBLIC_DEMO_START_BATCH ?? 1)
);
const RUL_BASE_MULTIPLIER = Number(process.env.NEXT_PUBLIC_RUL_MULTIPLIER ?? 1);
const RUL_MULTIPLIER_DECAY_PER_BATCH = Number(
  process.env.NEXT_PUBLIC_RUL_MULTIPLIER_DECAY_PER_BATCH ?? 0
);

interface Reading {
  id: string;
  bearing_id: string;
  batch_number: number;
  vibration_horizontal: number;
  created_at: string;
}

interface RulReading {
  id: string;
  bearing_id: string;
  batch_number: number;
  rul_percentage: number;
  created_at: string;
}

interface Bearing {
  id: string;
  name: string;
  location: string;
  status: string;
  vibrationReadings: Reading[];
  rulReadings: RulReading[];
  lastUpdated: string | null;
  latestRul: number | null;
}

interface BearingsResponse {
  bearings: Bearing[];
  fetchedAt: string;
}

type BearingFilterState = "all" | "normal" | "warning" | "critical";

export function BearingDashboard() {
  const [visibleBatches, setVisibleBatches] = useState(DEMO_START_BATCH);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [stateFilter, setStateFilter] = useState<BearingFilterState>("all");
  const hasInitializedStartBatch = useRef(false);
  const getMultiplierForBatchIndex = (batchIndex: number) =>
    Math.max(0, RUL_BASE_MULTIPLIER - batchIndex * RUL_MULTIPLIER_DECAY_PER_BATCH);

  const applyRulMultiplier = (value: number | null, multiplier: number) => {
    if (value === null || !Number.isFinite(multiplier)) return value;
    return Math.min(100, Math.max(0, value * multiplier));
  };

  const { data, error, isLoading, isValidating } = useSWR<BearingsResponse>(
    "/api/bearings",
    fetcher,
    {
      refreshInterval: DEMO_BATCH_INTERVAL_MS,
      revalidateOnFocus: true,
      onSuccess: (nextData) => {
        const maxAvailableBatches = Math.max(
          ...nextData.bearings.map((bearing) =>
            Math.max(bearing.vibrationReadings.length, bearing.rulReadings.length)
          ),
          0
        );

        if (maxAvailableBatches <= 0) {
          setVisibleBatches(0);
          return;
        }

        if (!hasInitializedStartBatch.current) {
          setVisibleBatches(Math.min(DEMO_START_BATCH, maxAvailableBatches));
          hasInitializedStartBatch.current = true;
          return;
        }

        setVisibleBatches((previous) => {
          const next = previous + DEMO_BATCH_STEP;
          return Math.min(next, maxAvailableBatches);
        });
      },
    }
  );

  const visibleBearings = useMemo(() => {
    if (!data?.bearings) return [];

    return data.bearings.map((bearing) => {
      const vibrationAvailable = bearing.vibrationReadings.length;
      const rulAvailable = bearing.rulReadings.length;
      const targetBatchCount = showFullHistory
        ? Math.max(vibrationAvailable, rulAvailable)
        : visibleBatches;
      const vibrationReadings = bearing.vibrationReadings.slice(0, targetBatchCount);
      const rulReadings = bearing.rulReadings.slice(0, targetBatchCount);

      const latestVisibleRulReading =
        rulReadings.length > 0 ? rulReadings[rulReadings.length - 1] : null;
      const latestVisibleVibrationReading =
        vibrationReadings.length > 0
          ? vibrationReadings[vibrationReadings.length - 1]
          : null;

      const lastUpdatedCandidates = [
        latestVisibleRulReading?.created_at,
        latestVisibleVibrationReading?.created_at,
      ].filter(Boolean) as string[];

      const latestDataTimestamp =
        lastUpdatedCandidates.length > 0
          ? lastUpdatedCandidates.sort().at(-1) ?? null
          : null;

      // For demo purposes, show the live refresh timestamp per card so it is
      // visibly updated on every auto-refresh tick.
      const lastUpdated = data.fetchedAt ?? latestDataTimestamp;

      return {
        ...bearing,
        rulReadings,
        vibrationReadings,
        latestRul: latestVisibleRulReading?.rul_percentage ?? null,
        lastUpdated,
      };
    });
  }, [data?.bearings, showFullHistory, visibleBatches]);

  const formatLastFetch = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getAdjustedLatestRul = (value: number | null, visibleCount: number) =>
    applyRulMultiplier(value, getMultiplierForBatchIndex(visibleCount));

  const getBearingRulState = (bearing: Pick<Bearing, "latestRul" | "rulReadings">) => {
    const rul = getAdjustedLatestRul(bearing.latestRul, bearing.rulReadings.length);
    if (rul === null) return null;
    if (rul < 20) return "critical";
    if (rul < 50) return "warning";
    return "normal";
  };

  const stats = useMemo(() => {
    return visibleBearings.reduce(
      (acc, bearing) => {
        const state = getBearingRulState(bearing);
        if (state === "critical") acc.critical += 1;
        if (state === "warning") acc.warning += 1;
        if (state === "normal") acc.normal += 1;
        return acc;
      },
      {
        total: visibleBearings.length,
        critical: 0,
        warning: 0,
        normal: 0,
      }
    );
  }, [visibleBearings]);

  const filteredBearings = useMemo(() => {
    if (stateFilter === "all") return visibleBearings;
    return visibleBearings.filter((bearing) => getBearingRulState(bearing) === stateFilter);
  }, [visibleBearings, stateFilter]);

  const toggleStateFilter = (nextFilter: BearingFilterState) => {
    setStateFilter((previous) => {
      if (nextFilter === "all") return "all";
      return previous === nextFilter ? "all" : nextFilter;
    });
  };

  const filterLabel =
    stateFilter === "all"
      ? "Todos"
      : stateFilter === "normal"
      ? "Normal"
      : stateFilter === "warning"
      ? "Advertencia"
      : "Critico";

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold">Error al cargar datos</h3>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Monitoreo de Rodamientos
          </h1>
          <p className="text-muted-foreground">
            Vida util restante (RUL) y vibracion por lote en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showFullHistory ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFullHistory((previous) => !previous)}
          >
            {showFullHistory ? "Volver a Demo" : "Ver Todo"}
          </Button>
          <Badge
            variant="outline"
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`}
            />
            <span className="text-xs">
              {isValidating
                ? "Actualizando..."
                : `Auto-refresh: ${Math.round(DEMO_BATCH_INTERVAL_MS / 1000)}s`}
            </span>
          </Badge>
          {data?.fetchedAt && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatLastFetch(data.fetchedAt)}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className={`cursor-pointer transition-colors ${
            stateFilter === "all" ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
          }`}
          onClick={() => toggleStateFilter("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Rodamientos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${
            stateFilter === "normal"
              ? "border-emerald-500/60 bg-emerald-500/5"
              : "hover:bg-muted/40"
          }`}
          onClick={() => toggleStateFilter("normal")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estado Normal</CardTitle>
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.normal}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${
            stateFilter === "warning"
              ? "border-amber-500/60 bg-amber-500/5"
              : "hover:bg-muted/40"
          }`}
          onClick={() => toggleStateFilter("warning")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Advertencia</CardTitle>
            <div className="h-3 w-3 rounded-full bg-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.warning}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${
            stateFilter === "critical"
              ? "border-red-500/60 bg-red-500/5"
              : "hover:bg-muted/40"
          }`}
          onClick={() => toggleStateFilter("critical")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critico</CardTitle>
            <div className="h-3 w-3 rounded-full bg-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 grid-cols-1">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row">
                  <div className="flex flex-col items-center gap-4 border-b p-5 lg:w-[240px] lg:border-b-0 lg:border-r">
                    <div className="flex w-full flex-col gap-2">
                      <div className="h-5 w-32 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                    <div className="h-[110px] w-[110px] rounded-full bg-muted" />
                    <div className="h-3 w-36 rounded bg-muted" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <div className="mb-2 h-3 w-40 rounded bg-muted" />
                    <div className="h-[200px] w-full rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bearing Cards */}
      {visibleBearings.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Detalle por Rodamiento</h2>
            <Badge variant="secondary" className="text-xs">
              Filtro: {filterLabel} ({filteredBearings.length})
            </Badge>
          </div>
          <div className="grid gap-4 grid-cols-1">
            {filteredBearings.map((bearing) => (
              <BearingCard
                key={bearing.id}
                name={bearing.name}
                location={bearing.location}
                lastUpdated={bearing.lastUpdated}
                status={bearing.status}
                rulReadings={bearing.rulReadings}
                vibrationReadings={bearing.vibrationReadings}
                latestRul={bearing.latestRul}
                showFullHistory={showFullHistory}
                rulBaseMultiplier={RUL_BASE_MULTIPLIER}
                rulDecayPerBatch={RUL_MULTIPLIER_DECAY_PER_BATCH}
              />
            ))}
            {filteredBearings.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No hay rodamientos en estado {filterLabel.toLowerCase()} para los lotes visibles.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
