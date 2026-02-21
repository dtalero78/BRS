/**
 * PDF Chart Drawing Utilities for PDFKit
 * Provides pie charts, bar charts, grouped bar charts, and tables.
 */

const RISK_COLORS = {
  sin_riesgo: '#22C55E',
  riesgo_bajo: '#84CC16',
  riesgo_medio: '#EAB308',
  riesgo_alto: '#F97316',
  riesgo_muy_alto: '#EF4444'
};

const RISK_ORDER = ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto'];

const RISK_LABELS = {
  sin_riesgo: 'Sin Riesgo',
  riesgo_bajo: 'Riesgo Bajo',
  riesgo_medio: 'Riesgo Medio',
  riesgo_alto: 'Riesgo Alto',
  riesgo_muy_alto: 'Riesgo Muy Alto'
};

// ============================================================
// PIE CHART
// ============================================================
/**
 * Draw a pie chart using SVG path arcs.
 * @param {PDFDocument} doc
 * @param {number} cx - center X
 * @param {number} cy - center Y
 * @param {number} radius
 * @param {Array<{label: string, value: number, color: string}>} data
 * @param {object} options - { showPercentages, showLegend, legendX, legendY, title }
 */
function drawPieChart(doc, cx, cy, radius, data, options = {}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;

  // Filter out zero-value slices for drawing
  const nonZero = data.filter(d => d.value > 0);

  let startAngle = -Math.PI / 2; // Start from 12 o'clock

  nonZero.forEach(slice => {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    // Special case: single slice (full circle)
    if (nonZero.length === 1) {
      doc.save();
      doc.circle(cx, cy, radius).fillColor(slice.color).fill();
      doc.restore();
    } else {
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      doc.save();
      doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`)
        .fillColor(slice.color).fill();
      doc.restore();
    }

    // Percentage label inside slice (only if slice is big enough)
    if (options.showPercentages !== false && sliceAngle > 0.3) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = radius * 0.6;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);
      const pct = ((slice.value / total) * 100).toFixed(0) + '%';
      doc.save();
      doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text(pct, lx - 15, ly - 5, { width: 30, align: 'center' });
      doc.restore();
    }

    startAngle = endAngle;
  });

  // Legend
  if (options.showLegend !== false) {
    const legendX = options.legendX != null ? options.legendX : cx + radius + 20;
    let legendY = options.legendY != null ? options.legendY : cy - (data.length * 15) / 2;

    data.forEach(slice => {
      if (slice.value === 0 && options.hideZeroInLegend) return;
      doc.save();
      doc.rect(legendX, legendY + 1, 8, 8).fillColor(slice.color).fill();
      const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';
      doc.fontSize(7).fillColor('#374151').font('Helvetica');
      doc.text(`${slice.label} (${pct}%)`, legendX + 12, legendY, { width: 150 });
      doc.restore();
      legendY += 14;
    });
  }

  // Title below chart
  if (options.title) {
    doc.save();
    doc.fontSize(8).fillColor('#4B5563').font('Helvetica-Bold');
    doc.text(options.title, cx - radius - 20, cy + radius + 8, {
      width: (radius + 20) * 2,
      align: 'center'
    });
    doc.restore();
  }
}

// ============================================================
// BAR CHART (single series)
// ============================================================
/**
 * Draw a simple bar chart with categories on X axis.
 * @param {PDFDocument} doc
 * @param {number} x - top-left X
 * @param {number} y - top-left Y
 * @param {number} chartWidth
 * @param {number} chartHeight
 * @param {Array<{label: string, value: number, color: string}>} data
 * @param {object} options - { title, showValues, yAxisLabel }
 */
function drawBarChart(doc, x, y, chartWidth, chartHeight, data, options = {}) {
  const margin = { left: 30, right: 10, top: 5, bottom: 50 };
  const plotW = chartWidth - margin.left - margin.right;
  const plotH = chartHeight - margin.top - margin.bottom;
  const plotX = x + margin.left;
  const plotY = y + margin.top;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  // Y axis
  doc.save();
  doc.moveTo(plotX, plotY).lineTo(plotX, plotY + plotH)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // Y axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const tickY = plotY + plotH - (i / yTicks) * plotH;
    const tickVal = Math.round((i / yTicks) * maxVal);
    doc.fontSize(6).fillColor('#6B7280').font('Helvetica');
    doc.text(String(tickVal), x, tickY - 4, { width: margin.left - 4, align: 'right' });
    if (i > 0) {
      doc.moveTo(plotX, tickY).lineTo(plotX + plotW, tickY)
        .strokeColor('#E5E7EB').lineWidth(0.3).stroke();
    }
  }

  // X axis
  doc.moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // Bars
  const barGap = 8;
  const barWidth = Math.min((plotW - barGap * (data.length + 1)) / data.length, 50);
  const totalBarsWidth = data.length * barWidth + (data.length - 1) * barGap;
  const startX = plotX + (plotW - totalBarsWidth) / 2;

  data.forEach((d, i) => {
    const bx = startX + i * (barWidth + barGap);
    const barH = maxVal > 0 ? (d.value / maxVal) * plotH : 0;
    const by = plotY + plotH - barH;

    // 3D effect
    const depth = 4;
    // Side face
    doc.path(`M ${bx + barWidth} ${by} L ${bx + barWidth + depth} ${by - depth} L ${bx + barWidth + depth} ${by - depth + barH} L ${bx + barWidth} ${by + barH} Z`)
      .fillColor(darkenColor(d.color, 0.7)).fill();
    // Top face
    doc.path(`M ${bx} ${by} L ${bx + depth} ${by - depth} L ${bx + barWidth + depth} ${by - depth} L ${bx + barWidth} ${by} Z`)
      .fillColor(lightenColor(d.color, 1.15)).fill();
    // Front face
    doc.rect(bx, by, barWidth, barH).fillColor(d.color).fill();

    // Value on top
    if (options.showValues !== false && d.value > 0) {
      doc.fontSize(7).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(String(d.value), bx - 5, by - 10, { width: barWidth + 10, align: 'center' });
    }

    // Label below
    doc.fontSize(6).fillColor('#374151').font('Helvetica');
    doc.text(d.label, bx - 10, plotY + plotH + 4, { width: barWidth + 20, align: 'center' });
  });
  doc.restore();

  // Title
  if (options.title) {
    doc.save();
    doc.fontSize(9).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text(options.title, x, y - 14, { width: chartWidth, align: 'center' });
    doc.restore();
  }
}

// ============================================================
// GROUPED BAR CHART
// ============================================================
/**
 * Draw a grouped bar chart.
 * @param {PDFDocument} doc
 * @param {number} x
 * @param {number} y
 * @param {number} chartWidth
 * @param {number} chartHeight
 * @param {string[]} categories - X axis labels
 * @param {Array<{label: string, color: string, values: number[]}>} series
 * @param {object} options - { title, showValues, showLegend, legendPosition }
 */
function drawGroupedBarChart(doc, x, y, chartWidth, chartHeight, categories, series, options = {}) {
  const margin = { left: 25, right: 10, top: 5, bottom: 55 };
  const legendH = options.showLegend !== false ? 18 : 0;
  const plotW = chartWidth - margin.left - margin.right;
  const plotH = chartHeight - margin.top - margin.bottom - legendH;
  const plotX = x + margin.left;
  const plotY = y + margin.top;

  // Max value across all series
  let maxVal = 0;
  categories.forEach((_, ci) => {
    series.forEach(s => {
      if ((s.values[ci] || 0) > maxVal) maxVal = s.values[ci];
    });
  });
  maxVal = Math.max(maxVal, 1);

  doc.save();

  // Y axis
  doc.moveTo(plotX, plotY).lineTo(plotX, plotY + plotH)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // Y ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const tickY = plotY + plotH - (i / yTicks) * plotH;
    const tickVal = Math.round((i / yTicks) * maxVal);
    doc.fontSize(6).fillColor('#6B7280').font('Helvetica');
    doc.text(String(tickVal), x, tickY - 4, { width: margin.left - 4, align: 'right' });
    if (i > 0) {
      doc.moveTo(plotX, tickY).lineTo(plotX + plotW, tickY)
        .strokeColor('#E5E7EB').lineWidth(0.3).stroke();
    }
  }

  // X axis
  doc.moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // Bars
  const catCount = categories.length;
  const serCount = series.length;
  const categoryWidth = plotW / catCount;
  const barGap = 1;
  const maxBarWidth = 12;
  const barWidth = Math.min((categoryWidth - (serCount + 1) * barGap) / serCount, maxBarWidth);

  categories.forEach((cat, ci) => {
    const catX = plotX + ci * categoryWidth;
    const groupWidth = serCount * barWidth + (serCount - 1) * barGap;
    const groupStartX = catX + (categoryWidth - groupWidth) / 2;

    series.forEach((s, si) => {
      const bx = groupStartX + si * (barWidth + barGap);
      const val = s.values[ci] || 0;
      const barH = maxVal > 0 ? (val / maxVal) * plotH : 0;
      const by = plotY + plotH - barH;

      if (barH > 0) {
        doc.rect(bx, by, barWidth, barH).fillColor(s.color).fill();

        if (options.showValues && val > 0) {
          doc.fontSize(5).fillColor('#1F2937').font('Helvetica');
          doc.text(String(val), bx - 2, by - 8, { width: barWidth + 4, align: 'center' });
        }
      }
    });

    // Category label (truncate if needed)
    const displayLabel = cat.length > 18 ? cat.substring(0, 16) + '...' : cat;
    doc.fontSize(5.5).fillColor('#374151').font('Helvetica');
    doc.text(displayLabel, catX, plotY + plotH + 3, { width: categoryWidth, align: 'center' });
  });

  // Legend
  if (options.showLegend !== false) {
    const legendY = plotY + plotH + margin.bottom - legendH + 2;
    let lx = plotX;
    series.forEach(s => {
      doc.rect(lx, legendY, 7, 7).fillColor(s.color).fill();
      doc.fontSize(6).fillColor('#374151').font('Helvetica');
      doc.text(s.label, lx + 9, legendY, { width: 65 });
      lx += 75;
    });
  }

  doc.restore();

  // Title
  if (options.title) {
    doc.save();
    doc.fontSize(9).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text(options.title, x, y - 14, { width: chartWidth, align: 'center' });
    doc.restore();
  }
}

// ============================================================
// TABLE
// ============================================================
/**
 * Draw a table with headers and rows, auto page-break with header re-draw.
 * @param {PDFDocument} doc
 * @param {number} x
 * @param {number} startY
 * @param {number} tableWidth
 * @param {Array<{label: string, width: number, align?: string}>} headers - width is fraction (0-1)
 * @param {string[][]} rows
 * @param {object} options - { headerBgColor, headerTextColor, altRowColor, fontSize, rowHeight, cellPadding }
 * @returns {number} Y position after the table
 */
function drawTable(doc, x, startY, tableWidth, headers, rows, options = {}) {
  const fontSize = options.fontSize || 7;
  const cellPad = options.cellPadding || 4;
  const headerBg = options.headerBgColor || '#CBD5E1';
  const headerTextColor = options.headerTextColor || '#1E293B';
  const altRowColor = options.altRowColor || '#F8FAFC';
  const borderColor = options.borderColor || '#CBD5E1';
  const minRowH = options.rowHeight || 20;

  function measureRowHeight(row) {
    let maxH = minRowH;
    headers.forEach((h, ci) => {
      const colW = h.width * tableWidth - cellPad * 2;
      const text = row[ci] || '';
      const lines = Math.ceil(doc.fontSize(fontSize).font('Helvetica').widthOfString(text) / colW);
      const textH = lines * (fontSize + 2) + cellPad * 2;
      if (textH > maxH) maxH = textH;
    });
    return maxH;
  }

  function drawHeaderRow(atY) {
    doc.save();
    doc.rect(x, atY, tableWidth, minRowH).fillColor(headerBg).fill();
    doc.rect(x, atY, tableWidth, minRowH).strokeColor(borderColor).lineWidth(0.5).stroke();
    let colX = x;
    headers.forEach(h => {
      const colW = h.width * tableWidth;
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(headerTextColor);
      doc.text(h.label, colX + cellPad, atY + cellPad, {
        width: colW - cellPad * 2,
        align: h.align || 'left'
      });
      colX += colW;
    });
    doc.restore();
    return atY + minRowH;
  }

  let currentY = drawHeaderRow(startY);

  rows.forEach((row, ri) => {
    const rowH = measureRowHeight(row);

    // Page break check
    if (currentY + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      currentY = doc.page.margins.top;
      currentY = drawHeaderRow(currentY);
    }

    doc.save();
    // Alternate row background
    if (ri % 2 === 0) {
      doc.rect(x, currentY, tableWidth, rowH).fillColor(altRowColor).fill();
    }
    // Row border
    doc.rect(x, currentY, tableWidth, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();

    // Cell content
    let colX = x;
    headers.forEach((h, ci) => {
      const colW = h.width * tableWidth;
      doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
      doc.text(row[ci] || '', colX + cellPad, currentY + cellPad, {
        width: colW - cellPad * 2,
        align: h.align || 'left'
      });
      colX += colW;
    });
    doc.restore();
    currentY += rowH;
  });

  return currentY;
}

// ============================================================
// RISK BAR SERIES HELPER
// ============================================================
/**
 * Create standard risk level series for grouped bar charts.
 * @param {object} riskCountsByCategory - { categoryKey: { sin_riesgo: N, ... }, ... }
 * @param {string[]} categoryKeys - ordered keys
 * @returns {Array<{label: string, color: string, values: number[]}>}
 */
function createRiskSeries(riskCountsByCategory, categoryKeys) {
  return RISK_ORDER.map(riskKey => ({
    label: RISK_LABELS[riskKey],
    color: RISK_COLORS[riskKey],
    values: categoryKeys.map(catKey => (riskCountsByCategory[catKey] || {})[riskKey] || 0)
  }));
}

// ============================================================
// COLOR UTILITIES
// ============================================================
function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

function lightenColor(hex, factor) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) * factor);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

module.exports = {
  drawPieChart,
  drawBarChart,
  drawGroupedBarChart,
  drawTable,
  createRiskSeries,
  RISK_COLORS,
  RISK_ORDER,
  RISK_LABELS
};
