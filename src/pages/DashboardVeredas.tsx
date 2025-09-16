import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import * as htmlToImage from "html-to-image";
import { Moon, Sun, Download, Info, FileBarChart2 } from "lucide-react";

const YEAR_MIN = 2025;
const YEAR_MAX = 2035;
const ALL_VALUE = "__ALL__";

const PIE_COLORS = ["#4f46e5", "#22c55e", "#eab308", "#ef4444", "#06b6d4", "#8b5cf6"];

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const classifyDensity = (dp: unknown) => {
  const x = toNum(dp);
  if (x <= 20) return "Muy baja densidad";
  if (x <= 40) return "Baja densidad";
  if (x <= 60) return "Media densidad poblacional";
  return "Alta densidad poblacional";
};

export default function DashboardVeredas() {
  const [rows, setRows] = useState<any[]>([]);
  const [municipio, setMunicipio] = useState<string>(ALL_VALUE);
  const [vereda, setVereda] = useState<string>("");
  const [dpYear, setDpYear] = useState<string>("2025");
  const [dark, setDark] = useState(true);

  const lineRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // cambiar la clase del <html> para respetar preferencias del sistema
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  // Leer Excel
  const handleFile = async (file?: File) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames.includes("R") ? "R" : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
    setRows(json);

    const detectedYears = Object.keys(json?.[0] ?? {})
      .filter((c) => /^\d+$/.test(String(c)))
      .map((c) => Number(c))
      .filter((n) => n >= YEAR_MIN && n <= YEAR_MAX)
      .sort((a, b) => a - b)
      .map(String);

    // Obtener municipios únicos ordenados
    const municipiosSet = new Set(json.map((r) => (r["Municipio"] ?? "").toString().trim()).filter(Boolean));
    const municipiosArr = Array.from(municipiosSet).sort((a, b) => a.localeCompare(b));
    setMunicipio(municipiosArr[0] || "");
    setVereda("");
    setDpYear(detectedYears[0] || "2025");
  };

  // Filtros
  const filteredRows = useMemo(() => {
    if (municipio && municipio !== ALL_VALUE) {
      return rows.filter((r) => (r["Municipio"] ?? "").toString().trim() === municipio);
    }
    return rows;
  }, [rows, municipio]);

  const municipios = useMemo(() => {
    const set = new Set(rows.map((r) => (r["Municipio"] ?? "").toString().trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const veredas = useMemo(() => {
    const set = new Set(
      filteredRows.map((r) => (r["Nombre Vereda"] ?? "").toString().trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredRows]);

  const years = useMemo(() => {
    const cols = Object.keys(rows[0] ?? {});
    const nums = cols
      .map((c) => (Number.isFinite(+c) ? +c : null))
      .filter((n): n is number => n !== null && n !== undefined && n >= YEAR_MIN && n <= YEAR_MAX);
    const uniq = Array.from(new Set(nums));
    return uniq.sort((a, b) => a - b).map(String);
  }, [rows]);

  useEffect(() => {
    if (!years.length) return;
    if (!years.includes(dpYear)) setDpYear(years[0]);
  }, [years, dpYear]);

  // Agrupación por vereda (resuelve “solo toma la primera”)
  const groupRows = useMemo(() => {
    if (!vereda) return [] as any[];
    return filteredRows.filter((r) => (r["Nombre Vereda"] ?? "").toString().trim() === vereda);
  }, [filteredRows, vereda]);

  const aggregatedRow = useMemo(() => {
    if (!groupRows.length) return null as any;

    const totalArea = groupRows.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
    const result: any = {
      Municipio: municipio === ALL_VALUE ? "(Varios)" : municipio,
      "Nombre Vereda": vereda,
      "Área vereda en km2": totalArea,
      R: 0,
      "Calificación densidad": "",
    };

    const rVals = groupRows.map((r) => toNum(r["R"])).filter((n) => Number.isFinite(n));
    result.R = rVals.length ? rVals.reduce((a: number, b: number) => a + b, 0) / rVals.length : 0;

    const popByYear: Record<string, number> = {};
    years.forEach((y) => {
      const sum = groupRows.reduce((acc, r) => acc + toNum(r[y]), 0);
      popByYear[y] = sum;
      result[y] = sum; // población absoluta
    });

    years.forEach((y) => {
      const dp = totalArea > 0 ? popByYear[y] / totalArea : 0;
      result[`DP_${y}`] = dp; // densidad
    });

    const currentDp = result[`DP_${dpYear}`];
    result["Calificación densidad"] = classifyDensity(currentDp);

    return result;
  }, [groupRows, years, dpYear, municipio, vereda]);

  // Datos para gráficas
  const lineData = useMemo(() => {
    if (!aggregatedRow || years.length === 0) return [] as { year: string; value: number }[];
    return years.map((y) => ({ year: y, value: Math.round(Number(aggregatedRow[y]) || 0) }));
  }, [aggregatedRow, years]);

  const dpYears = useMemo(() => years.map((y) => `DP_${y}`), [years]);

  const barData = useMemo(() => {
    if (!aggregatedRow || dpYears.length === 0) return [] as { year: string; value: number }[];
    return dpYears.map((k) => ({ year: k.replace("DP_", ""), value: Number(aggregatedRow[k]) || 0 }));
  }, [aggregatedRow, dpYears]);

  const pieData = useMemo(() => {
    if (!rows.length) return [] as { name: string; value: number }[];
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const key = (r["Calificación densidad"] ?? "Sin dato").toString().trim() || "Sin dato";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  // Descargar contenedor como JPG (alta calidad)
  const sanitizeFilename = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, "_");
  const dataUrlToBlob = (dataUrl: string) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };
  const downloadAsJPG = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
      if (!ref?.current) return;
      const node = ref.current as HTMLElement;
      try {
        // evita fuentes sin cargar en SVG
        // @ts-ignore
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
  
        const png = await htmlToImage.toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: dark ? "#0b0b0b" : "#ffffff",
          style: { background: dark ? "#0b0b0b" : "#ffffff" },
        });
  
        // Convertir a JPEG para tamaño y compatibilidad
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = png; });
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = dark ? "#0b0b0b" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpegUrl = canvas.toDataURL("image/jpeg", 0.95);
  
        const a = document.createElement("a");
        a.download = `${sanitizeFilename(filename)}.jpg`;
        try {
          const blob = dataUrlToBlob(jpegUrl);
          const url = URL.createObjectURL(blob);
          a.href = url;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch {
          a.href = jpegUrl;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch (e) {
        console.error(e);
        alert("No se pudo generar la imagen. Intenta de nuevo.");
      }
    };

  // Colores de ejes/tooltip según modo
  const axisColor = dark ? "#e5e7eb" : "#111827";
  const gridColor = dark ? "#374151" : "#e5e7eb";
  const legendColor = axisColor;
  const tooltipBg = dark ? "#111827" : "#ffffff";
  const tooltipText = dark ? "#e5e7eb" : "#111827";

  return (
    <div className={`page ${dark ? "" : "light"}`}>
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="hstack">
            <FileBarChart2 size={28} color="#6366f1" />
            <div className="title">Dashboard Veredas – Población y Densidad</div>
          </div>
          <div className="hstack">
            <label htmlFor="file" className="sr-only">Subir Excel</label>
            <input id="file" type="file" accept=".xlsx,.xls" onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
            <button className="icon" title="Modo oscuro" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun size={18}/> : <Moon size={18}/>}
            </button>
          </div>
        </div>        

        {/* Pie */}
        <div className="card" style={{ marginTop: 16, marginBottom: 24, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto', boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
          <div className="card-hd">Distribución de calificación de densidad (general)
            <span style={{ float: "right" }}>
              <button className="btn" disabled={!pieRef.current} onClick={() => downloadAsJPG(pieRef, `calificacion_global`)}>
                <Download size={16}/> Descargar JPG
              </button>
            </span>
          </div>
          <div className="card-bd">
            <div ref={pieRef} className="chart" style={{ background: dark ? 'linear-gradient(135deg,#181e2a 60%,#232b3e 100%)' : 'linear-gradient(135deg,#f3f6fd 60%,#e0e7ff 100%)', boxShadow: '0 2px 16px 0 rgba(80,100,200,0.10)' }}>
              {pieData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      label={(props: any) => {
                        const { cx, cy, midAngle, outerRadius, name, value } = props;
                        if (
                          typeof cx === 'number' &&
                          typeof cy === 'number' &&
                          typeof midAngle === 'number' &&
                          typeof outerRadius === 'number' &&
                          typeof name === 'string' &&
                          typeof value === 'number'
                        ) {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 18;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text x={x} y={y} fill="#6366f1" fontSize={13} fontWeight={700} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                              {name}: {value.toLocaleString()}
                            </text>
                          );
                        }
                        return null;
                      }}
                      outerRadius={110}
                      isAnimationActive={true}
                      animationDuration={900}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{background: tooltipBg, border:`1px solid ${gridColor}`, borderRadius:8, fontWeight:600}} labelStyle={{color: tooltipText}} itemStyle={{color: tooltipText}} formatter={(v: number) => Number(v).toLocaleString()}/>
                    <Legend wrapperStyle={{ color: legendColor, fontWeight: 700, fontSize: 15 }} iconType="circle"/>
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{opacity:.6, textAlign:"center", paddingTop:80}}>Sube un Excel para ver la distribución</div>}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ marginTop: 16, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
          <div className="card-hd">Filtros</div>
          <div className="card-bd">
            <div className="grid-3">
              <div>
                <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Municipio</div>
                <select value={municipio} onChange={(e) => { setMunicipio(e.target.value); setVereda(""); }} disabled={!rows.length}>
                  {municipios.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Vereda</div>
                <select value={vereda} onChange={(e) => setVereda(e.target.value)} disabled={!rows.length || !municipio}>
                  <option value="" disabled>{veredas.length ? "Selecciona vereda" : "Sube un Excel"}</option>
                  {veredas.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Año</div>
                <select value={dpYear} onChange={(e) => setDpYear(e.target.value)} disabled={!rows.length}>
                  {years.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
            </div>
          </div>
        </div>

  {/* Información relevante */}
  <div className="card" style={{ marginTop: 16, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
          <div className="card-hd"><Info size={16} style={{marginRight:8}}/> Información relevante</div>
          <div className="card-bd">
            {!rows.length ? (
              <div style={{ opacity:.7 }}>Sube un archivo Excel para comenzar.</div>
            ) : !aggregatedRow ? (
              <div style={{ opacity:.7 }}>Selecciona una vereda para ver detalles.</div>
            ) : (
              <div className="kpis kpis-2x3">
                <div className="kpi"><label>Municipio</label><div className="val">{aggregatedRow["Municipio"] ?? ""}</div></div>
                <div className="kpi"><label>Área vereda (km²)</label><div className="val">{Number(aggregatedRow["Área vereda en km2"]).toLocaleString()}</div></div>
                <div className="kpi"><label>Tasa de Crecimiento Poblacional (R)</label><div className="val">{(Number(aggregatedRow["R"]) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</div></div>
                <div className="kpi"><label>Población {dpYear}</label><div className="val">{Math.round(Number(aggregatedRow[dpYear])||0).toLocaleString()}</div></div>
                <div className="kpi"><label>Densidad Poblacional {dpYear}</label><div className="val">{Math.round(Number(aggregatedRow[`DP_${dpYear}`]) || 0).toLocaleString()} hab/km²</div></div>
                <div className="kpi"><label>Calificación densidad</label><div className="val">{(aggregatedRow["Calificación densidad"] ?? "").toString()}</div></div>
              </div>
            )}
          </div>
        </div>

        {/* Línea */}
        <div className="card" style={{ marginTop: 16, boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)', opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
          <div className="card-hd">
            Población proyectada por años
            {municipio && municipio !== ALL_VALUE && vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#6366f1' }}>
                ({municipio} – {vereda})
              </span>
            ) : null}
            <span style={{ float: "right" }}>
              <button className="btn" disabled={!lineRef.current} onClick={() => downloadAsJPG(lineRef, `poblacion_${vereda || "vereda"}`)}>
                <Download size={16}/> Descargar JPG
              </button>
            </span>
          </div>
          <div className="card-bd">
            <div ref={lineRef} className="chart" style={{ position: 'relative', background: dark ? 'linear-gradient(135deg,#181e2a 60%,#232b3e 100%)' : 'linear-gradient(135deg,#f3f6fd 60%,#e0e7ff 100%)', boxShadow: '0 2px 16px 0 rgba(80,100,200,0.10)' }}>
              {municipio && municipio !== ALL_VALUE && vereda ? (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#6366f1',
                  zIndex: 2,
                  pointerEvents: 'none',
                  textShadow: dark ? '0 2px 8px #181e2a' : '0 2px 8px #e0e7ff'
                }}>
                  {municipio} – {vereda}
                </div>
              ) : null}
              {lineData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 40, right: 24, left: 40, bottom: 32 }}>
                    <defs>
                      <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 13, fontWeight: 600 }}
                      label={{
                        value: 'Año',
                        position: 'insideBottom',
                        offset: -4,
                        fill: axisColor,
                        fontSize: 14,
                        fontWeight: 700
                      }}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 13, fontWeight: 600 }}
                      tickFormatter={(v: number) => Math.round(v).toLocaleString()}
                      label={{
                        value: 'Población',
                        angle: -90,
                        position: 'insideLeft',
                        fill: axisColor,
                        fontSize: 14,
                        fontWeight: 700,
                        dx: -8
                      }}
                    />
                    <Tooltip contentStyle={{background: tooltipBg, border:`1px solid ${gridColor}`, borderRadius:8, fontWeight:600}} labelStyle={{color: tooltipText}} itemStyle={{color: tooltipText}} formatter={(v: number) => Math.round(v).toLocaleString()}/>
                    {/* <Legend wrapperStyle={{ color: legendColor, fontWeight: 700, fontSize: 15 }} iconType="circle"/> */}
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Población"
                      stroke="url(#colorPop)"
                      strokeWidth={3}
                      dot={{ r: 6, fill: '#fff', stroke: '#6366f1', strokeWidth: 3, filter: 'drop-shadow(0 2px 6px #6366f155)' }}
                      activeDot={{ r: 8, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={true}
                      animationDuration={900}
                      label={({ x, y, value }) => {
                        if (
                          typeof x === 'number' &&
                          typeof y === 'number' &&
                          typeof value === 'number' &&
                          !isNaN(value) &&
                          value > 0
                        ) {
                          return (
                            <text x={x} y={y - 12} fill="#6366f1" fontSize={13} fontWeight={700} textAnchor="middle">
                              {value.toLocaleString()}
                            </text>
                          );
                        }
                        return null;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div style={{opacity:.6, textAlign:"center", paddingTop:80}}>Sin datos (selecciona vereda)</div>}
            </div>
          </div>
        </div>

        {/* Barras */}
        <div className="card" style={{ marginTop: 16, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto', boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
          <div className="card-hd">
            Densidad poblacional por año (hab/km²)
            {municipio && municipio !== ALL_VALUE && vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#34d399' }}>
                ({municipio} – {vereda})
              </span>
            ) : null}
            <span style={{ float: "right" }}>
              <button className="btn" disabled={!barRef.current} onClick={() => downloadAsJPG(barRef, `densidad_${vereda || "vereda"}`)}>
                <Download size={16}/> Descargar JPG
              </button>
            </span>
          </div>
          <div className="card-bd">
            <div ref={barRef} className="chart" style={{ position: 'relative', background: dark ? 'linear-gradient(135deg,#181e2a 60%,#232b3e 100%)' : 'linear-gradient(135deg,#f3f6fd 60%,#e0e7ff 100%)', boxShadow: '0 2px 16px 0 rgba(80,100,200,0.10)' }}>
              {municipio && municipio !== ALL_VALUE && vereda ? (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 0,
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#34d399',
                  zIndex: 2,
                  pointerEvents: 'none',
                  textShadow: dark ? '0 2px 8px #181e2a' : '0 2px 8px #e0e7ff'
                }}>
                  {municipio} – {vereda}
                </div>
              ) : null}
              {barData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 40, right: 24, left: 40, bottom: 32 }}>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3"/>
                    <XAxis
                      dataKey="year"
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 13, fontWeight: 600 }}
                      label={{
                        value: 'Año',
                        position: 'insideBottom',
                        offset: -4,
                        fill: axisColor,
                        fontSize: 14,
                        fontWeight: 700
                      }}
                    />
                    <YAxis
                      stroke={axisColor}
                      tick={{ fill: axisColor, fontSize: 13, fontWeight: 600 }}
                      label={{
                        value: 'Densidad (hab/km²)',
                        angle: -90,
                        position: 'insideLeft',
                        fill: axisColor,
                        fontSize: 14,
                        fontWeight: 700,
                        dx: -8
                      }}
                    />
                    <Tooltip contentStyle={{background: tooltipBg, border:`1px solid ${gridColor}`, borderRadius:8, fontWeight:600}} labelStyle={{color: tooltipText}} itemStyle={{color: tooltipText}} formatter={(v: number) => `${Math.round(Number(v)).toLocaleString()} hab/km²`}/>
                    {/* <Legend wrapperStyle={{ color: legendColor, fontWeight: 700, fontSize: 15 }} iconType="rect" /> */}
                    <Bar dataKey="value" name="Densidad" fill="url(#colorBar)" radius={[8,8,0,0]} isAnimationActive={true} animationDuration={900} label={({ x, y, width, value }) => {
                      if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof value === 'number' && !isNaN(value) && value > 0) {
                        return (
                          <text x={x + width / 2} y={y - 8} fill="#06b6d4" fontSize={13} fontWeight={700} textAnchor="middle">
                            {Math.round(value).toLocaleString()}
                          </text>
                        );
                      }
                      return null;
                    }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{opacity:.6, textAlign:"center", paddingTop:80}}>Sin datos (selecciona vereda)</div>}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: .7, marginTop: 8 }}>
          <strong>Notas:</strong> Los años válidos se detectan entre {YEAR_MIN} y {YEAR_MAX}. La población se muestra como <em>número entero</em>. La densidad se calcula como SUM(población)/SUM(área) para la vereda seleccionada.
        </div>

        {/* Explicación de fórmulas */}
        <div className="card" style={{ marginTop: 24, marginBottom: 24 }}>
          <div className="card-hd">📖 Explicación de las fórmulas</div>
          <div className="card-bd" style={{ fontSize: 15, lineHeight: 1.7 }}>
            <ol style={{ paddingLeft: 18 }}>
              <li style={{ marginBottom: 12 }}>
                <strong>Tasa de Crecimiento Poblacional (R)</strong><br/>
                La fórmula estándar es:<br/>
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  R = (P<sub>f</sub> / P<sub>i</sub>)<sup>1/n</sup> - 1
                </span>
                Donde:<br/>
                <ul style={{ margin: '6px 0 6px 18px' }}>
                  <li>P<sub>f</sub> = población final (2025)</li>
                  <li>P<sub>i</sub> = población inicial (2018)</li>
                  <li>n = número o intervalo de años</li>
                </ul>
                <span style={{ color: '#eab308', fontWeight: 500 }}>Esto nos da la <u>tasa anual compuesta de crecimiento poblacional</u>.</span><br/>
                Con este <b>R</b> podemos proyectar hacia adelante:<br/>
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  P<sub>t</sub> = P<sub>2025</sub> · (1 + R)<sup>t-2025</sup>
                </span>
                para t = 2026, 2027, ..., 2036.
              </li>
              <li>
                <strong>Densidad Poblacional (DP)</strong><br/>
                La fórmula es:<br/>
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  DP<sub>t</sub> = P<sub>t</sub> / Área
                </span>
                Donde:<br/>
                <ul style={{ margin: '6px 0 6px 18px' }}>
                  <li>P<sub>t</sub> = población proyectada del año t</li>
                  <li>Área = área fija de la vereda/municipio (en km²)</li>
                </ul>
                <span style={{ color: '#eab308', fontWeight: 500 }}>Esto permite ver cómo la <u>distribución poblacional</u> cambia en el tiempo, veredas de muy baja densidad podrían pasar a baja o media densidad según los umbrales.</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Fuentes y referencias */}
        <div className="card" style={{ marginTop: 0, marginBottom: 32 }}>
          <div className="card-hd">🔗 Fuentes y referencias</div>
          <div className="card-bd" style={{ fontSize: 14, lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                <a href="https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion" target="_blank" rel="noopener noreferrer">
                  DANE – Proyecciones de población (Colombia)
                </a>
              </li>
              <li>
                <a href="https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_I_Demografico/2.2.3.-densidad-de-la-poblaci%C3%B3n-en-colombia.html" target="_blank" rel="noopener noreferrer">
                  DANE – Densidad de población (Colombia)
                </a>
              </li>
              <li>
                <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer">
                  United Nations – World Population Prospects (WPP)
                </a>
              </li>
              <li>
                <a href="https://unstats.un.org/unsd/demographic-social/products/dyb/index.cshtml" target="_blank" rel="noopener noreferrer">
                  United Nations – Demographic Yearbook
                </a>
              </li>
            </ul>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 8 }}>
              Para mayor rigor, consulta la documentación oficial del DANE y organismos internacionales de estadística poblacional.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
