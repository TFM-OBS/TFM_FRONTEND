"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, AlertTriangle, CheckCircle, MapPin } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  Brush,
} from "recharts";

const DEFAULT_CHART_WINDOW_SIZE = 200;
const CHART_WINDOW_SIZE = Math.max(
  10,
  Number(process.env.NEXT_PUBLIC_CHART_WINDOW_SIZE ?? DEFAULT_CHART_WINDOW_SIZE)
);

interface VibrationReading {
  id: string;
  bearing_id: string;
  batch_number: number;
  vibration_horizontal: number;
  vibration_vertical: number;
  created_at: string;
}

interface RulReading {
  id: string;
  bearing_id: string;
  batch_number: number;
  rul_percentage: number;
  created_at: string;
}

interface BearingCardProps {
  name: string;
  location: string;
  lastUpdated: string | null;
  status: string;
  latestRul: number | null;
  rulReadings: RulReading[];
  vibrationReadings: VibrationReading[];
  showFullHistory?: boolean;
  rulBaseMultiplier?: number;
  rulDecayPerBatch?: number;
}

export function BearingCard({
  name,
  location,
  lastUpdated,
  status,
  latestRul,
  rulReadings,
  vibrationReadings,
  showFullHistory = false,
  rulBaseMultiplier = 1,
  rulDecayPerBatch = 0,
}: BearingCardProps) {
  const getMultiplierForBatchIndex = (batchIndex: number) =>
    Math.max(0, rulBaseMultiplier - batchIndex * rulDecayPerBatch);

  const applyRulMultiplier = (value: number | null, multiplier: number) => {
    if (value === null || !Number.isFinite(multiplier)) return value;
    return Math.min(100, Math.max(0, value * multiplier));
  };

  const adjustedLatestRul = applyRulMultiplier(
    latestRul,
    getMultiplierForBatchIndex(rulReadings.length)
  );

  const getStatusConfig = (currentStatus: string, rul: number | null) => {
    if (rul !== null && rul < 20) {
      return {
        color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        icon: AlertTriangle,
        label: "Critico",
      };
    }
    if (rul !== null && rul < 50) {
      return {
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        icon: AlertTriangle,
        label: "Advertencia",
      };
    }
    if (currentStatus === "active") {
      return {
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        icon: CheckCircle,
        label: "Normal",
      };
    }
    return {
      color: "bg-muted text-muted-foreground",
      icon: Activity,
      label: currentStatus,
    };
  };

  const statusConfig = getStatusConfig(status, adjustedLatestRul);
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Sin datos";
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDateTimeWithSeconds = (dateString: string | null | undefined) => {
    if (!dateString) return "---";
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRul = (rul: number | null) => {
    if (rul === null) return "---";
    return `${rul.toFixed(1)}%`;
  };

  const formatVibration = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "---";
    return value.toFixed(3);
  };

  const rulChartData = [...rulReadings]
    .sort((a, b) => a.batch_number - b.batch_number)
    .map((reading, index) => ({
      batch: index + 1,
      realBatch: Number(reading.batch_number),
      multiplier: getMultiplierForBatchIndex(index + 1),
      rul: applyRulMultiplier(
        reading.rul_percentage,
        getMultiplierForBatchIndex(index + 1)
      ),
      createdAt: reading.created_at,
    }));

  const vibrationChartData = [...vibrationReadings]
    .sort((a, b) => a.batch_number - b.batch_number)
    .map((reading, index) => ({
      batch: index + 1,
      realBatch: Number(reading.batch_number),
      horizontal: Number(reading.vibration_horizontal),
      createdAt: reading.created_at,
    }))
    .filter((reading) => Number.isFinite(reading.horizontal));

  const visibleRulChartData = showFullHistory
    ? rulChartData
    : rulChartData.slice(-CHART_WINDOW_SIZE);
  const visibleVibrationChartData = showFullHistory
    ? vibrationChartData
    : vibrationChartData.slice(-CHART_WINDOW_SIZE);

  const getRulColor = () => {
    if (adjustedLatestRul !== null && adjustedLatestRul < 20) return "#ef4444";
    if (adjustedLatestRul !== null && adjustedLatestRul < 50) return "#f59e0b";
    return "#10b981";
  };

  const pieData = [
    { name: "RUL", value: adjustedLatestRul ?? 0 },
    { name: "Used", value: 100 - (adjustedLatestRul ?? 0) },
  ];

  const brushStartIndexRul = 0;
  const brushStartIndexVibration = 0;
  const gradientId = `rul-gradient-${name.replace(/\s+/g, "-").toLowerCase()}`;
  const latestVibrationReading =
    visibleVibrationChartData[visibleVibrationChartData.length - 1];

  const vibrationValues = visibleVibrationChartData
    .map((point) => point.horizontal)
    .filter((value) => Number.isFinite(value)) as number[];
  const vibrationMin = vibrationValues.length > 0 ? Math.min(...vibrationValues) : null;
  const vibrationMax = vibrationValues.length > 0 ? Math.max(...vibrationValues) : null;
  const vibrationPadding =
    vibrationMin !== null && vibrationMax !== null
      ? Math.max((vibrationMax - vibrationMin) * 0.1, 0.1)
      : null;
  const vibrationDomain =
    vibrationMin !== null && vibrationMax !== null && vibrationPadding !== null
      ? [vibrationMin - vibrationPadding, vibrationMax + vibrationPadding]
      : undefined;


  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left Panel - Info */}
          <div className="flex flex-col items-center gap-4 border-b p-5 lg:w-[240px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
            {/* Header */}
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-tight">{name}</h3>
                <Badge variant="outline" className={`flex-shrink-0 text-[10px] ${statusConfig.color}`}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{location}</span>
              </div>
            </div>

            {/* RUL Gauge */}
            <div className="relative h-[110px] w-[110px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={36}
                    outerRadius={50}
                    paddingAngle={0}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill={getRulColor()} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold tabular-nums leading-none">
                  {formatRul(adjustedLatestRul)}
                </span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">RUL</span>
              </div>
            </div>

            {/* Latest Vibration Values */}
            <div className="flex w-full flex-col gap-2 rounded-md border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ultimo Lote</span>
                <span className="font-semibold tabular-nums">
                  {latestVibrationReading ? `#${latestVibrationReading.batch}` : "---"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vib. Horizontal</span>
                <span className="font-semibold tabular-nums">
                  {formatVibration(latestVibrationReading?.horizontal)}
                </span>
              </div>
            </div>

            {/* Last Updated */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>{formatDate(lastUpdated)}</span>
            </div>
          </div>

          {/* Right Panel - Trend Charts */}
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Vibracion por Lote
              {vibrationChartData.length > 0 && (
                <span className="ml-2 font-normal">
                  ({visibleVibrationChartData.length} de {vibrationChartData.length} lotes)
                </span>
              )}
            </p>
            {visibleVibrationChartData.length > 0 ? (
              <div className="flex-1">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={visibleVibrationChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="batch"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `#${value}`}
                      />
                      <YAxis
                        domain={vibrationDomain}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => Number(value).toFixed(2)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.82)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#ffffff",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        itemStyle={{ color: "#ffffff" }}
                        labelStyle={{ color: "#ffffff" }}
                        labelFormatter={(label, payload) => {
                          const firstItem = payload?.[0]?.payload as
                            | { createdAt?: string; realBatch?: number }
                            | undefined;
                          return `Lote #${label} (real #${firstItem?.realBatch ?? "---"}) - ${formatDateTimeWithSeconds(firstItem?.createdAt)}`;
                        }}
                        formatter={(value: number | null | undefined, name) => [
                          formatVibration(value),
                          "Vib. Horizontal",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="horizontal"
                        connectNulls
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                        isAnimationActive
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                      {visibleVibrationChartData.length > 200 && (
                        <Brush
                          dataKey="batch"
                          height={22}
                          stroke="hsl(var(--border))"
                          fill="hsl(var(--muted))"
                          startIndex={brushStartIndexVibration}
                          endIndex={visibleVibrationChartData.length - 1}
                          tickFormatter={(value) => `#${value}`}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {visibleVibrationChartData.length > 200 && (
                  <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    Arrastra el selector para navegar por los lotes
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Sin datos de vibracion disponibles
              </div>
            )}

            <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
              Tendencia RUL por Lote
              {rulChartData.length > 0 && (
                <span className="ml-2 font-normal">
                  ({visibleRulChartData.length} de {rulChartData.length} lotes)
                </span>
              )}
            </p>
            {visibleRulChartData.length > 0 ? (
              <div className="flex-1">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={visibleRulChartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={getRulColor()} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={getRulColor()} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="batch"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `#${value}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                        ticks={[0, 20, 50, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.82)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#ffffff",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        itemStyle={{ color: "#ffffff" }}
                        labelStyle={{ color: "#ffffff" }}
                        labelFormatter={(label, payload) => {
                          const firstItem = payload?.[0]?.payload as
                            | { createdAt?: string; realBatch?: number }
                            | undefined;
                          return `Lote #${label} (real #${firstItem?.realBatch ?? "---"}) - ${formatDateTimeWithSeconds(firstItem?.createdAt)}`;
                        }}
                        formatter={(value: number, _name, item) => {
                          const payload = item?.payload as
                            | { multiplier?: number }
                            | undefined;
                          const multiplier = payload?.multiplier;
                          const seriesName =
                            typeof multiplier === "number"
                              ? `RUL (x${multiplier.toFixed(4)})`
                              : "RUL";
                          return [`${Number(value).toFixed(1)}%`, seriesName];
                        }}
                      />
                      <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Area
                        type="monotone"
                        dataKey="rul"
                        connectNulls
                        stroke={getRulColor()}
                        strokeWidth={1.5}
                        fill={`url(#${gradientId})`}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                        isAnimationActive
                        animationDuration={700}
                        animationEasing="ease-out"
                      />
                      {visibleRulChartData.length > 200 && (
                        <Brush
                          dataKey="batch"
                          height={22}
                          stroke="hsl(var(--border))"
                          fill="hsl(var(--muted))"
                          startIndex={brushStartIndexRul}
                          endIndex={visibleRulChartData.length - 1}
                          tickFormatter={(value) => `#${value}`}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {visibleRulChartData.length > 200 && (
                  <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    Arrastra el selector para navegar por los lotes
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Sin datos de RUL disponibles
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
