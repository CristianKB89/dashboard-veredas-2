// Utilidad para exportar contenido HTML a Word (.docx)
// Usa la librería docx: https://www.npmjs.com/package/docx
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";


interface ExportSectionsToWordParams {
  infoKPIs?: Array<{ label: string; value: string }>;
  infoHTML?: string;
  poblacionHTML: string;
  densidadHTML: string;
  poblacionImg?: string; // base64 PNG
  densidadImg?: string; // base64 PNG
  pieImg?: string; // base64 PNG
  poblacionImgSize?: { width: number; height: number };
  densidadImgSize?: { width: number; height: number };
  pieImgSize?: { width: number; height: number };
  poblacionMunicipioImg?: string; // base64 PNG
  poblacionMunicipioImgSize?: { width: number; height: number };
  tasaRTable?: any[] | null;
  filename?: string;
}

export async function exportSectionsToWord(params: ExportSectionsToWordParams) {
  // Paleta de colores igual que en el dashboard
  const rowColors = [
    '22c55e', // verde
    '06b6d4', // cyan
    'eab308', // amarillo
    'ef4444', // rojo
    '4f46e5', // azul
    '8b5cf6', // violeta
    'f472b6', // rosa
    '10b981', // verde esmeralda
    'f59e42', // naranja
    '6366f1', // azul indigo
  ];
  const {
    infoKPIs = [],
    infoHTML = "",
    poblacionHTML = "",
    densidadHTML = "",
    poblacionImg,
    densidadImg,
    poblacionImgSize = { width: 600, height: 320 },
    densidadImgSize = { width: 600, height: 320 },
    pieImg,
    pieImgSize = { width: 600, height: 320 },
    poblacionMunicipioImg,
    poblacionMunicipioImgSize = { width: 600, height: 320 },
    tasaRTable = null,
    filename = "ficha.docx"
  } = params;

  // Limitar el ancho máximo de imagen en Word (en px)
  const MAX_IMG_WIDTH = 600; // igual que las otras imágenes
  const MAX_IMG_HEIGHT = 600;
  function getScaledSize(size: { width: number; height: number }) {
    let { width, height } = size;
    const widthRatio = MAX_IMG_WIDTH / width;
    const heightRatio = MAX_IMG_HEIGHT / height;
    const scale = Math.min(widthRatio, heightRatio, 1);
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale)
    };
  }

  // Convierte HTML a texto plano (simple)
  function htmlToPlainText(html: string): string {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || "";
  }

  // Construir tabla de tasas de crecimiento si hay datos
  let tasaRTableDocx: Table | null = null;
  if (Array.isArray(tasaRTable) && tasaRTable.length > 0) {
    // Normalizar encabezados igual que en el dashboard
    const normalize = (str = "") => str.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w\d]+/g, "").toLowerCase();
    const sample = tasaRTable[0] || {};
    const keys = Object.keys(sample);
    const findKey = (target: string) => keys.find(k => normalize(k).includes(normalize(target)));
    const keyMun = findKey("municipio") || keys[0];
    const keyTasaR = findKey("tasa r") || findKey("crecimiento r") || findKey("r") || null;
    const keyPob2025 = keys.find(k => normalize(k).includes("2025"));
    const keyPob2028 = keys.find(k => normalize(k).includes("2028"));
    const keyPob2030 = keys.find(k => normalize(k).includes("2030"));
    const keyPob2035 = keys.find(k => normalize(k).includes("2035"));
    // Encabezados
    const headers = [
      "Municipio", "Población 2025", "Población 2028", "Población 2030", "Población 2035", "Tasa de crecimiento R (%)"
    ];
    // Filas
    const rowsDocx = [
      new TableRow({
        children: headers.map(h => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: "e0e7ff" },
        }))
      }),
      ...tasaRTable.map((row, idx) => {
        let tasaR = '—';
        if (keyTasaR) {
          const val = row[keyTasaR];
          if (typeof val === 'number') tasaR = (val * 100).toFixed(2) + '%';
          else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) tasaR = (parseFloat(val) * 100).toFixed(2) + '%';
        }
        let pob2025 = keyPob2025 ? row[keyPob2025] : undefined;
        let pob2028 = keyPob2028 ? row[keyPob2028] : undefined;
        let pob2030 = keyPob2030 ? row[keyPob2030] : undefined;
        let pob2035 = keyPob2035 ? row[keyPob2035] : undefined;
        const colorFila = rowColors[idx % rowColors.length];
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row[keyMun] || '—', color: colorFila })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pob2025 !== undefined ? Number(pob2025).toLocaleString() : '—', color: colorFila })] })], width: { size: 16, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pob2028 !== undefined ? Number(pob2028).toLocaleString() : '—', color: colorFila })] })], width: { size: 16, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pob2030 !== undefined ? Number(pob2030).toLocaleString() : '—', color: colorFila })] })], width: { size: 16, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pob2035 !== undefined ? Number(pob2035).toLocaleString() : '—', color: colorFila })] })], width: { size: 16, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tasaR, color: colorFila })] })], width: { size: 16, type: WidthType.PERCENTAGE } }),
          ]
        });
      })
    ];
    tasaRTableDocx = new Table({
      rows: rowsDocx,
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { size: 1, color: "bfcfff", style: "single" },
        bottom: { size: 1, color: "bfcfff", style: "single" },
        left: { size: 1, color: "bfcfff", style: "single" },
        right: { size: 1, color: "bfcfff", style: "single" },
        insideHorizontal: { size: 1, color: "bfcfff", style: "single" },
        insideVertical: { size: 1, color: "bfcfff", style: "single" }
      }
    });
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Segoe UI",
            size: 24,
          },
          paragraph: {
            spacing: { after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "Información relevante",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 },
            alignment: "left"
          }),
          ...(Array.isArray(infoKPIs) && infoKPIs.length
            ? infoKPIs.map(kpi => [
                new Paragraph({
                  text: kpi.label,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  text: kpi.value,
                  spacing: { after: 120 },
                })
              ]).flat()
            : [new Paragraph(htmlToPlainText(infoHTML || ""))]),
          new Paragraph({ text: "" }),
          ...(tasaRTableDocx ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Tabla 1. Tasas de crecimiento poblacional y proyección por municipio",
                    bold: true,
                    size: 28,
                    color: "374151"
                  })
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 80 },
                alignment: "center"
              }),
              tasaRTableDocx,
              new Paragraph({ text: "Tasas calculadas con CAGR: r = (Pf / Pi)^1/n − 1, usando Pi = población 2025 y Pf en 2028/2030/2035.", spacing: { after: 120 }, alignment: "left" }),            
              ...(poblacionMunicipioImg ? [
                new Paragraph({ text: "" }),
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: poblacionMunicipioImg && poblacionMunicipioImg.startsWith("data:image") ? Uint8Array.from(atob(poblacionMunicipioImg.split(",")[1]), c => c.charCodeAt(0)) : new Uint8Array(),
                      transformation: getScaledSize(poblacionMunicipioImgSize),
                      type: "png"
                    })
                  ],
                  spacing: { after: 400 },
                })
              ] : [])
          ] : []),
          new Paragraph({
            text: "Población proyectada por años",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          new Paragraph({
            text: htmlToPlainText(poblacionHTML),
            alignment: "both"
          }),
          ...(poblacionImg ? [
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: poblacionImg && poblacionImg.startsWith("data:image") ? Uint8Array.from(atob(poblacionImg.split(",")[1]), c => c.charCodeAt(0)) : new Uint8Array(),
                  transformation: getScaledSize(poblacionImgSize),
                  type: "png"
                })
              ],
              spacing: { after: 200 },
            })
          ] : []),
          new Paragraph({
            text: "Densidad poblacional por año (hab/km²)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          new Paragraph({
            text: htmlToPlainText(densidadHTML),
            alignment: "both"
          }),
          ...(densidadImg ? [
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: densidadImg && densidadImg.startsWith("data:image") ? Uint8Array.from(atob(densidadImg.split(",")[1]), c => c.charCodeAt(0)) : new Uint8Array(),
                  transformation: getScaledSize(densidadImgSize),
                  type: "png"
                })
              ],
              spacing: { after: 200 },
            })
          ] : []),

          // Pie chart sección
          new Paragraph({
            text: "Distribución de calificación de densidad (general)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          ...(pieImg ? [
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: pieImg && pieImg.startsWith("data:image") ? Uint8Array.from(atob(pieImg.split(",")[1]), c => c.charCodeAt(0)) : new Uint8Array(),
                  transformation: getScaledSize(pieImgSize),
                  type: "png"
                })
              ],
              spacing: { after: 200 },
            })
          ] : []),

          // Explicación de las fórmulas
          new Paragraph({
            text: "Explicación de las fórmulas",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          // Justificación de la tasa compuesta
          new Paragraph({
            children: [
              new TextRun({
                text: '¿Por qué usar la tasa de crecimiento poblacional compuesta? ',
                bold: true
              }),
              new TextRun('La tasa compuesta (CAGR) refleja de manera precisa el crecimiento promedio anual de la población considerando la variabilidad interanual y los efectos acumulativos. Es preferible frente a tasas simples porque suaviza fluctuaciones, permite comparar periodos de distinta duración y es el estándar internacional para proyecciones demográficas. Así, se obtiene una visión más realista y comparable del crecimiento poblacional a lo largo del tiempo.')
            ],
            spacing: { after: 180 },
          }),
          new Paragraph({
            text: 'Tasa de Crecimiento Poblacional (R):',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
            alignment: "left"
          }),
          new Paragraph({
            text: 'R = (Pf / Pi)^1/n − 1',
            spacing: { after: 80 },
            alignment: "left"
          }),
          new Paragraph({
            text: 'Donde: Pf = población final, Pi = población inicial, n = número de años. Esto da la tasa anual compuesta de crecimiento poblacional.',
            spacing: { after: 120 },
            alignment: "left"
          }),
          new Paragraph({
            text: "Proyección poblacional:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "P", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "t", subScript: true, font: "Consolas", size: 22 }),
              new TextRun({ text: " = P", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "2025", subScript: true, font: "Consolas", size: 22 }),
              new TextRun({ text: " · (1 + R)", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "t-2025", superScript: true, font: "Consolas", size: 22 }),
            ],
            alignment: "center",
            spacing: { after: 40 },
          }),
          new Paragraph({
            text: "Para t = 2026, 2027, ..., 2036.",
            alignment: "both",
            spacing: { after: 80 },
          }),
          new Paragraph({
            text: "Densidad Poblacional (DP):",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "DP", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "t", subScript: true, font: "Consolas", size: 22 }),
              new TextRun({ text: " = ", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "P", font: "Consolas", size: 28, bold: true }),
              new TextRun({ text: "t", subScript: true, font: "Consolas", size: 22 }),
              new TextRun({ text: " / Área", font: "Consolas", size: 28, bold: true }),
            ],
            alignment: "center",
            spacing: { after: 40 },
          }),
          new Paragraph({
            text: "Donde: Pt = población proyectada del año t, Área = área fija de la vereda/municipio (en km²). Esto permite ver cómo la distribución poblacional cambia en el tiempo.",
            alignment: "both",
            spacing: { after: 120 },
          }),

          // Fuentes y referencias
          new Paragraph({
            text: "Fuentes y referencias",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          }),
          // Referencias en formato APA, presentadas como lista con sangría
          new Paragraph({
            text: "Referencias:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          ...[
            {
              text: "Departamento Administrativo Nacional de Estadística (DANE). (2023). Proyecciones de población.",
              link: "https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion"
            },
            {
              text: "Departamento Administrativo Nacional de Estadística (DANE). (2023). Densidad de población.",
              link: "https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_I_Demografico/2.2.3.-densidad-de-la-poblaci%C3%B3n-en-colombia.html"
            },
            {
              text: "United Nations, Department of Economic and Social Affairs, Population Division. (2022). World Population Prospects 2022.",
              link: "https://population.un.org/wpp/"
            },
            {
              text: "United Nations Statistics Division. (2022). Demographic Yearbook.",
              link: "https://unstats.un.org/unsd/demographic-social/products/dyb/index.cshtml"
            }
          ].map(ref => new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: ref.text, break: 1 }),
              new TextRun({ text: ref.link, color: "4472C4", underline: {}, break: 1 })
            ],
            alignment: "both",
            spacing: { after: 40 },
            indent: { left: 720, hanging: 360 },
            style: "ListParagraph"
          })),
          new Paragraph({
            text: "Para mayor rigor, consulta la documentación oficial del DANE y organismos internacionales de estadística poblacional.",
            alignment: "both",
            spacing: { after: 120 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
