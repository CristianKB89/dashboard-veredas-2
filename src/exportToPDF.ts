// Utilidad para exportar contenido a PDF con formato similar al Word
// Usa pdf-lib (https://pdf-lib.js.org/) para máxima personalización
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';

interface ExportSectionsToPDFParams {
  infoKPIs?: Array<{ label: string; value: string }>;
  infoHTML?: string;
  poblacionHTML: string;
  densidadHTML: string;
  poblacionImg?: string;
  densidadImg?: string;
  pieImg?: string;
  poblacionImgSize?: { width: number; height: number };
  densidadImgSize?: { width: number; height: number };
  pieImgSize?: { width: number; height: number };
  poblacionMunicipioImg?: string;
  poblacionMunicipioImgSize?: { width: number; height: number };
  filename?: string;
}

export async function exportSectionsToPDF(params: ExportSectionsToPDFParams) {
  const {
    infoKPIs = [],
    infoHTML = '',
    poblacionHTML = '',
    densidadHTML = '',
    poblacionImg,
    densidadImg,
    poblacionImgSize = { width: 600, height: 320 },
    densidadImgSize = { width: 600, height: 320 },
    pieImg,
    pieImgSize = { width: 600, height: 320 },
    poblacionMunicipioImg,
    poblacionMunicipioImgSize = { width: 600, height: 320 },
    filename = 'ficha.pdf',
  } = params;

  const pdfDoc: PDFDocument = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points
  const { width, height } = page.getSize();
  let y = height - 40;
  const margin = 40;

    // Helper: draw text with word wrap and handle page breaks
    function drawText(text: string, fontSize = 12, opts: any = {}) {
      const font = opts.font || fonts.regular;
      const color = opts.color || rgb(0,0,0);
      const maxWidth = opts.maxWidth || width - 2 * margin;
      const lineHeight = fontSize + 2;
      // Soporta saltos de línea explícitos
      const paragraphs = text.split('\n');
      for (const para of paragraphs) {
        const words = para.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
          const test = line ? line + ' ' + word : word;
          const size = font.widthOfTextAtSize(test, fontSize);
          if (size > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        for (const l of lines) {
          if (y - lineHeight < margin) {
            // Add new page if not enough space
            const newPage = pdfDoc.addPage([width, height]);
            y = height - margin;
            page = newPage;
          }
          y -= lineHeight;
          page.drawText(l, { x: margin, y, size: fontSize, font, color });
        }
      }
    }

  // Fonts
  const fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont } = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  // Título principal
  y -= 10;
  // Título principal mejorado
  page.drawText('Dashboard Veredas', { x: margin, y, size: 22, font: fonts.bold, color: rgb(0.18,0.23,0.29) });
  y -= 24;
  page.drawText('– Población y Densidad', { x: margin+210, y, size: 18, font: fonts.bold, color: rgb(0.39,0.40,0.95) });
  y -= 20;
  page.drawText('(Municipios y veredas relacionados a la cuenca)', { x: margin, y, size: 13, font: fonts.regular, color: rgb(0.22,0.25,0.32) });
  y -= 24;

  // Sección Información relevante
  page.drawText('Información relevante', { x: margin, y, size: 16, font: fonts.bold });
  y -= 22;
  // Calcular ancho máximo de las etiquetas
  let maxLabelWidth = 0;
  for (const kpi of infoKPIs) {
    const labelWidth = fonts.bold.widthOfTextAtSize(`${kpi.label}:`, 12);
    if (labelWidth > maxLabelWidth) maxLabelWidth = labelWidth;
  }
  const colGap = 18;
  for (const kpi of infoKPIs) {
    if (y - 18 < margin) {
      page = pdfDoc.addPage([width, height]);
      y = height - margin;
    }
    page.drawText(`${kpi.label}:`, { x: margin, y, size: 12, font: fonts.bold });
    page.drawText(kpi.value, { x: margin + maxLabelWidth + colGap, y, size: 12, font: fonts.regular });
    y -= 18;
  }
  y -= 16;

  // Sección Población proyectada
  page.drawText('Población proyectada por años', { x: margin, y, size: 15, font: fonts.bold });
  y -= 20;
  drawText(poblacionHTML, 12, { font: fonts.regular });
  y -= 8;
  if (poblacionImg) {
    const imgBytes = poblacionImg.split(',')[1] ? Uint8Array.from(atob(poblacionImg.split(',')[1]), c => c.charCodeAt(0)) : undefined;
    if (imgBytes) {
      const img = await pdfDoc.embedPng(imgBytes);
      const maxW = Math.min(poblacionImgSize.width, width - 2 * margin);
      const scale = maxW / poblacionImgSize.width;
      const imgH = poblacionImgSize.height * scale;
        if (y - imgH < margin) {
          page = pdfDoc.addPage([width, height]);
          y = height - margin;
        }
        y -= imgH;
        page.drawImage(img, { x: margin, y, width: maxW, height: imgH });
        y -= 20;
    }
  }

  // Sección Densidad poblacional
  page.drawText('Densidad poblacional por año (hab/km²)', { x: margin, y, size: 15, font: fonts.bold });
  y -= 20;
  drawText(densidadHTML, 12, { font: fonts.regular });
  y -= 8;
  if (densidadImg) {
    const imgBytes = densidadImg.split(',')[1] ? Uint8Array.from(atob(densidadImg.split(',')[1]), c => c.charCodeAt(0)) : undefined;
    if (imgBytes) {
      const img = await pdfDoc.embedPng(imgBytes);
      const maxW = Math.min(densidadImgSize.width, width - 2 * margin);
      const scale = maxW / densidadImgSize.width;
      const imgH = densidadImgSize.height * scale;
        if (y - imgH < margin) {
          page = pdfDoc.addPage([width, height]);
          y = height - margin;
        }
        y -= imgH;
        page.drawImage(img, { x: margin, y, width: maxW, height: imgH });
        y -= 20;
    }
  }

  // Sección Gráfica de municipios
  if (poblacionMunicipioImg) {
    page.drawText('Población proyectada por año y municipio', { x: margin, y, size: 15, font: fonts.bold });
    y -= 20;
    const imgBytes = poblacionMunicipioImg.split(',')[1] ? Uint8Array.from(atob(poblacionMunicipioImg.split(',')[1]), c => c.charCodeAt(0)) : undefined;
    if (imgBytes) {
      const img = await pdfDoc.embedPng(imgBytes);
      const maxW = Math.min(poblacionMunicipioImgSize.width, width - 2 * margin);
      const scale = maxW / poblacionMunicipioImgSize.width;
      const imgH = poblacionMunicipioImgSize.height * scale;
      if (y - imgH < margin) {
        page = pdfDoc.addPage([width, height]);
        y = height - margin;
      }
      y -= imgH;
      page.drawImage(img, { x: margin, y, width: maxW, height: imgH });
      y -= 20;
    }
  }

  // Sección Pie chart
  page.drawText('Distribución de calificación de densidad (general)', { x: margin, y, size: 15, font: fonts.bold });
  y -= 20;
  if (pieImg) {
    const imgBytes = pieImg.split(',')[1] ? Uint8Array.from(atob(pieImg.split(',')[1]), c => c.charCodeAt(0)) : undefined;
    if (imgBytes) {
      const img = await pdfDoc.embedPng(imgBytes);
      const maxW = Math.min(pieImgSize.width, width - 2 * margin);
      const scale = maxW / pieImgSize.width;
      const imgH = pieImgSize.height * scale;
      if (y - imgH < margin) {
        page = pdfDoc.addPage([width, height]);
        y = height - margin;
      }
      y -= imgH;
      page.drawImage(img, { x: margin, y, width: maxW, height: imgH });
      y -= 20;
    }
  }

  // Sección Explicación de las fórmulas
  y -= 8;
  page.drawText('Explicación de las fórmulas', { x: margin, y, size: 15, font: fonts.bold });
  y -= 22;
  // Justificación del uso de la tasa compuesta
  drawText('¿Por qué usar la tasa de crecimiento poblacional compuesta? La tasa compuesta (CAGR) refleja de manera precisa el crecimiento promedio anual de la población considerando la variabilidad interanual y los efectos acumulativos. Es preferible frente a tasas simples porque suaviza fluctuaciones, permite comparar periodos de distinta duración y es el estándar internacional para proyecciones demográficas. Así, se obtiene una visión más realista y comparable del crecimiento poblacional a lo largo del tiempo.', 12);
  y -= 14;
  // Tasa de Crecimiento Poblacional (R)
  page.drawText('Tasa de Crecimiento Poblacional (R):', { x: margin, y, size: 12, font: fonts.bold });
  y -= 16;
  page.drawText('R = (Pf / Pi)^(1/n) - 1', { x: margin, y, size: 12, font: fonts.mono });
  y -= 16;
  drawText('Donde: Pf = población final, Pi = población inicial, n = número de años. Esto da la tasa anual compuesta de crecimiento poblacional.', 12);
  y -= 10;
  // Proyección poblacional
  page.drawText('Proyección poblacional:', { x: margin, y, size: 12, font: fonts.bold });
  y -= 16;
  page.drawText('Pt = P2025 · (1 + R)^(t-2025)', { x: margin, y, size: 12, font: fonts.mono });
  y -= 16;
  drawText('Para t = 2026, 2027, ..., 2036.', 12);
  y -= 10;
  // Densidad Poblacional (DP)
  page.drawText('Densidad Poblacional (DP):', { x: margin, y, size: 12, font: fonts.bold });
  y -= 16;
  page.drawText('DPt = Pt / Área', { x: margin, y, size: 12, font: fonts.mono });
  y -= 16;
  drawText('Donde: Pt = población proyectada del año t, Área = área fija de la vereda/municipio (en km²). Esto permite ver cómo la distribución poblacional cambia en el tiempo.', 12);
  y -= 8;

  // Sección Fuentes y referencias
  y -= 8;
  page.drawText('Fuentes y referencias', { x: margin, y, size: 15, font: fonts.bold });
  y -= 20;
  const refs = [
    { text: 'Departamento Administrativo Nacional de Estadística (DANE). (2023). Proyecciones de población.', link: 'https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion' },
    { text: 'Departamento Administrativo Nacional de Estadística (DANE). (2023). Densidad de población.', link: 'https://geoportal.dane.gov.co/servicios/atlas-estadistico/src/Tomo_I_Demografico/2.2.3.-densidad-de-la-poblaci%C3%B3n-en-colombia.html' },
    { text: 'United Nations, Department of Economic and Social Affairs, Population Division. (2022). World Population Prospects 2022.', link: 'https://population.un.org/wpp/' },
    { text: 'United Nations Statistics Division. (2022). Demographic Yearbook.', link: 'https://unstats.un.org/unsd/demographic-social/products/dyb/index.cshtml' },
  ];
  for (const ref of refs) {
    drawText('• ' + ref.text, 12, { font: fonts.regular });
    drawText(ref.link, 12, { color: rgb(0.26,0.45,0.77), font: fonts.mono });
    y -= 2;
  }

  // Descargar
  let pdfBytes;
  try {
    pdfBytes = await pdfDoc.save();
  } catch (e) {
    alert('Error guardando PDF: ' + (e instanceof Error ? e.message : String(e)));
    throw e;
  }
  try {
    const ab = new Uint8Array(pdfBytes).buffer;
    const blob = new Blob([ab], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert('Error descargando PDF: ' + (e instanceof Error ? e.message : String(e)));
    throw e;
  }
}
