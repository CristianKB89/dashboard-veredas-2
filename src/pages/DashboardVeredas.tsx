import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, Label
} from "recharts";
import * as htmlToImage from "html-to-image";
import { Moon, Sun, Info, FileBarChart2 } from "lucide-react";
import { exportSectionsToWord } from "../exportToWord";
import { exportSectionsToPDF } from "../exportToPDF";

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
  const infoRef = useRef<HTMLDivElement | null>(null);
  const poblacionRef = useRef<HTMLDivElement | null>(null);
  const densidadRef = useRef<HTMLDivElement | null>(null);
  const poblacionAnalisisRef = useRef<HTMLDivElement | null>(null);
  const densidadAnalisisRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [municipio, setMunicipio] = useState<string>(ALL_VALUE);
  const [vereda, setVereda] = useState<string>("");
  const [dpYear, setDpYear] = useState<string>("2025");
  const [dark, setDark] = useState(true);
  const [exportFormat, setExportFormat] = useState<'word' | 'pdf'>('word');
  const [tasaRTable, setTasaRTable] = useState<any[] | null>(null);

  const lineRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);
  const poblacionMunicipioRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // cambiar la clase del <html> para respetar preferencias del sistema
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  // Leer Excel
  const handleFile = async (file?: File) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    // Datos principales
    const sheetName = wb.SheetNames.includes("R") ? "R" : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
    setRows(json);

    // TASA_R
    if (wb.SheetNames.includes("TASA_R")) {
      const wsTasa = wb.Sheets["TASA_R"];
      const tasaData: any[] = XLSX.utils.sheet_to_json(wsTasa, { defval: null });
      setTasaRTable(tasaData);
    } else {
      setTasaRTable(null);
    }

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


  // Datos para gráficas (por vereda o municipio)
  const rowsToAggregate = vereda ? groupRows : filteredRows;

  const lineData = useMemo(() => {
    if (!rowsToAggregate.length || years.length === 0) return [] as { year: string; value: number }[];
    // Sumar población por año
    return years.map((y) => ({
      year: y,
      value: Math.round(rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0))
    }));
  }, [rowsToAggregate, years]);

  const dpYears = useMemo(() => years.map((y) => `DP_${y}`), [years]);

  const barData = useMemo(() => {
    if (!rowsToAggregate.length || dpYears.length === 0) return [] as { year: string; value: number }[];
    // Sumar población y área para cada año, luego calcular densidad
    const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
    return years.map((y) => {
      const pop = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
      const densidad = totalArea > 0 ? pop / totalArea : 0;
      return { year: y, value: densidad };
    });
  }, [rowsToAggregate, years]);

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
            <div className="title">Dashboard Veredas – Población y Densidad (Municipios relacionados con la cuenca)</div>
          </div>
          <div className="hstack">
            <label htmlFor="file" className="sr-only">Subir Excel</label>
            <input id="file" type="file" accept=".xlsx,.xls" onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
            <button className="btn" style={{ marginRight: 12 }} onClick={async () => {
              if (!infoRef.current || !poblacionRef.current || !densidadRef.current || !lineRef.current || !barRef.current || !poblacionMunicipioRef.current) {
                alert("No se pudo recolectar la información para exportar.");
                return;
              }
              // Captura las gráficas como imágenes PNG (siempre en fondo claro para Word)
              let poblacionImg = "";
              let densidadImg = "";
              let pieImg = "";
              let poblacionMunicipioImg = "";
              let poblacionSize = { width: 600, height: 320 };
              let densidadSize = { width: 600, height: 320 };
              let pieSize = { width: 600, height: 320 };
              let poblacionMunicipioSize = { width: 600, height: 320 };
              if (lineRef.current) {
                poblacionSize = {
                  width: lineRef.current.offsetWidth || 600,
                  height: lineRef.current.offsetHeight || 320
                };
              }
              if (barRef.current) {
                densidadSize = {
                  width: barRef.current.offsetWidth || 600,
                  height: barRef.current.offsetHeight || 320
                };
              }
              if (poblacionMunicipioRef.current) {
                poblacionMunicipioSize = {
                  width: 1200,
                  height: 600
                };
              }
              try {
                poblacionImg = await htmlToImage.toPng(lineRef.current, { pixelRatio: 3, backgroundColor: "#fff" });
              } catch { }
              try {
                densidadImg = await htmlToImage.toPng(barRef.current, { pixelRatio: 3, backgroundColor: "#fff" });
              } catch { }
              try {
                // Quitar padding/margen del contenedor solo para la exportación
                let chartNode = poblacionMunicipioRef.current;
                if (chartNode) {
                  const prevPadding = chartNode.style.padding;
                  const prevMargin = chartNode.style.margin;
                  chartNode.style.padding = '0';
                  chartNode.style.margin = '0';
                  try {
                    poblacionMunicipioImg = await htmlToImage.toPng(chartNode, { pixelRatio: 3, backgroundColor: dark ? "#181e2a" : "#fff" });
                  } finally {
                    chartNode.style.padding = prevPadding;
                    chartNode.style.margin = prevMargin;
                  }
                }
              } catch { }
              if (pieRef.current) {
                pieSize = {
                  width: pieRef.current.offsetWidth || 600,
                  height: pieRef.current.offsetHeight || 320
                };
                try {
                  pieImg = await htmlToImage.toPng(pieRef.current, { pixelRatio: 3, backgroundColor: "#fff" });
                } catch { }
              }

              // Construir KPIs para exportar
              let infoKPIs: Array<{ label: string; value: string }> = [];
              if (!vereda && municipio && municipio !== ALL_VALUE && filteredRows.length) {
                // KPIs por municipio (agregado)
                const rowsToAggregate = filteredRows;
                const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
                const rVals = rowsToAggregate.map((r) => toNum(r["R"]))
                  .filter((n) => Number.isFinite(n));
                const rProm = rVals.length ? rVals.reduce((a, b) => a + b, 0) / rVals.length : 0;
                const popByYear: Record<string, number> = {};
                const dpByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                years.forEach((y) => {
                  dpByYear[y] = totalArea > 0 ? popByYear[y] / totalArea : 0;
                });
                const calif = classifyDensity(dpByYear[dpYear]);
                infoKPIs = [
                  { label: "Municipio", value: municipio },
                  { label: "Área total (km²)", value: Number(totalArea).toLocaleString() },
                  { label: "Tasa de Crecimiento Poblacional (R)", value: (rProm * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%" },
                  { label: `Población ${years.includes(dpYear) ? dpYear : years[0]}`, value: Math.round(popByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString() },
                  { label: `Densidad Poblacional ${years.includes(dpYear) ? dpYear : years[0]}`, value: Math.round(dpByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString() + " hab/km²" },
                  { label: "Calificación densidad", value: calif },
                ];
              } else if (aggregatedRow) {
                infoKPIs = [
                  { label: "Municipio", value: aggregatedRow["Municipio"] ?? "" },
                  ...(vereda ? [{ label: "Vereda", value: vereda }] : []),
                  { label: "Área vereda (km²)", value: Number(aggregatedRow["Área vereda en km2"]).toLocaleString() },
                  { label: "Tasa de Crecimiento Poblacional (R)", value: (Number(aggregatedRow["R"]) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%" },
                  { label: `Población ${dpYear}`, value: Math.round(Number(aggregatedRow[dpYear]) || 0).toLocaleString() },
                  { label: `Densidad Poblacional ${dpYear}`, value: Math.round(Number(aggregatedRow[`DP_${dpYear}`]) || 0).toLocaleString() + " hab/km²" },
                  { label: "Calificación densidad", value: (aggregatedRow["Calificación densidad"] ?? "").toString() },
                ];
              }

              if (exportFormat === 'word') {
                exportSectionsToWord({
                  infoKPIs,
                  poblacionHTML: poblacionAnalisisRef.current ? poblacionAnalisisRef.current.innerText : "",
                  densidadHTML: densidadAnalisisRef.current ? densidadAnalisisRef.current.innerText : "",
                  poblacionImg,
                  densidadImg,
                  pieImg,
                  poblacionImgSize: poblacionSize,
                  densidadImgSize: densidadSize,
                  pieImgSize: pieSize,
                  poblacionMunicipioImg,
                  poblacionMunicipioImgSize: poblacionMunicipioSize,
                  tasaRTable,
                  filename: `ficha_${municipio}${vereda ? `_${vereda}` : ''}.docx`
                });
              } else {
                await exportSectionsToPDF({
                  infoKPIs,
                  poblacionHTML: poblacionAnalisisRef.current ? poblacionAnalisisRef.current.innerText : "",
                  densidadHTML: densidadAnalisisRef.current ? densidadAnalisisRef.current.innerText : "",
                  poblacionImg,
                  densidadImg,
                  pieImg,
                  poblacionImgSize: poblacionSize,
                  densidadImgSize: densidadSize,
                  pieImgSize: pieSize,
                  poblacionMunicipioImg,
                  poblacionMunicipioImgSize: poblacionMunicipioSize,
                  filename: `ficha_${municipio}${vereda ? `_${vereda}` : ''}.pdf`
                });
              }
            }}>
              Descargar ficha
            </button>
            <select
              value={exportFormat}
              onChange={e => setExportFormat(e.target.value as 'word' | 'pdf')}
              style={{ marginLeft: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc' }}
              disabled={!rows.length}
            >
              <option value="word">Word (.docx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
            <button className="icon" title="Modo oscuro" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        {/* Tabla de tasas de crecimiento poblacional por municipio */}
        {tasaRTable && Array.isArray(tasaRTable) && tasaRTable.length > 0 && (
          <div className="card" style={{ marginTop: 24, marginBottom: 24, boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
            <div className="card-hd" style={{ fontWeight: 800, fontSize: 22, color: '#4f46e5', marginBottom: 14, letterSpacing: 0.7, textShadow: dark ? '0 2px 8px #232b3e' : '0 2px 8px #e0e7ff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M16 3v4a2 2 0 0 0 2 2h4"/></svg>
                Tasas de crecimiento poblacional por municipio
              </span>
            </div>
            <div className="card-bd" style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
              <table
                style={{
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  width: '100%',
                  maxWidth: 820,
                  minWidth: 540,
                  tableLayout: 'auto',
                  background: dark ? 'linear-gradient(90deg,#181e2a 60%,#232b3e 100%)' : 'linear-gradient(90deg,#f3f6fd 60%,#e0e7ff 100%)',
                  borderRadius: 14,
                  boxShadow: '0 2px 16px 0 rgba(80,100,200,0.13)',
                  fontSize: 12,
                  margin: '0 auto',
                  overflow: 'hidden',
                  transition: 'max-width 0.3s, min-width 0.3s',
                  border: dark ? '1.5px solid #6366f1' : '1.5px solid #4f46e5',
                }}
              >
                <thead>
                  <tr style={{ background: dark ? 'linear-gradient(90deg,#232b3e 60%,#4f46e5 100%)' : 'linear-gradient(90deg,#e0e7ff 60%,#6366f1 100%)', color: dark ? '#fff' : '#232b3e', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                    <th style={{
                      padding: '6px 7px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      borderTopLeftRadius: 12,
                      fontSize: 9,
                      borderRight: '1.5px solid #4f46e5',
                      borderLeft: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Municipio</th>
                    <th style={{
                      padding: '6px 7px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      fontSize: 9,
                      borderRight: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Población 2025</th>
                    <th style={{
                      padding: '6px 7px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      fontSize: 9,
                      borderRight: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Población 2028</th>
                    <th style={{
                      padding: '6px 7px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      fontSize: 9,
                      borderRight: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Población 2030</th>
                    <th style={{
                      padding: '6px 7px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      fontSize: 9,
                      borderRight: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Población 2035</th>
                    <th style={{
                      padding: '6px 5px',
                      borderBottom: '2.5px solid #4f46e5',
                      fontWeight: 900,
                      textAlign: 'center',
                      background: dark ? '#232b3e' : '#e0e7ff',
                      borderTopRightRadius: 12,
                      fontSize: 9,
                      minWidth: 60,
                      maxWidth: 80,
                      borderRight: '1.5px solid #4f46e5',
                      color: dark ? '#e0e7ff' : '#232b3e',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                    }}>Tasa de crecimiento poblacional R</th>
                  </tr>
                </thead>
                <tbody>
                  {tasaRTable.map((row: any, idx: number) => {
                    const municipio = row["Municipio"] || row["municipio"] || row["MUNICIPIO"] || "";
                    const p2025 = row["2025"] ?? row["Población 2025"] ?? row["POBLACION 2025"] ?? row["POBLACIÓN 2025"] ?? "";
                    const p2028 = row["2028"] ?? row["Población 2028"] ?? row["POBLACION 2028"] ?? row["POBLACIÓN 2028"] ?? "";
                    const p2030 = row["2030"] ?? row["Población 2030"] ?? row["POBLACION 2030"] ?? row["POBLACIÓN 2030"] ?? "";
                    const p2035 = row["2035"] ?? row["Población 2035"] ?? row["POBLACION 2035"] ?? row["POBLACIÓN 2035"] ?? "";
                    let tasaR = row["R"] ?? row["Tasa R"] ?? row["TASA R"] ?? row["TASA_R"] ?? row["Tasa de crecimiento poblacional R"] ?? "";
                    // Mostrar tasaR como porcentaje si es numérico
                    if (typeof tasaR === 'number') tasaR = (tasaR * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
                    else if (typeof tasaR === 'string' && tasaR && !tasaR.includes('%')) {
                      const num = Number(tasaR);
                      if (!isNaN(num)) tasaR = (num * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
                    }
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? (dark ? '#232b3e' : '#f3f6fd') : (dark ? '#181e2a' : '#fff'), transition: 'background 0.3s' }}>
                        <td style={{ padding: '10px 8px', borderBottom: '1.5px solid #c7d2fe', fontWeight: 700, borderRight: '1px solid #e0e7ff', borderLeft: idx === 0 ? 'none' : undefined, color: dark ? '#a5b4fc' : '#4f46e5', minWidth: 120, maxWidth: 180, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: 11 }}>{municipio}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: '#22c55e', fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2025).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: '#06b6d4', fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2028).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: '#eab308', fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2030).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: '#ef4444', fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2035).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', color: '#4f46e5', fontWeight: 900, fontSize: 11, minWidth: 60, maxWidth: 80 }}>{tasaR}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
                    {/* Gráfica de poblaciones por municipio */}
        {tasaRTable && Array.isArray(tasaRTable) && tasaRTable.length > 0 && (
          <div ref={poblacionMunicipioRef} style={{ width: '100%', maxWidth: 820, margin: '32px auto 0 auto', background: dark ? '#181e2a' : '#f3f6fd', borderRadius: 12, padding: 16, boxShadow: '0 2px 12px 0 rgba(80,100,200,0.07)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#6366f1', marginBottom: 8, textAlign: 'center' }}>
              Población proyectada por año y municipio
            </div>
            <ResponsiveContainer width="100%" height={320}>
              {(() => {
                // Obtener municipios únicos
                const municipios = tasaRTable.map((row: any) => row["Municipio"] || row["municipio"] || row["MUNICIPIO"] || "").filter(Boolean);
                // Años a graficar
                const years = ["2025", "2028", "2030", "2035"];
                // Colores para municipios
                const barColors = ["#22c55e", "#06b6d4", "#eab308", "#ef4444", "#4f46e5", "#8b5cf6", "#f472b6", "#10b981", "#f59e42", "#6366f1"];
                // Transformar datos: cada objeto es un año, con la población de cada municipio
                const data = years.map((year) => {
                  const entry: any = { year };
                  tasaRTable.forEach((row: any) => {
                    const municipio = row["Municipio"] || row["municipio"] || row["MUNICIPIO"] || "";
                    entry[municipio] = Number(row[year] ?? row["Población " + year] ?? row["POBLACION " + year] ?? row["POBLACIÓN " + year] ?? 0);
                  });
                  return entry;
                });
                return (
                  <BarChart data={data} margin={{ top: 24, right: 24, left: 24, bottom: 32 }}>
                    <XAxis dataKey="year">
                      <Label value="Años" offset={24} position="bottom" style={{ fontSize: 14, fill: dark ? '#e0e7ff' : '#232b3e', fontWeight: 700 }} />
                    </XAxis>
                    <YAxis tick={{ fontSize: 11, fill: dark ? '#e0e7ff' : '#232b3e' }} tickFormatter={v => Number(v).toLocaleString()} >
                      <Label value="Población" angle={-90} position="insideLeft" style={{ fontSize: 14, fill: dark ? '#e0e7ff' : '#232b3e', fontWeight: 700 }} />
                    </YAxis>
                    <Tooltip
                      contentStyle={{ background: dark ? '#232b3e' : '#fff', border: `1px solid #6366f1`, borderRadius: 8, fontWeight: 600, fontSize: 13 }}
                      labelStyle={{ color: dark ? '#e0e7ff' : '#232b3e' }}
                      itemStyle={{ color: dark ? '#e0e7ff' : '#232b3e' }}
                      formatter={(value: any) => Number(value).toLocaleString()}
                      separator=": "
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: dark ? '#e0e7ff' : '#232b3e' }} />
                    {municipios.map((m, idx) => (
                      <Bar key={m} dataKey={m} name={m} fill={barColors[idx % barColors.length]} radius={[6, 6, 0, 0]} />
                    ))}
                  </BarChart>
                );
              })()}
            </ResponsiveContainer>
          </div>
        )}
          </div>
        )}


        {/* Pie */}
        <div className="card" style={{ marginTop: 16, marginBottom: 24, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto', boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
          <div className="card-hd">Distribución de calificación de densidad (Municipios relacionados a la cuenca)
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
                      labelLine={false}
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
                      isAnimationActive={false}
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontWeight: 600 }} labelStyle={{ color: tooltipText }} itemStyle={{ color: tooltipText }} formatter={(v: number) => Number(v).toLocaleString()} />
                    <Legend wrapperStyle={{ color: legendColor, fontWeight: 700, fontSize: 15 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ opacity: .6, textAlign: "center", paddingTop: 80 }}>Sube un Excel para ver la distribución</div>}
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
                  <option value="">Todas las veredas de este municipio con relación con la cuenca</option>
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
        <div ref={infoRef} className="card" style={{ marginTop: 16, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
          <div className="card-hd"><Info size={16} style={{ marginRight: 8 }} /> Información relevante</div>
          <div className="card-bd">
            {(() => {
              if (!rows.length) {
                return <div style={{ opacity: .7 }}>Sube un archivo Excel para comenzar.</div>;
              }
              if (!vereda && municipio && municipio !== ALL_VALUE && filteredRows.length) {
                // KPIs por municipio (agregado)
                const rowsToAggregate = filteredRows;
                const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
                const rVals = rowsToAggregate.map((r) => toNum(r["R"]))
                  .filter((n) => Number.isFinite(n));
                const rProm = rVals.length ? rVals.reduce((a, b) => a + b, 0) / rVals.length : 0;
                const popByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                const dpByYear: Record<string, number> = {};
                years.forEach((y) => {
                  dpByYear[y] = totalArea > 0 ? popByYear[y] / totalArea : 0;
                });
                const calif = classifyDensity(dpByYear[dpYear]);
                return (
                  <div className="kpis kpis-2x3">
                    <div className="kpi"><label>Municipio</label><div className="val">{municipio}</div></div>
                    <div className="kpi"><label>Área total (km²)</label><div className="val">{Number(totalArea).toLocaleString()}</div></div>
                    <div className="kpi"><label>Tasa de Crecimiento Poblacional (R)</label><div className="val">{(rProm * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</div></div>
                    <div className="kpi"><label>Población {years.includes(dpYear) ? dpYear : years[0]}</label><div className="val">{Math.round(popByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString()}</div></div>
                    <div className="kpi"><label>Densidad Poblacional {years.includes(dpYear) ? dpYear : years[0]}</label><div className="val">{Math.round(dpByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString()} hab/km²</div></div>
                    <div className="kpi"><label>Calificación densidad</label><div className="val">{calif}</div></div>
                  </div>
                );
              }
              if (aggregatedRow) {
                return (
                  <div className="kpis kpis-2x3">
                    <div className="kpi"><label>Municipio</label><div className="val">{aggregatedRow["Municipio"] ?? ""}</div></div>
                    <div className="kpi"><label>Área vereda (km²)</label><div className="val">{Number(aggregatedRow["Área vereda en km2"]).toLocaleString()}</div></div>
                    <div className="kpi"><label>Tasa de Crecimiento Poblacional (R)</label><div className="val">{(Number(aggregatedRow["R"]) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</div></div>
                    <div className="kpi"><label>Población {dpYear}</label><div className="val">{Math.round(Number(aggregatedRow[dpYear]) || 0).toLocaleString()}</div></div>
                    <div className="kpi"><label>Densidad Poblacional {dpYear}</label><div className="val">{Math.round(Number(aggregatedRow[`DP_${dpYear}`]) || 0).toLocaleString()} hab/km²</div></div>
                    <div className="kpi"><label>Calificación densidad</label><div className="val">{(aggregatedRow["Calificación densidad"] ?? "").toString()}</div></div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Línea */}
        <div ref={poblacionRef} className="card" style={{ marginTop: 16, boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)', opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
          <div className="card-hd">
            Población proyectada por años
            {municipio && municipio !== ALL_VALUE && vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#6366f1' }}>
                ({municipio} – {vereda})
              </span>
            ) : municipio && municipio !== ALL_VALUE && !vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#6366f1' }}>
                ({municipio} – Todas las veredas con relación a la cuenca)
              </span>
            ) : null}
          </div>
          {/* ...gráfica de población... */}
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
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
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
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontWeight: 600 }} labelStyle={{ color: tooltipText }} itemStyle={{ color: tooltipText }} formatter={(v: number) => Math.round(v).toLocaleString()} />
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
              ) : <div style={{ opacity: .6, textAlign: "center", paddingTop: 80 }}>Sin datos (selecciona vereda)</div>}
            </div>
            {/* Análisis profundo debajo de la gráfica de población */}
            {/* Descripción de la gráfica de población (debajo, personalizada) */}
            <div ref={poblacionAnalisisRef} style={{ fontSize: 15, marginBottom: 12, marginTop: 16, lineHeight: 1.7 }}>
              {municipio && municipio !== ALL_VALUE && (!vereda || vereda === "") && filteredRows.length ? (() => {
                const rowsToAggregate = filteredRows;
                const popByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                const popActual = Math.round(popByYear[dpYear] || 0);
                const popInicial = Math.round(popByYear[years[0]] || 0);
                const popFinal = Math.round(popByYear[years[years.length - 1]] || 0);
                const tendencia = popFinal > popInicial ? 'crecimiento' : (popFinal < popInicial ? 'disminución' : 'estabilidad');
                const difAbs = popFinal - popInicial;
                const difPorc = popInicial > 0 ? ((popFinal - popInicial) / popInicial) * 100 : 0;
                return (
                  <>
                    {vereda ? (
                      <>La población de la vereda <b>{vereda}</b> ({municipio}) pasó de <b>{popInicial.toLocaleString()}</b> habitantes en {years[0]} a <b>{popFinal.toLocaleString()}</b> en {years[years.length - 1]}. En {dpYear} se estima una población de <b>{popActual.toLocaleString()}</b>. La tendencia general es de <b>{tendencia}</b> {tendencia !== 'estabilidad' && (<>(<b>{difAbs >= 0 ? '+' : ''}{difAbs.toLocaleString()}</b>, {difPorc.toFixed(1)}%)</>)} durante el periodo.<br />Esto puede indicar {tendencia === 'crecimiento' ? 'mayor atracción o retención de habitantes' : tendencia === 'disminución' ? 'posible migración o envejecimiento poblacional' : 'un equilibrio demográfico'}.</>
                    ) : (
                      <>
                        La población total del municipio <b>{municipio}</b> pasó de <b>{popInicial.toLocaleString()}</b> habitantes en {years[0]} a <b>{popFinal.toLocaleString()}</b> en {years[years.length - 1]}. En {dpYear} se estima una población de <b>{popActual.toLocaleString()}</b>.<br />
                        <b>Tendencia global:</b> <b>{tendencia}</b> {tendencia !== 'estabilidad' && (<>(<b>{difAbs >= 0 ? '+' : ''}{difAbs.toLocaleString()}</b>, {difPorc.toFixed(1)}%)</>)} durante el periodo analizado.<br />
                        {tendencia === 'crecimiento' && (
                          <>Este crecimiento puede estar impulsado por migración, desarrollo económico o políticas locales exitosas. Es fundamental anticipar la demanda de vivienda, salud, educación y transporte, así como fortalecer la infraestructura básica.<br /></>
                        )}
                        {tendencia === 'disminución' && (
                          <>La disminución poblacional puede deberse a migración hacia otras regiones, envejecimiento o falta de oportunidades. Esto puede afectar la sostenibilidad de servicios y la economía local. Se recomienda analizar causas y diseñar estrategias para retener y atraer población, especialmente joven.<br /></>
                        )}
                        {tendencia === 'estabilidad' && (
                          <>La estabilidad poblacional facilita la planeación y el uso eficiente de recursos. Es una oportunidad para consolidar servicios y mejorar la calidad de vida de los habitantes.<br /></>
                        )}
                        <b>Recomendación:</b> {tendencia === 'crecimiento' ? 'Planificar el crecimiento urbano y rural, priorizando inversiones en servicios públicos y equipamiento social.' : tendencia === 'disminución' ? 'Implementar incentivos para el desarrollo local y la retención de población.' : 'Mantener el monitoreo y fortalecer la gestión municipal.'}
                      </>
                    )}
                  </>
                );
              })() : municipio && municipio !== ALL_VALUE && vereda && aggregatedRow ? (() => {
                // Descripción por vereda (igual que antes)
                const rowsToAggregate = groupRows;
                if (!rowsToAggregate.length) return null;
                const popByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                const popActual = Math.round(popByYear[dpYear] || 0);
                const popInicial = Math.round(popByYear[years[0]] || 0);
                const popFinal = Math.round(popByYear[years[years.length - 1]] || 0);
                const tendencia = popFinal > popInicial ? 'crecimiento' : (popFinal < popInicial ? 'disminución' : 'estabilidad');
                const difAbs = popFinal - popInicial;
                const difPorc = popInicial > 0 ? ((popFinal - popInicial) / popInicial) * 100 : 0;
                return (
                  <>La población de la vereda <b>{vereda}</b> ({municipio}) pasó de <b>{popInicial.toLocaleString()}</b> habitantes en {years[0]} a <b>{popFinal.toLocaleString()}</b> en {years[years.length - 1]}. En {dpYear} se estima una población de <b>{popActual.toLocaleString()}</b>. La tendencia general es de <b>{tendencia}</b> {tendencia !== 'estabilidad' && (<>(<b>{difAbs >= 0 ? '+' : ''}{difAbs.toLocaleString()}</b>, {difPorc.toFixed(1)}%)</>)} durante el periodo.<br />Esto puede indicar {tendencia === 'crecimiento' ? 'mayor atracción o retención de habitantes' : tendencia === 'disminución' ? 'posible migración o envejecimiento poblacional' : 'un equilibrio demográfico'}.</>
                );
              })() : (
                <>Selecciona un municipio y/o vereda para ver la proyección de población.</>
              )}
            </div>
            {municipio && municipio !== ALL_VALUE && aggregatedRow ? (() => {
              const isVereda = !!vereda;
              const rowsToAggregate = isVereda ? groupRows : filteredRows;
              if (!rowsToAggregate.length) return null;
              const popByYear: Record<string, number> = {};
              years.forEach((y) => {
                popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
              });
              const popActual = Math.round(popByYear[dpYear] || 0);
              const popInicial = Math.round(popByYear[years[0]] || 0);
              const popFinal = Math.round(popByYear[years[years.length - 1]] || 0);
              const tendencia = popFinal > popInicial ? 'crecimiento' : (popFinal < popInicial ? 'disminución' : 'estabilidad');
              const difAbs = popFinal - popInicial;
              const difPorc = popInicial > 0 ? ((popFinal - popInicial) / popInicial) * 100 : 0;
              const rVals = rowsToAggregate.map((r) => toNum(r["R"]))
                .filter((n) => Number.isFinite(n));
              const rProm = rVals.length ? rVals.reduce((a, b) => a + b, 0) / rVals.length : 0;
              let interpretacion = '';
              if (tendencia === 'crecimiento') {
                interpretacion = `Este crecimiento puede estar asociado a factores como migración interna, aumento de natalidad o mejoras en las condiciones de vida. Es importante planificar servicios públicos, infraestructura y educación para atender la demanda futura.`;
              } else if (tendencia === 'disminución') {
                interpretacion = `La disminución poblacional podría deberse a migración hacia zonas urbanas, envejecimiento de la población o falta de oportunidades económicas. Se recomienda analizar causas y considerar estrategias para retener población joven.`;
              } else {
                interpretacion = `La estabilidad poblacional indica un balance entre nacimientos, defunciones y migración. Es una oportunidad para fortalecer la calidad de vida y servicios existentes.`;
              }
              let recomendacion = '';
              if (popActual > 1000) {
                recomendacion = 'Se recomienda monitorear el crecimiento y actualizar periódicamente los datos para una mejor toma de decisiones.';
              } else if (popActual < 200) {
                recomendacion = 'La baja población puede dificultar la sostenibilidad de servicios; se sugiere evaluar políticas de incentivo o integración regional.';
              } else {
                recomendacion = 'Mantener seguimiento y promover el desarrollo local.';
              }
              return (
                <div style={{ marginTop: 18, fontSize: 15, background: dark ? '#181e2a' : '#f3f6fd', borderRadius: 8, padding: '12px 18px', color: dark ? '#e5e7eb' : '#232b3e', boxShadow: '0 1px 6px 0 rgba(80,100,200,0.07)' }}>
                  <strong>Resumen poblacional:</strong> En {dpYear}, {isVereda ? (<span>la vereda <b>{vereda}</b> del municipio <b>{municipio}</b></span>) : (<span>el municipio <b>{municipio}</b></span>)} cuenta con una población estimada de <b>{popActual.toLocaleString()}</b> habitantes.<br />
                  Crecimiento promedio anual: <b>{(rProm * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</b>.<br />
                  Variación total: <b>{difAbs >= 0 ? '+' : ''}{difAbs.toLocaleString()} ({difPorc.toFixed(1)}%)</b> entre {years[0]} y {years[years.length - 1]}.<br />
                  <span style={{ color: '#f59e42' }}>{interpretacion}</span><br />
                  <span style={{ color: '#22c55e' }}>{recomendacion}</span>
                </div>
              );
            })() : null}
          </div>
        </div>

        {/* Barras */}
        <div ref={densidadRef} className="card" style={{ marginTop: 16, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto', boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
          <div className="card-hd">
            Densidad poblacional por año (hab/km²)
            {municipio && municipio !== ALL_VALUE && vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#34d399' }}>
                ({municipio} – {vereda})
              </span>
            ) : municipio && municipio !== ALL_VALUE && !vereda ? (
              <span style={{ fontWeight: 400, fontSize: 15, marginLeft: 8, color: '#34d399' }}>
                ({municipio} – Todas las veredas con relación a la cuenca)
              </span>
            ) : null}
          </div>
          {/* ...gráfica de densidad... */}
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
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7} />
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
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontWeight: 600 }} labelStyle={{ color: tooltipText }} itemStyle={{ color: tooltipText }} formatter={(v: number) => `${Math.round(Number(v)).toLocaleString()} hab/km²`} />
                    {/* <Legend wrapperStyle={{ color: legendColor, fontWeight: 700, fontSize: 15 }} iconType="rect" /> */}
                    <Bar dataKey="value" name="Densidad" fill="url(#colorBar)" radius={[8, 8, 0, 0]} isAnimationActive={true} animationDuration={900} label={({ x, y, width, value }) => {
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
              ) : <div style={{ opacity: .6, textAlign: "center", paddingTop: 80 }}>Sin datos (selecciona vereda)</div>}
            </div>
            {/* Análisis profundo debajo de la gráfica de densidad */}
            {/* Descripción de la gráfica de densidad (debajo, personalizada) */}
            <div ref={densidadAnalisisRef} style={{ fontSize: 15, marginBottom: 12, marginTop: 16, lineHeight: 1.7 }}>
              {municipio && municipio !== ALL_VALUE && (!vereda || vereda === "") && filteredRows.length ? (() => {
                const rowsToAggregate = filteredRows;
                const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
                const popByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                const dpByYear: Record<string, number> = {};
                years.forEach((y) => {
                  dpByYear[y] = totalArea > 0 ? popByYear[y] / totalArea : 0;
                });
                const dpActual = Math.round(dpByYear[dpYear] || 0);
                const dpInicial = Math.round(dpByYear[years[0]] || 0);
                const dpFinal = Math.round(dpByYear[years[years.length - 1]] || 0);
                const calif = classifyDensity(dpActual).toLowerCase();
                const tendenciaDP = dpFinal > dpInicial ? 'aumento' : (dpFinal < dpInicial ? 'disminución' : 'estabilidad');
                return (
                  <>
                    {vereda ? (
                      <>La densidad poblacional de la vereda <b>{vereda}</b> ({municipio}) fue de <b>{dpInicial.toLocaleString()} hab/km²</b> en {years[0]} y de <b>{dpFinal.toLocaleString()} hab/km²</b> en {years[years.length - 1]}. Para {dpYear}, la densidad es de <b>{dpActual.toLocaleString()} hab/km²</b> (<b>{calif}</b>). La tendencia es de <b>{tendenciaDP}</b>.<br />Esto puede reflejar {tendenciaDP === 'aumento' ? 'mayor concentración de población y presión sobre servicios' : tendenciaDP === 'disminución' ? 'dispersión o migración' : 'un equilibrio entre población y territorio'}.</>
                    ) : (
                      <>La densidad poblacional agregada del municipio <b>{municipio}</b> fue de <b>{dpInicial.toLocaleString()} hab/km²</b> en {years[0]} y de <b>{dpFinal.toLocaleString()} hab/km²</b> en {years[years.length - 1]}. Para {dpYear}, la densidad es de <b>{dpActual.toLocaleString()} hab/km²</b> (<b>{calif}</b>). La tendencia global es de <b>{tendenciaDP}</b>.<br />Esto indica {tendenciaDP === 'aumento' ? 'creciente urbanización o presión sobre recursos' : tendenciaDP === 'disminución' ? 'dispersión poblacional o pérdida de dinamismo' : 'condiciones estables para la gestión municipal'}.</>
                    )}
                  </>
                );
              })() : municipio && municipio !== ALL_VALUE && vereda && aggregatedRow ? (() => {
                // Descripción por vereda (igual que antes)
                const rowsToAggregate = groupRows;
                if (!rowsToAggregate.length) return null;
                const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
                const popByYear: Record<string, number> = {};
                years.forEach((y) => {
                  popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
                });
                const dpByYear: Record<string, number> = {};
                years.forEach((y) => {
                  dpByYear[y] = totalArea > 0 ? popByYear[y] / totalArea : 0;
                });
                const dpActual = Math.round(dpByYear[dpYear] || 0);
                const dpInicial = Math.round(dpByYear[years[0]] || 0);
                const dpFinal = Math.round(dpByYear[years[years.length - 1]] || 0);
                const calif = classifyDensity(dpActual).toLowerCase();
                const tendenciaDP = dpFinal > dpInicial ? 'aumento' : (dpFinal < dpInicial ? 'disminución' : 'estabilidad');
                return (
                  <>La densidad poblacional de la vereda <b>{vereda}</b> ({municipio}) fue de <b>{dpInicial.toLocaleString()} hab/km²</b> en {years[0]} y de <b>{dpFinal.toLocaleString()} hab/km²</b> en {years[years.length - 1]}. Para {dpYear}, la densidad es de <b>{dpActual.toLocaleString()} hab/km²</b> (<b>{calif}</b>). La tendencia es de <b>{tendenciaDP}</b>.<br />Esto puede reflejar {tendenciaDP === 'aumento' ? 'mayor concentración de población y presión sobre servicios' : tendenciaDP === 'disminución' ? 'dispersión o migración' : 'un equilibrio entre población y territorio'}.</>
                );
              })() : (
                <>Selecciona un municipio y/o vereda para ver la evolución de la densidad poblacional.</>
              )}
            </div>
            {municipio && municipio !== ALL_VALUE && aggregatedRow ? (() => {
              const isVereda = !!vereda;
              const rowsToAggregate = isVereda ? groupRows : filteredRows;
              if (!rowsToAggregate.length) return null;
              const totalArea = rowsToAggregate.reduce((acc, r) => acc + toNum(r["Área vereda en km2"]), 0);
              const popByYear: Record<string, number> = {};
              years.forEach((y) => {
                popByYear[y] = rowsToAggregate.reduce((acc, r) => acc + toNum(r[y]), 0);
              });
              const dpByYear: Record<string, number> = {};
              years.forEach((y) => {
                dpByYear[y] = totalArea > 0 ? popByYear[y] / totalArea : 0;
              });
              const dpActual = Math.round(dpByYear[dpYear] || 0);
              const dpInicial = Math.round(dpByYear[years[0]] || 0);
              const dpFinal = Math.round(dpByYear[years[years.length - 1]] || 0);
              const calif = classifyDensity(dpActual).toLowerCase();
              const tendenciaDP = dpFinal > dpInicial ? 'aumento' : (dpFinal < dpInicial ? 'disminución' : 'estabilidad');
              let interpretacion = '';
              if (tendenciaDP === 'aumento') {
                interpretacion = 'El aumento de densidad puede indicar concentración de población, presión sobre recursos y necesidad de ampliar servicios básicos e infraestructura.';
              } else if (tendenciaDP === 'disminución') {
                interpretacion = 'La disminución de densidad puede reflejar migración, abandono de tierras o envejecimiento poblacional. Es importante analizar si hay pérdida de dinamismo económico.';
              } else {
                interpretacion = 'La estabilidad en la densidad sugiere un equilibrio entre población y territorio, lo que facilita la planificación sostenible.';
              }
              let recomendacion = '';
              if (dpActual > 60) {
                recomendacion = 'Se recomienda evaluar la capacidad de servicios públicos y el impacto ambiental del crecimiento.';
              } else if (dpActual < 20) {
                recomendacion = 'La baja densidad puede dificultar la provisión de servicios; se sugiere explorar estrategias de integración o incentivos para atraer población.';
              } else {
                recomendacion = 'Mantener monitoreo y promover el desarrollo equilibrado.';
              }
              return (
                <div style={{ marginTop: 18, fontSize: 15, background: dark ? '#181e2a' : '#f3f6fd', borderRadius: 8, padding: '12px 18px', color: dark ? '#e5e7eb' : '#232b3e', boxShadow: '0 1px 6px 0 rgba(80,100,200,0.07)' }}>
                  <strong>Resumen de densidad:</strong> En {dpYear}, la densidad poblacional de {isVereda ? (<b>{vereda}</b>) : (<b>{municipio}</b>)} es de <b>{dpActual.toLocaleString()} hab/km²</b> (<b>{calif}</b>).<br />
                  Variación: <b>{dpFinal >= dpInicial ? '+' : ''}{(dpFinal - dpInicial).toLocaleString()}</b> hab/km² entre {years[0]} y {years[years.length - 1]}.<br />
                  <span style={{ color: '#f59e42' }}>{interpretacion}</span><br />
                  <span style={{ color: '#22c55e' }}>{recomendacion}</span>
                </div>
              );
            })() : null}
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
                <strong>Tasa de Crecimiento Poblacional (R)</strong><br />
                La fórmula estándar es:<br />
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  R = (P<sub>f</sub> / P<sub>i</sub>)<sup>1/n</sup> - 1
                </span>
                Donde:<br />
                <ul style={{ margin: '6px 0 6px 18px' }}>
                  <li>P<sub>f</sub> = población final (2025)</li>
                  <li>P<sub>i</sub> = población inicial (2018)</li>
                  <li>n = número o intervalo de años</li>
                </ul>
                <span style={{ color: '#eab308', fontWeight: 500 }}>Esto nos da la <u>tasa anual compuesta de crecimiento poblacional</u>.</span><br />
                <div style={{ margin: '14px 0', background: dark ? '#232b3e' : '#e0e7ff', borderRadius: 8, padding: 12, fontSize: 14, color: dark ? '#e0e7ff' : '#232b3e' }}>
                  <b>¿Por qué usar la tasa de crecimiento poblacional compuesta?</b> La tasa compuesta (CAGR) refleja de manera precisa el crecimiento promedio anual de la población considerando la variabilidad interanual y los efectos acumulativos. Es preferible frente a tasas simples porque suaviza fluctuaciones, permite comparar periodos de distinta duración y es el estándar internacional para proyecciones demográficas. Así, se obtiene una visión más realista y comparable del crecimiento poblacional a lo largo del tiempo.
                </div>
                Con este <b>R</b> podemos proyectar hacia adelante:<br />
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  P<sub>t</sub> = P<sub>2025</sub> · (1 + R)<sup>t-2025</sup>
                </span>
                para t = 2026, 2027, ..., 2036.
              </li>
              <li>
                <strong>Densidad Poblacional (DP)</strong><br />
                La fórmula es:<br />
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  DP<sub>t</sub> = P<sub>t</sub> / Área
                </span>
                Donde:<br />
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
