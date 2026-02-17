"use client";

import useSWR from "swr";
import { BearingCard } from "./bearing-card";
import { RefreshCw, Activity, AlertTriangle, Clock } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Reading {
  id: string;
  bearing_id: string;
  batch_number: number;
  vibracion_horizontal: number;
  vibracion_vertical: number;
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

export function BearingDashboard() {
  const { data, error, isLoading, isValidating } = useSWR<BearingsResponse>(
    "/api/bearings",
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true,
    }
  );

  const formatLastFetch = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const stats = {
    total: data?.bearings.length ?? 0,
    critical: data?.bearings.filter((b) => b.latestRul !== null && b.latestRul < 20).length ?? 0,
    warning: data?.bearings.filter((b) => b.latestRul !== null && b.latestRul >= 20 && b.latestRul < 50).length ?? 0,
    normal: data?.bearings.filter((b) => b.latestRul !== null && b.latestRul >= 50).length ?? 0,
  };

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
          <Badge
            variant="outline"
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`}
            />
            <span className="text-xs">
              {isValidating ? "Actualizando..." : "Auto-refresh: 10s"}
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Rodamientos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Estado Normal</CardTitle>
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.normal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Advertencia</CardTitle>
            <div className="h-3 w-3 rounded-full bg-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.warning}</div>
          </CardContent>
        </Card>
        <Card>
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
      {data?.bearings && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Detalle por Rodamiento</h2>
          <div className="grid gap-4 grid-cols-1">
            {[...data.bearings]
              .sort((a, b) => (a.latestRul ?? Infinity) - (b.latestRul ?? Infinity))
              .map((bearing) => (
              <BearingCard
                key={bearing.id}
                name={bearing.name}
                location={bearing.location}
                lastUpdated={bearing.lastUpdated}
                status={bearing.status}
                rulReadings={bearing.rulReadings}
                vibrationReadings={bearing.vibrationReadings}
                latestRul={bearing.latestRul}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
