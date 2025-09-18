import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Document,
  Packer,
  ExternalHyperlink
} from "docx";
export async function exportSectionsToWord(
  {
    tasaRTable,
    filename,
    poblacionChartImg,
    densidadChartImg,
    densidadBarChartImg,
    densidadExport
  }: {
    tasaRTable: any[],
    filename?: string,
    poblacionChartImg?: string | null,
    densidadChartImg?: string | null,
    densidadBarChartImg?: string | null,
    densidadExport?: {
      municipio: string,
      vereda: string | null,
      dpYear: string,
      years: string[],
      dpActual: number,
      dpInicial: number,
      dpFinal: number,
      calif: string,
      tendenciaDP: string,
      interpretacion: string,
      recomendacion: string
    }
  }
) {
  // Helpers
  function normalizeKey(key: string) {
    return key.toLowerCase().replace(/[^a-z0-9]/gi, "");
  }
  function decodeBase64ToUint8Array(base64: string | undefined | null): Uint8Array {
    if (!base64) return new Uint8Array();
    const data = base64.split(",")[1] || base64;
    return Uint8Array.from(atob(data), c => c.charCodeAt(0));
  }

  const dashboardFont = "Arial";
  // --- Texto de análisis y metodología ---
  const analisisParagraphs = [
    // Heading: Horizontes
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "Horizontes de proyección poblacional",
          bold: true,
          size: 32,
          font: dashboardFont,
          color: "000000"
        })
      ]
    }),
    // Intro horizontes
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "La tabla presenta estimaciones de población municipal para tres horizontes temporales, cada uno con implicaciones estratégicas distintas. Para el conjunto de municipios analizados, los porcentajes proyectados de crecimiento poblacional acumulado en cada horizonte son los siguientes: Fuente de datos: Proyecciones oficiales del DANE basadas en el Censo Nacional de Población y Vivienda 2018 (CNPV 2018, periodo 2018-2042)[1].",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Corto plazo
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 80 },
      indent: { left: 640 },
      children: [
        new TextRun({
          text: "• Corto plazo (2025-2028) – Crecimiento acumulado: 4,95%. ",
          bold: true,
          font: dashboardFont,
          size: 22
        }),
        new TextRun({
          text: "Este horizonte permite anticipar cambios demográficos inmediatos, facilitando la asignación eficiente de recursos, la planificación de servicios públicos y la atención de necesidades urgentes. Es clave para la gestión operativa y la toma de decisiones de corto alcance en los gobiernos locales.",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Mediano plazo
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 80 },
      indent: { left: 640 },
      children: [
        new TextRun({
          text: "• Mediano plazo (2025-2030) – Crecimiento acumulado: 7,96%. ",
          bold: true,
          font: dashboardFont,
          size: 22
        }),
        new TextRun({
          text: "Ofrece una visión intermedia que apoya la formulación de políticas públicas, el desarrollo de proyectos de infraestructura y la implementación de programas sociales que requieren maduración y evaluación a medio término. Este horizonte resulta esencial para ajustar estrategias en función de tendencias emergentes y cambios estructurales en la dinámica poblacional.",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Largo plazo
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      indent: { left: 640 },
      children: [
        new TextRun({
          text: "• Largo plazo (2025-2035) – Crecimiento acumulado: 14,69%. ",
          bold: true,
          font: dashboardFont,
          size: 22
        }),
        new TextRun({
          text: "Proporciona una perspectiva de futuro necesaria para la planeación territorial, el desarrollo sostenible y la definición de visiones de largo alcance. Permite anticipar retos asociados al envejecimiento poblacional, las migraciones, la expansión urbana y la creciente demanda de servicios, contribuyendo así a la construcción de territorios resilientes y equitativos.",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Heading Proyecciones oficiales del DANE
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "Proyecciones oficiales del DANE",
          bold: true,
          size: 32,
          font: dashboardFont,
          color: "000000"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "El Departamento Administrativo Nacional de Estadística (DANE) publica proyecciones oficiales de población municipal para cada año entre 2018 y 2042. Estas estimaciones se fundamentan en el Censo Nacional de Población y Vivienda 2018 (CNPV 2018) y en la aplicación de modelos demográficos avanzados. Particularmente, se utiliza el método de componentes demográficos, el cual integra de manera dinámica los nacimientos, las defunciones y la migración interna y externa. Dichos parámetros se ajustan según cohortes de edad y sexo, considerando tendencias históricas y supuestos de política pública.",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Heading Ventajas
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "Ventajas de las proyecciones del DANE frente a una tasa de crecimiento simple",
          bold: true,
          size: 32,
          font: dashboardFont,
          color: "000000"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 40 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Modelos multivariados: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "Incorporan simultáneamente natalidad, mortalidad y migración, en lugar de asumir un crecimiento constante.", font: dashboardFont, size: 22 })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 40 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Desagregación por edad y sexo: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "Permiten proyectar estructuras poblacionales detalladas, no solo totales agregados, lo que es clave para la planeación social y económica.", font: dashboardFont, size: 22 })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 40 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Actualización periódica: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "Se recalibran con nueva información censal y registros administrativos recientes, reflejando cambios en la dinámica demográfica.", font: dashboardFont, size: 22 })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 40 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Evitan sesgos: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "A diferencia de una tasa compuesta calculada entre dos años, las proyecciones oficiales incorporan variaciones interanuales, migraciones coyunturales y choques demográficos.", font: dashboardFont, size: 22 })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 40 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Comparabilidad y validez: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "Son el estándar oficial para el análisis demográfico, las políticas públicas y las comparaciones nacionales e internacionales.", font: dashboardFont, size: 22 })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      indent: { left: 640 },
      children: [
        new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
        new TextRun({ text: "Soporte metodológico: ", bold: true, font: dashboardFont, size: 22 }),
        new TextRun({ text: "Cuentan con documentación detallada y transparente, lo que facilita la auditoría y la replicabilidad de los resultados.", font: dashboardFont, size: 22 })
      ]
    }),
    // Heading Conclusión
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "Conclusión",
          bold: true,
          size: 32,
          font: dashboardFont,
          color: "000000"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Las proyecciones oficiales del DANE constituyen la fuente más confiable y robusta para el análisis y la planificación demográfica en Colombia. Su uso garantiza resultados alineados con estándares internacionales, minimiza riesgos de error o sesgo y sustenta políticas públicas, inversiones y estudios técnicos en bases metodológicas sólidas y transparentes. Optar por estas proyecciones es esencial para una gestión territorial eficiente, equitativa y basada en evidencia.",
          font: dashboardFont,
          size: 22
        })
      ]
    }),
    // Page break so the siguiente sección (densidad) inicia en nueva página
    new Paragraph({
      pageBreakBefore: true,
      children: [new TextRun({ text: "" })]
    })
  ];

  // Paleta de colores para filas
  const rowColors = [
    "22c55e",
    "06b6d4",
    "eab308",
    "ef4444",
    "4f46e5",
    "8b5cf6",
    "f472b6",
    "10b981",
    "f59e42",
    "6366f1"
  ];

  // --- Construcción de la tabla (si hay datos) ---
  let tasaRTableDocx: Table | null = null;

  if (Array.isArray(tasaRTable) && tasaRTable.length > 0) {
    // Filtrar filas que contengan el texto del título para evitar duplicados
    const TITULO = "Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE";
    const filteredTable = (tasaRTable as Array<Record<string, unknown>>).filter(row => {
      return !Object.values(row).some(val => typeof val === 'string' && val.trim() === TITULO);
    });

    const sample = (filteredTable[0] ?? {}) as Record<string, unknown>;
    const keys = Object.keys(sample);

    const findKey = (target: string) =>
      keys.find((k) => normalizeKey(k).includes(normalizeKey(target)));

    const keyMun = findKey("municipio") ?? keys[0];
    const keyPob2025 = keys.find((k) => normalizeKey(k).includes("2025"));
    const keyPob2028 = keys.find((k) => normalizeKey(k).includes("2028"));
    const keyPob2030 = keys.find((k) => normalizeKey(k).includes("2030"));
    const keyPob2035 = keys.find((k) => normalizeKey(k).includes("2035"));

    const headers = [
      "Municipio",
      "Población 2025",
      "Población 2028",
      "Población 2030",
      "Población 2035",
    ];

    const headerRow = new TableRow({
      children: headers.map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: h,
                    bold: true,
                    color: "374151",
                    size: 24,
                    font: dashboardFont,
                  }),
                ],
              }),
            ],
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: "e0e7ff" },
          })
      ),
    });

    const getCellValue = (
      row: Record<string, unknown>,
      key: string | undefined
    ) => {
      if (!key) return "—";
      const val = row[key];
      if (val === undefined || val === null || val === "") return "—";
      const num = Number(val);
      return Number.isFinite(num)
        ? num.toLocaleString("es-CO")
        : String(val);
    };

    const dataRows = (filteredTable as Array<Record<string, unknown>>).map(
      (row, idx) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(row?.[keyMun] ?? "—"),
                      color: rowColors[idx % rowColors.length],
                      size: 22,
                      font: dashboardFont,
                    }),
                  ],
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: getCellValue(row, keyPob2025),
                      color: rowColors[idx % rowColors.length],
                      size: 22,
                      font: dashboardFont,
                    }),
                  ],
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: getCellValue(row, keyPob2028),
                      color: rowColors[idx % rowColors.length],
                      size: 22,
                      font: dashboardFont,
                    }),
                  ],
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: getCellValue(row, keyPob2030),
                      color: rowColors[idx % rowColors.length],
                      size: 22,
                      font: dashboardFont,
                    }),
                  ],
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: getCellValue(row, keyPob2035),
                      color: rowColors[idx % rowColors.length],
                      size: 22,
                      font: dashboardFont,
                    }),
                  ],
                }),
              ],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
          ],
        })
    );

    tasaRTableDocx = new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
        bottom: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
        left: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
        right: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
        insideHorizontal: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
        insideVertical: { size: 1, color: "bfcfff", style: BorderStyle.SINGLE },
      },
    });
  }

  // --- Imagen (gráfica) ---
  const imageParagraph: Paragraph[] = [];
  if (poblacionChartImg) {
    // Título para la imagen de la gráfica de población
    imageParagraph.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        spacing: { before: 300, after: 120 },
        children: [
          new TextRun({
            text: "Gráfica de proyección poblacional",
            bold: true,
            size: 32,
            font: dashboardFont,
            color: "7c3aed"
          })
        ]
      })
    );
    const bytes = decodeBase64ToUint8Array(poblacionChartImg);
    if (bytes && bytes.byteLength > 0) {
      const img = new window.Image();
      img.src = poblacionChartImg;
      let imgWidth = 650;
      let imgHeight = Math.round(imgWidth * 400 / 820);
      img.onload = () => {
        imgWidth = img.naturalWidth;
        imgHeight = img.naturalHeight;
      };

      imageParagraph.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              data: bytes,
              transformation: { width: imgWidth, height: imgHeight },
              type: "png",
            }),
          ],
        })
      );
    }
  }

  // --- Documento ---
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: dashboardFont, size: 22 } },
        heading1: { run: { font: dashboardFont } },
        heading2: { run: { font: dashboardFont } },
        heading3: { run: { font: dashboardFont } },
        listParagraph: { run: { font: dashboardFont } },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text:
                  "Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE",
                bold: true,
                size: 32,
                font: dashboardFont,
                color: "7c3aed"
              }),
            ],
          }),

          ...(tasaRTableDocx
            ? [
              tasaRTableDocx,
              new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: "" })],
              }),
            ]
            : [
              new Paragraph({
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    text: "No hay datos disponibles.",
                    font: dashboardFont,
                  }),
                ],
              }),
            ]),

          // Imagen de la gráfica de población
          ...imageParagraph,

          // Sección de análisis/metodología
          ...analisisParagraphs,


          // Sección de densidad (pie)
          ...(densidadChartImg ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 120 },
              children: [
                new TextRun({
                  text: "Distribución de calificación de densidad (Municipios relacionados a la cuenca)",
                  font: dashboardFont,
                  bold: true,
                  size: 28,
                  color: "4f46e5"
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new ImageRun({
                  data: Uint8Array.from(atob(densidadChartImg.split(",")[1]), c => c.charCodeAt(0)),
                  transformation: { width: 600, height: 230 },
                  type: 'png'
                })
              ]
            }),

          ] : []),

          // Gráfica de barras de densidad poblacional por año
          ...(densidadBarChartImg ? [
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 300, after: 120 },
              children: [
                new TextRun({
                  text: "Densidad poblacional por año (hab/km²)",
                  font: dashboardFont,
                  bold: true,
                  size: 32,
                  color: "7c3aed"
                })
              ]
            }),
            // Imagen barras densidad
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
              children: densidadBarChartImg ? [
                new ImageRun({
                  data: Uint8Array.from(atob(densidadBarChartImg.split(",")[1]), c => c.charCodeAt(0)),
                  transformation: { width: 650, height: 270 },
                  type: 'png'
                })
              ] : []
            }),
            // Texto analítico densidad (mejor visualización en bloques y viñetas de métricas)
            ...(densidadExport ? (() => {
              const { municipio, vereda, dpYear, years, dpActual, dpInicial, dpFinal, calif, tendenciaDP, interpretacion, recomendacion } = densidadExport;
              const variacionAbs = dpFinal - dpInicial;
              const variacionPct = dpInicial ? (variacionAbs / dpInicial) * 100 : 0;
              const encabezadoMunicipio = vereda ? `La densidad poblacional de la vereda ${vereda} (${municipio})` : `La densidad poblacional agregada del municipio ${municipio}`;
              return [
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  // Mayor separación después del párrafo introductorio
                  spacing: { after: 80 },
                  children: [
                    new TextRun({ text: encabezadoMunicipio + ' fue de ', font: dashboardFont, size: 22 }),
                    new TextRun({ text: dpInicial.toLocaleString(), bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: ` hab/km² en ${years[0]} y de `, font: dashboardFont, size: 22 }),
                    new TextRun({ text: dpFinal.toLocaleString(), bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: ` hab/km² en ${years[years.length - 1]}. Para ${dpYear}, la densidad es de `, font: dashboardFont, size: 22 }),
                    new TextRun({ text: dpActual.toLocaleString(), bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: ' hab/km² (', font: dashboardFont, size: 22 }),
                    new TextRun({ text: calif, bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: ').', font: dashboardFont, size: 22 })
                  ]
                }),
                // Métricas en formato de viñetas
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 80, before: 80 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Densidad inicial: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: `${dpInicial.toLocaleString()} hab/km² (${years[0]})`, font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 55 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Densidad final: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: `${dpFinal.toLocaleString()} hab/km² (${years[years.length - 1]})`, font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 55 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Densidad año seleccionado: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: `${dpActual.toLocaleString()} hab/km² (${dpYear})`, font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 55 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Variación absoluta: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: `${variacionAbs >= 0 ? '+' : ''}${variacionAbs.toLocaleString()} hab/km²`, font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 55 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Variación relativa: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: (dpInicial ? (variacionPct >= 0 ? '+' : '') + variacionPct.toFixed(2) + '%' : '—'), font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 55 },
                  indent: { left: 640 },
                  children: [
                    new TextRun({ text: '• Tendencia: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: tendenciaDP, font: dashboardFont, size: 22, bold: true })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 80 },
                  children: [
                    new TextRun({ text: 'Interpretación: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: interpretacion, font: dashboardFont, size: 22 })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 170, before: 170 },
                  children: [
                    new TextRun({ text: 'Recomendación: ', bold: true, font: dashboardFont, size: 22 }),
                    new TextRun({ text: recomendacion, font: dashboardFont, size: 22 })
                  ]
                })
              ];
            })() : []),

            // Explicación de por qué usamos la tasa R y no la proyección DANE
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 300, after: 120 },
              children: [
                new TextRun({
                  text: "¿Por qué usamos la tasa R y no la proyección DANE?",
                  bold: true,
                  size: 28,
                  font: dashboardFont
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: "El DANE no publica proyecciones oficiales de población a nivel de vereda ni para subconjuntos específicos de veredas asociadas a la cuenca. Por lo tanto, no existe una estimación directa y oficial para estos territorios en los horizontes futuros requeridos para la planeación local y la gestión ambiental.",
                  font: dashboardFont,
                  size: 22
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: "Para suplir esta limitación, se calcula la proyección veredal de población aplicando la tasa de crecimiento poblacional compuesta (R), estimada a partir de los datos municipales oficiales del DANE. La tasa R se calculó usando un periodo año a año durante 10 años consecutivos, lo que permite capturar la tendencia reciente y suavizar fluctuaciones anómalas. Este método asume que la dinámica de crecimiento de cada vereda es proporcional a la del municipio al que pertenece, permitiendo así obtener una aproximación robusta y replicable para el análisis territorial.",
                  font: dashboardFont,
                  size: 22
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: "Ventajas técnicas:",
                  bold: true,
                  font: dashboardFont,
                  size: 24
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 40 },
              children: [
                new TextRun({ text: "", size: 1 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 30 },
              indent: { left: 640 },
              children: [
                new TextRun({ text: "• Permite realizar proyecciones a futuro para veredas, donde no existen datos oficiales.", font: dashboardFont, size: 22 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 30 },
              indent: { left: 640 },
              children: [
                new TextRun({ text: "• La tasa R se fundamenta en la evolución real observada en el municipio, integrando efectos de natalidad, mortalidad y migración.", font: dashboardFont, size: 22 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 30 },
              indent: { left: 640 },
              children: [
                new TextRun({ text: "• La metodología es transparente, auditable y puede ser ajustada si se dispone de información adicional local.", font: dashboardFont, size: 22 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 40 },
              indent: { left: 640 },
              children: [
                new TextRun({ text: "• Facilita la comparación entre veredas y municipios bajo un mismo marco analítico.", font: dashboardFont, size: 22 })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: "Nota: Aunque esta aproximación no reemplaza una proyección oficial, es la alternativa más sólida y metodológicamente válida para la gestión y planificación en ausencia de datos DANE a nivel veredal.",
                  italics: true,
                  font: dashboardFont,
                  size: 20,
                  color: "6366f1"
                })
              ]
            })
          ] : []),

          // Sección Fuentes y referencias
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: "Fuentes y referencias",
                bold: true,
                size: 32,
                font: dashboardFont,
                color: "000000"
              })
            ]
          }),
          // Referencia [1]
          // Referencias con hipervínculos clicables
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 40 },
            indent: { left: 640 },
            children: [
              new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
              new ExternalHyperlink({
                link: "https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx",
                children: [
                  new TextRun({
                    text: "Tabla basada en proyecciones de población municipal para el periodo 2018-2042 con base en el CNPV 2018 del DANE",
                    font: dashboardFont,
                    size: 22,
                    color: "1155CC",
                    underline: {}
                  })
                ]
              }),
              new TextRun({ text: " [1].", bold: true, font: dashboardFont, size: 22 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 40 },
            indent: { left: 640 },
            children: [
              new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
              new ExternalHyperlink({
                link: "https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_I_Demografico/2.2.3.-densidad-de-la-poblaci%C3%B3n-en-colombia.html",
                children: [
                  new TextRun({
                    text: "DANE – Densidad de población (Colombia)",
                    font: dashboardFont,
                    size: 22,
                    color: "1155CC",
                    underline: {}
                  })
                ]
              }),
              new TextRun({ text: ".", font: dashboardFont, size: 22 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 40 },
            indent: { left: 640 },
            children: [
              new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
              new ExternalHyperlink({
                link: "https://population.un.org/wpp/",
                children: [
                  new TextRun({
                    text: "United Nations – World Population Prospects (WPP)",
                    font: dashboardFont,
                    size: 22,
                    color: "1155CC",
                    underline: {}
                  })
                ]
              }),
              new TextRun({ text: ".", font: dashboardFont, size: 22 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120 },
            indent: { left: 640 },
            children: [
              new TextRun({ text: "• ", font: dashboardFont, size: 22 }),
              new ExternalHyperlink({
                link: "https://unstats.un.org/unsd/demographic-social/products/dyb/index.cshtml",
                children: [
                  new TextRun({
                    text: "United Nations – Demographic Yearbook",
                    font: dashboardFont,
                    size: 22,
                    color: "1155CC",
                    underline: {}
                  })
                ]
              }),
              new TextRun({ text: ".", font: dashboardFont, size: 22 })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "Para mayor rigor, consulta la documentación oficial del DANE y organismos internacionales de estadística poblacional.",
                italics: true,
                font: dashboardFont,
                size: 20,
                color: "6366f1"
              })
            ]
          }),

        ],
      },
    ],
  });

  // --- Exportar a .docx ---
  const blob = await Packer.toBlob(doc);

  // Descarga en navegador (si hay DOM)
  if (typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "ficha.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Si estás en Node/SSR y quieres devolver el blob/buffer:
  // return blob;
}
