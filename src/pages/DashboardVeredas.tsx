import { exportSectionsToWord } from "../exportToWord";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, Label
} from "recharts";
import * as htmlToImage from "html-to-image";
import { Moon, Sun, Info, FileBarChart2 } from "lucide-react";

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
  // Definir colores por fila (puedes personalizar la paleta)
  const rowColors = [
    '#22c55e', // verde
    '#06b6d4', // cyan
    '#eab308', // amarillo
    '#ef4444', // rojo
    '#4f46e5', // azul
    '#8b5cf6', // violeta
    '#f472b6', // rosa
    '#10b981', // verde esmeralda
    '#f59e42', // naranja
    '#6366f1', // azul indigo
  ];
  const infoRef = useRef<HTMLDivElement | null>(null);
  const densidadRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [municipio, setMunicipio] = useState<string>(ALL_VALUE);
  const [vereda, setVereda] = useState<string>("");
  const [dpYear, setDpYear] = useState<string>("2025");
  const [dark, setDark] = useState(true);
  // Solo Word
  const [tasaRTable, setTasaRTable] = useState<any[] | null>(null);

  const pieRef = useRef<HTMLDivElement | null>(null);
  const poblacionChartRef = useRef<HTMLDivElement | null>(null);

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
              let poblacionChartImg: string | null = null;
              let densidadChartImg: string | null = null;
              let densidadBarChartImg: string | null = null;
              // Exportar gráfica de población
              if (poblacionChartRef.current) {
                const prevStyle = poblacionChartRef.current.getAttribute('style') || '';
                const chartDiv = poblacionChartRef.current;
                chartDiv.style.background = dark ? '#181e2a' : '#fff';
                chartDiv.style.padding = '0';
                chartDiv.style.borderRadius = '0';
                chartDiv.style.boxShadow = 'none';
                let exportWidth = 650;
                let exportHeight = Math.round(exportWidth * 400 / 820);
                if (chartDiv.scrollWidth && chartDiv.scrollHeight) {
                  exportWidth = chartDiv.scrollWidth;
                  exportHeight = chartDiv.scrollHeight;
                }
                chartDiv.style.width = exportWidth + 'px';
                chartDiv.style.height = exportHeight + 'px';
                chartDiv.style.maxWidth = exportWidth + 'px';
                chartDiv.style.minWidth = exportWidth + 'px';
                chartDiv.style.margin = '0';
                chartDiv.style.position = 'static';
                const chartResponsive = chartDiv.querySelector('.export-responsive') as HTMLDivElement | null;
                let prevResponsiveHeight = '';
                if (chartResponsive) {
                  prevResponsiveHeight = chartResponsive.style.height;
                  chartResponsive.style.height = exportHeight + 'px';
                  chartResponsive.style.width = exportWidth + 'px';
                }
                try {
                  poblacionChartImg = await htmlToImage.toPng(chartDiv, {
                    pixelRatio: 1,
                    backgroundColor: dark ? '#181e2a' : '#fff',
                    width: exportWidth,
                    height: exportHeight,
                    style: { width: exportWidth + 'px', height: exportHeight + 'px' }
                  });
                } catch (e) {
                  poblacionChartImg = null;
                } finally {
                  chartDiv.setAttribute('style', prevStyle);
                  if (chartResponsive) chartResponsive.style.height = prevResponsiveHeight;
                }
              }
              // Exportar gráfica de densidad (pie)
              if (pieRef.current) {
                const prevStyle = pieRef.current.getAttribute('style') || '';
                const chartDiv = pieRef.current;
                chartDiv.style.background = dark ? '#181e2a' : '#fff';
                chartDiv.style.padding = '0';
                chartDiv.style.borderRadius = '0';
                chartDiv.style.boxShadow = 'none';
                // Aumentar el ancho de exportación y reducir márgenes laterales
                let exportWidth = 1000;
                let exportHeight = 330;
                if (chartDiv.scrollWidth && chartDiv.scrollHeight) {
                  exportWidth = chartDiv.scrollWidth;
                  exportHeight = chartDiv.scrollHeight;
                }
                chartDiv.style.width = exportWidth + 'px';
                chartDiv.style.height = exportHeight + 'px';
                chartDiv.style.maxWidth = exportWidth + 'px';
                chartDiv.style.minWidth = exportWidth + 'px';
                chartDiv.style.margin = '0';
                chartDiv.style.position = 'static';
                try {
                  densidadChartImg = await htmlToImage.toPng(chartDiv, {
                    pixelRatio: 1,
                    backgroundColor: dark ? '#181e2a' : '#fff',
                    width: exportWidth,
                    height: exportHeight,
                    style: { width: exportWidth + 'px', height: exportHeight + 'px' }
                  });
                } catch (e) {
                  densidadChartImg = null;
                } finally {
                  chartDiv.setAttribute('style', prevStyle);
                }
              }

              // Exportar gráfica de barras de densidad poblacional por año
              if (densidadRef.current) {
                const prevStyle = densidadRef.current.getAttribute('style') || '';
                const chartDiv = densidadRef.current.querySelector('.chart') as HTMLElement | null;
                if (chartDiv) {
                  const prevChartStyle = chartDiv.getAttribute('style') || '';
                  chartDiv.style.background = dark ? '#181e2a' : '#fff';
                  chartDiv.style.padding = '0';
                  chartDiv.style.borderRadius = '0';
                  chartDiv.style.boxShadow = 'none';
                  let exportWidth = 820;
                  let exportHeight = 340;
                  if (chartDiv.scrollWidth && chartDiv.scrollHeight) {
                    exportWidth = chartDiv.scrollWidth;
                    exportHeight = chartDiv.scrollHeight;
                  }
                  chartDiv.style.width = exportWidth + 'px';
                  chartDiv.style.height = exportHeight + 'px';
                  chartDiv.style.maxWidth = exportWidth + 'px';
                  chartDiv.style.minWidth = exportWidth + 'px';
                  chartDiv.style.margin = '0';
                  chartDiv.style.position = 'static';
                  try {
                    densidadBarChartImg = await htmlToImage.toPng(chartDiv, {
                      pixelRatio: 1,
                      backgroundColor: dark ? '#181e2a' : '#fff',
                      width: exportWidth,
                      height: exportHeight,
                      style: { width: exportWidth + 'px', height: exportHeight + 'px' }
                    });
                  } catch (e) {
                    densidadBarChartImg = null;
                  } finally {
                    chartDiv.setAttribute('style', prevChartStyle);
                  }
                }
                densidadRef.current.setAttribute('style', prevStyle);
              }
              // Extraer KPIs actuales para infoRelevante
              // Extraer y estructurar datos de densidad para exportar
              let densidadExport: any = null;
              if (municipio && municipio !== ALL_VALUE && (!vereda || vereda === "") && filteredRows.length) {
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
                densidadExport = {
                  municipio,
                  vereda: null,
                  dpYear,
                  years,
                  dpActual,
                  dpInicial,
                  dpFinal,
                  calif,
                  tendenciaDP,
                  interpretacion,
                  recomendacion
                };
              } else if (municipio && municipio !== ALL_VALUE && vereda && aggregatedRow) {
                const rowsToAggregate = groupRows;
                if (rowsToAggregate.length) {
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
                  densidadExport = {
                    municipio,
                    vereda,
                    dpYear,
                    years,
                    dpActual,
                    dpInicial,
                    dpFinal,
                    calif,
                    tendenciaDP,
                    interpretacion,
                    recomendacion
                  };
                }
              }
              exportSectionsToWord({
                tasaRTable: (tasaRTable && tasaRTable.length > 0) ? tasaRTable : rows,
                filename: `ficha_${municipio}${vereda ? `_${vereda}` : ''}.docx`,
                poblacionChartImg,
                densidadChartImg,
                densidadBarChartImg,
                densidadExport
              });
            }}>
              Descargar ficha
            </button>
            {/* Solo exportación Word */}
            <button className="icon" title="Modo oscuro" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
        {/* Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE */}
        {tasaRTable && Array.isArray(tasaRTable) && tasaRTable.length > 0 && (
          <div className="card" style={{ marginTop: 24, marginBottom: 24, boxShadow: '0 4px 24px 0 rgba(80,100,200,0.10)' }}>
            <div className="card-hd" style={{ fontWeight: 800, fontSize: 22, color: '#4f46e5', marginBottom: 14, letterSpacing: 0.7, textShadow: dark ? '0 2px 8px #232b3e' : '0 2px 8px #e0e7ff' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 18, lineHeight: 1.3 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M16 3v4a2 2 0 0 0 2 2h4" /></svg>
                Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE
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
                  </tr>
                </thead>
                <tbody>
                  {/* Renderizar filas de la tabla con color por fila */}
                  {tasaRTable.map((row: any, idx: number) => {
                    const municipio = row["Municipio"] || row["municipio"] || row["MUNICIPIO"] || "";
                    const p2025 = row["2025"] ?? row["Población 2025"] ?? row["POBLACION 2025"] ?? row["POBLACIÓN 2025"] ?? "";
                    const p2028 = row["2028"] ?? row["Población 2028"] ?? row["POBLACION 2028"] ?? row["POBLACIÓN 2028"] ?? "";
                    const p2030 = row["2030"] ?? row["Población 2030"] ?? row["POBLACION 2030"] ?? row["POBLACIÓN 2030"] ?? "";
                    const p2035 = row["2035"] ?? row["Población 2035"] ?? row["POBLACION 2035"] ?? row["POBLACIÓN 2035"] ?? "";
                    const colorFila = rowColors[idx % rowColors.length];
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? (dark ? '#232b3e' : '#f3f6fd') : (dark ? '#181e2a' : '#fff'), transition: 'background 0.3s' }}>
                        <td style={{ padding: '10px 8px', borderBottom: '1.5px solid #c7d2fe', fontWeight: 700, borderRight: '1px solid #e0e7ff', borderLeft: idx === 0 ? 'none' : undefined, color: colorFila, minWidth: 120, maxWidth: 180, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: 11 }}>{municipio}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: colorFila, fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2025).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: colorFila, fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2028).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: colorFila, fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2030).toLocaleString()}</td>
                        <td style={{ padding: '10px 4px', borderBottom: '1.5px solid #c7d2fe', textAlign: 'right', borderRight: '1px solid #e0e7ff', color: colorFila, fontWeight: 700, minWidth: 80, maxWidth: 110, fontSize: 11 }}>{Number(p2035).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Gráfica de poblaciones por municipio */}
            {tasaRTable && Array.isArray(tasaRTable) && tasaRTable.length > 0 && (
              <div ref={poblacionChartRef} style={{ width: '100%', maxWidth: 820, margin: '40px auto 24px auto', background: dark ? '#181e2a' : '#f3f6fd', borderRadius: 12, padding: '32px 48px', boxShadow: '0 2px 12px 0 rgba(80,100,200,0.07)', color: dark ? '#eaeaea' : '#232b3e' }}>
                <div className="export-title" style={{ fontWeight: 700, fontSize: 15, color: '#6366f1', marginBottom: 8, textAlign: 'center' }}>
                  Población proyectada por año y municipio
                </div>
                <ResponsiveContainer className="export-responsive" width="100%" height={400}>
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
                    // Formato compacto con K para miles
                    function formatK(val: number | string): string {
                      const n = Number(val);
                      if (!isFinite(n)) return '—';
                      if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
                      return n.toString();
                    }
                    return (
                      <BarChart data={data} margin={{ top: 24, right: 24, left: 24, bottom: 32 }}>
                        <XAxis dataKey="year">
                          <Label value="Años" offset={24} position="bottom" style={{ fontSize: 14, fill: dark ? '#e0e7ff' : '#232b3e', fontWeight: 700 }} />
                        </XAxis>
                        <YAxis tick={{ fontSize: 11, fill: dark ? '#e0e7ff' : '#232b3e' }} tickFormatter={formatK} >
                          <Label value="Población" angle={-90} position="insideLeft" style={{ fontSize: 14, fill: dark ? '#e0e7ff' : '#232b3e', fontWeight: 700 }} />
                        </YAxis>
                        <Tooltip
                          contentStyle={{ background: dark ? '#232b3e' : '#fff', border: `1px solid #6366f1`, borderRadius: 8, fontWeight: 600, fontSize: 13 }}
                          labelStyle={{ color: dark ? '#e0e7ff' : '#232b3e' }}
                          itemStyle={{ color: dark ? '#e0e7ff' : '#232b3e' }}
                          formatter={(value: any) => formatK(value)}
                          separator=": "
                        />
                        <Legend wrapperStyle={{ fontSize: 12, color: dark ? '#e0e7ff' : '#232b3e' }} />
                        {municipios.map((m, idx) => (
                          <Bar key={m} dataKey={m} name={m} fill={barColors[idx % barColors.length]} radius={[6, 6, 0, 0]}
                            label={({ x, y, width, value }) => {
                              if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof value === 'number' && !isNaN(value) && value > 0) {
                                return (
                                  <text x={x + width / 2} y={y - 8} fill={barColors[idx % barColors.length]} fontSize={13} fontWeight={700} textAnchor="middle">
                                    {formatK(value)}
                                  </text>
                                );
                              }
                              return null;
                            }}
                          />
                        ))}
                      </BarChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ fontSize: 15, color: dark ? '#e0e7ff' : '#232b3e', marginBottom: 12, marginTop: 2, marginLeft: 40, marginRight: 40, lineHeight: 1.6, background: dark ? '#232b3e' : '#e0e7ff', borderRadius: 8, padding: '18px 40px' }}>
              <b>Horizontes de proyección poblacional:</b><br />
              <span>
                La tabla presenta estimaciones de población municipal para tres horizontes temporales, cada uno con implicaciones estratégicas distintas. Para el conjunto de municipios analizados, los porcentajes proyectados de crecimiento poblacional acumulado en cada horizonte son los siguientes:
              </span><br />
              <span style={{ display: 'block', margin: '8px 0 0 0' }}>
                <b>Fuente de datos:</b> Proyecciones oficiales del DANE basadas en el Censo Nacional de Población y Vivienda 2018 (CNPV 2018, periodo 2018-2042)<a href="#ref-dane-1" style={{ color: '#6366f1', textDecoration: 'none' }}><sup>[1]</sup></a>.<br /><br />
              </span>
              <b>Corto plazo (2025-2028) – Crecimiento acumulado: 4,95%.</b> Este horizonte permite anticipar cambios demográficos inmediatos, facilitando la asignación eficiente de recursos, la planificación de servicios públicos y la atención de necesidades urgentes. Es clave para la gestión operativa y la toma de decisiones de corto alcance en los gobiernos locales.<br /><br />
              <b>Mediano plazo (2025-2030) – Crecimiento acumulado: 7,96%.</b> Ofrece una visión intermedia que apoya la formulación de políticas públicas, el desarrollo de proyectos de infraestructura y la implementación de programas sociales que requieren maduración y evaluación a medio término. Este horizonte resulta esencial para ajustar estrategias en función de tendencias emergentes y cambios estructurales en la dinámica poblacional.<br /><br />
              <b>Largo plazo (2025-2035) – Crecimiento acumulado: 14,69%.</b> Proporciona una perspectiva de futuro necesaria para la planeación territorial, el desarrollo sostenible y la definición de visiones de largo alcance. Permite anticipar retos asociados al envejecimiento poblacional, las migraciones, la expansión urbana y la creciente demanda de servicios, contribuyendo así a la construcción de territorios resilientes y equitativos.<br /><br />
              <b>Proyecciones oficiales del DANE:</b><br />
              El Departamento Administrativo Nacional de Estadística (DANE) publica proyecciones oficiales de población municipal para cada año entre 2018 y 2042. Estas estimaciones se fundamentan en el Censo Nacional de Población y Vivienda 2018 (CNPV 2018) y en la aplicación de modelos demográficos avanzados. Particularmente, se utiliza el método de componentes demográficos, el cual integra de manera dinámica los nacimientos, las defunciones y la migración interna y externa. Dichos parámetros se ajustan según cohortes de edad y sexo, considerando tendencias históricas y supuestos de política pública.<br /><br />
              <b>Ventajas de las proyecciones del DANE frente a una tasa de crecimiento simple:</b>
              <ul style={{ margin: '8px 0 0 18px' }}>
                <li><b>Modelos multivariados:</b> Incorporan simultáneamente natalidad, mortalidad y migración, en lugar de asumir un crecimiento constante.</li>
                <li><b>Desagregación por edad y sexo:</b> Permiten proyectar estructuras poblacionales detalladas, no solo totales agregados, lo que es clave para la planeación social y económica.</li>
                <li><b>Actualización periódica:</b> Se recalibran con nueva información censal y registros administrativos recientes, reflejando cambios en la dinámica demográfica.</li>
                <li><b>Evitan sesgos:</b> A diferencia de una tasa compuesta calculada entre dos años, las proyecciones oficiales incorporan variaciones interanuales, migraciones coyunturales y choques demográficos.</li>
                <li><b>Comparabilidad y validez:</b> Son el estándar oficial para el análisis demográfico, las políticas públicas y las comparaciones nacionales e internacionales.</li>
                <li><b>Soporte metodológico:</b> Cuentan con documentación detallada y transparente, lo que facilita la auditoría y la replicabilidad de los resultados.</li>
              </ul><br />
              <b>Conclusión:</b><br />
              Las proyecciones oficiales del DANE constituyen la fuente más confiable y robusta para el análisis y la planificación demográfica en Colombia. Su uso garantiza resultados alineados con estándares internacionales, minimiza riesgos de error o sesgo y sustenta políticas públicas, inversiones y estudios técnicos en bases metodológicas sólidas y transparentes. Optar por estas proyecciones es esencial para una gestión territorial eficiente, equitativa y basada en evidencia.<br />
            </div>
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
              let kpis = null;
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
                kpis = (
                  <div className="kpis kpis-2x3">
                    <div className="kpi"><label>Municipio</label><div className="val">{municipio}</div></div>
                    <div className="kpi"><label>Área total (km²)</label><div className="val">{Number(totalArea).toLocaleString()}</div></div>
                    <div className="kpi"><label>Tasa de Crecimiento Poblacional (R)</label><div className="val">{(rProm * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</div></div>
                    <div className="kpi"><label>Población {years.includes(dpYear) ? dpYear : years[0]}</label><div className="val">{Math.round(popByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString()}</div></div>
                    <div className="kpi"><label>Densidad Poblacional {years.includes(dpYear) ? dpYear : years[0]}</label><div className="val">{Math.round(dpByYear[years.includes(dpYear) ? dpYear : years[0]] || 0).toLocaleString()} hab/km²</div></div>
                    <div className="kpi"><label>Calificación densidad</label><div className="val">{calif}</div></div>
                  </div>
                );
              } else if (aggregatedRow) {
                kpis = (
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
              return (
                <>
                  {kpis}
                </>
              );
            })()}
          </div>

        </div>

        <div className="card" style={{ marginTop: 24, marginBottom: 24, padding: 18 }}>
          {/* Barras (ahora dentro de Información relevante, sin card extra) */}
          <div ref={densidadRef} style={{ marginTop: 10, marginBottom: 0, opacity: !rows.length ? 0.5 : 1, pointerEvents: !rows.length ? 'none' : 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, color: '#34d399', letterSpacing: 0.2 }}>
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

              <div className="chart" style={{ position: 'relative', background: dark ? 'linear-gradient(135deg,#232b3e 60%,#181e2a 100%)' : 'linear-gradient(135deg,#e0e7ff 60%,#f3f6fd 100%)', boxShadow: '0 1px 6px 0 rgba(80,100,200,0.07)', borderRadius: 10, padding: '18px 12px', minHeight: 320 }}>
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
            </div>

            {/* Descripción de la gráfica de densidad (debajo, personalizada) */}
            <div style={{ fontSize: 15, marginBottom: 12, marginTop: 16, lineHeight: 1.7 }}>
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
                <div style={{ marginTop: 18, fontSize: 15, background: dark ? '#232b3e' : '#e0e7ff', borderRadius: 8, padding: '12px 18px', color: dark ? '#e5e7eb' : '#232b3e', boxShadow: '0 1px 6px 0 rgba(80,100,200,0.07)' }}>
                  <strong>Resumen de densidad:</strong> En {dpYear}, la densidad poblacional de {isVereda ? (<b>{vereda}</b>) : (<b>{municipio}</b>)} es de <b>{dpActual.toLocaleString()} hab/km²</b> (<b>{calif}</b>).<br />
                  Variación: <b>{dpFinal >= dpInicial ? '+' : ''}{(dpFinal - dpInicial).toLocaleString()}</b> hab/km² entre {years[0]} y {years[years.length - 1]}.<br />
                  <span style={{ color: '#f59e42' }}>{interpretacion}</span><br />
                  <span style={{ color: '#22c55e' }}>{recomendacion}</span>
                </div>
              );
            })() : null}

          </div>
          <div style={{ fontSize: 12, opacity: .7, marginTop: 8 }}>
            <strong>Notas:</strong> Los años válidos se detectan entre {YEAR_MIN} y {YEAR_MAX}.
          </div>
          {/* Explicación de por qué usamos la tasa R y no la proyección DANE */}
          <div style={{
            marginTop: 22,
            fontSize: 16,
            background: dark ? 'linear-gradient(90deg,#232b3e 60%,#181e2a 100%)' : 'linear-gradient(90deg,#e0e7ff 60%,#f3f6fd 100%)',
            borderRadius: 12,
            padding: '22px 28px',
            color: dark ? '#e0e7ff' : '#232b3e',
            boxShadow: '0 2px 12px 0 rgba(80,100,200,0.10)',
            lineHeight: 1.8,
            letterSpacing: 0.1
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#6366f1', marginBottom: 8, letterSpacing: 0.5 }}>
              ¿Por qué usamos la tasa R y no la proyección DANE?
            </div>
            <span style={{ display: 'block', marginBottom: 8 }}>
              <b>El DANE no publica proyecciones oficiales de población a nivel de vereda ni para subconjuntos específicos de veredas asociadas a la cuenca.</b> Por lo tanto, no existe una estimación directa y oficial para estos territorios en los horizontes futuros requeridos para la planeación local y la gestión ambiental.
            </span>
            <span style={{ display: 'block', marginBottom: 8 }}>
              Para suplir esta limitación, se calcula la <b>proyección veredal de población</b> aplicando la <b>tasa de crecimiento poblacional compuesta (R)</b>, estimada a partir de los datos municipales oficiales del DANE. <br />
              <b>La tasa R se calculó usando un periodo año a año durante 10 años consecutivos</b>, lo que permite capturar la tendencia reciente y suavizar fluctuaciones anómalas. Este método asume que la dinámica de crecimiento de cada vereda es proporcional a la del municipio al que pertenece, permitiendo así obtener una aproximación robusta y replicable para el análisis territorial.
            </span>
            <span style={{ display: 'block', marginBottom: 8 }}>
              <b>Ventajas técnicas:</b> <br />
              <ul style={{ margin: '6px 0 6px 22px', color: dark ? '#a5b4fc' : '#3730a3', fontSize: 15 }}>
                <li>Permite realizar proyecciones a futuro para veredas, donde no existen datos oficiales.</li>
                <li>La tasa R se fundamenta en la evolución real observada en el municipio, integrando efectos de natalidad, mortalidad y migración.</li>
                <li>La metodología es transparente, auditable y puede ser ajustada si se dispone de información adicional local.</li>
                <li>Facilita la comparación entre veredas y municipios bajo un mismo marco analítico.</li>
              </ul>
            </span>
            <span style={{ display: 'block', marginBottom: 0 }}>
              <b>Nota:</b> Aunque esta aproximación no reemplaza una proyección oficial, es la alternativa más sólida y metodológicamente válida para la gestión y planificación en ausencia de datos DANE a nivel veredal.
            </span>
          </div>
        </div>

        {/* Explicación de fórmulas */}
        <div className="card" style={{ marginTop: 24, marginBottom: 24 }}>
          <div className="card-hd">📖 Explicación de las fórmulas</div>
          <div className="card-bd" style={{ fontSize: 15, lineHeight: 1.7 }}>
            <ol style={{ paddingLeft: 18 }}>
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
              <li style={{ marginTop: 18 }}>
                <strong>Tasa de Crecimiento Poblacional (R)</strong><br />
                La fórmula es:<br />
                <span style={{ display: 'block', margin: '8px 0', fontFamily: 'monospace', fontSize: 18 }}>
                  R = (ln(P<sub>f</sub>) - ln(P<sub>i</sub>)) / (t<sub>f</sub> - t<sub>i</sub>)
                </span>
                Donde:<br />
                <ul style={{ margin: '6px 0 6px 18px' }}>
                  <li>P<sub>f</sub> = población final</li>
                  <li>P<sub>i</sub> = población inicial</li>
                  <li>t<sub>f</sub> = año final</li>
                  <li>t<sub>i</sub> = año inicial</li>
                </ul>
                <span style={{ color: '#06b6d4', fontWeight: 500 }}>Esta tasa permite proyectar la población de una vereda o municipio cuando no existen proyecciones oficiales específicas, como ocurre con las veredas de la cuenca.</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Fuentes y referencias */}
        <div className="card" style={{ marginTop: 0, marginBottom: 32 }}>
          <div className="card-hd">🔗 Fuentes y referencias</div>
          <div className="card-bd" style={{ fontSize: 14, lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li id="ref-dane-1" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#6366f1', minWidth: 18, verticalAlign: 'super' }}>[1]</span>
                <span style={{ marginRight: 2 }}>&#8226;</span>
                <a href="https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx" target="_blank" rel="noopener noreferrer">
                  Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE
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
    </div >
  );
}
