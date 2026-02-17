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
}

export function BearingCard({
  name,
  location,
  lastUpdated,
  status,
  latestRul,
  rulReadings,
  vibrationReadings,
}: BearingCardProps) {
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

  const statusConfig = getStatusConfig(status, latestRul);
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

  const rulChartData = rulReadings
    .sort((a, b) => a.batch_number - b.batch_number)
    .map((reading) => ({
      batch: Number(reading.batch_number),
      rul: reading.rul_percentage,
    }));

  const vibrationChartData = vibrationReadings
    .sort((a, b) => a.batch_number - b.batch_number)
    .map((reading) => ({
      batch: Number(reading.batch_number),
      horizontal: Number(reading.vibration_horizontal),
      vertical: Number(reading.vibration_vertical),
    }))
    .filter(
      (reading) =>
        Number.isFinite(reading.horizontal) || Number.isFinite(reading.vertical)
    );

  const getRulColor = () => {
    if (latestRul !== null && latestRul < 20) return "#ef4444";
    if (latestRul !== null && latestRul < 50) return "#f59e0b";
    return "#10b981";
  };

  const pieData = [
    { name: "RUL", value: latestRul ?? 0 },
    { name: "Used", value: 100 - (latestRul ?? 0) },
  ];

  const brushStartIndexRul = 0;
  const brushStartIndexVibration = 0;
  const gradientId = `rul-gradient-${name.replace(/\s+/g, "-").toLowerCase()}`;
  const latestVibrationReading =
    vibrationChartData[vibrationChartData.length - 1];

  const vibrationValues = vibrationChartData
    .flatMap((point) => [point.horizontal, point.vertical])
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
                  {formatRul(latestRul)}
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vib. Vertical</span>
                <span className="font-semibold tabular-nums">
                  {formatVibration(latestVibrationReading?.vertical)}
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
                  ({vibrationChartData.length} lotes)
                </span>
              )}
            </p>
            {vibrationChartData.length > 0 ? (
              <div className="flex-1">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={vibrationChartData}
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
                        labelFormatter={(label) => `Lote #${label}`}
                        formatter={(value: number | null | undefined, name) => [
                          formatVibration(value),
                          name === "horizontal" ? "Vib. Horizontal" : "Vib. Vertical",
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
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="vertical"
                        connectNulls
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                        isAnimationActive={false}
                      />
                      {vibrationChartData.length > 200 && (
                        <Brush
                          dataKey="batch"
                          height={22}
                          stroke="hsl(var(--border))"
                          fill="hsl(var(--muted))"
                          startIndex={brushStartIndexVibration}
                          endIndex={vibrationChartData.length - 1}
                          tickFormatter={(value) => `#${value}`}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {vibrationChartData.length > 200 && (
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
                  ({rulChartData.length} lotes)
                </span>
              )}
            </p>
            {rulChartData.length > 0 ? (
              <div className="flex-1">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={rulChartData}
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
                        labelFormatter={(label) => `Lote #${label}`}
                        formatter={(value: number) => [`${Number(value).toFixed(1)}%`, "RUL"]}
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
                      />
                      {rulChartData.length > 200 && (
                        <Brush
                          dataKey="batch"
                          height={22}
                          stroke="hsl(var(--border))"
                          fill="hsl(var(--muted))"
                          startIndex={brushStartIndexRul}
                          endIndex={rulChartData.length - 1}
                          tickFormatter={(value) => `#${value}`}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {rulChartData.length > 200 && (
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
