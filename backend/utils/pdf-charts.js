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
  const manyBars = data.length > 6;
  const margin = { left: 30, right: 10, top: 5, bottom: manyBars ? 70 : 50 };
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

    // Label below - rotate diagonally when there are many bars
    const maxLabelChars = data.length > 12 ? 8 : data.length > 6 ? 11 : 30;
    const displayLabel = d.label.length > maxLabelChars
      ? d.label.substring(0, maxLabelChars - 2) + '..'
      : d.label;
    if (manyBars) {
      const lx = bx + barWidth / 2;
      const ly = plotY + plotH + 6;
      doc.save();
      doc.rotate(-45, { origin: [lx, ly] });
      doc.fontSize(5.5).fillColor('#374151').font('Helvetica');
      doc.text(displayLabel, lx, ly, { lineBreak: false });
      doc.restore();
    } else {
      doc.fontSize(6).fillColor('#374151').font('Helvetica');
      doc.text(displayLabel, bx - 10, plotY + plotH + 4, { width: barWidth + 20, align: 'center' });
    }
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
// HORIZONTAL BAR CHART (for many-category data)
// ============================================================
function drawHorizontalBarChart(doc, x, y, chartWidth, data, options = {}) {
  if (!data || data.length === 0) return;

  const labelWidth = options.labelWidth || 120;
  const valueMargin = 28;
  const marginTop = options.title ? 18 : 5;
  const marginBottom = 8;
  const barH = options.barHeight || 14;
  const barGap = 5;
  const plotX = x + labelWidth;
  const plotW = chartWidth - labelWidth - valueMargin;
  const totalH = marginTop + data.length * (barH + barGap) - barGap + marginBottom;
  const plotY = y + marginTop;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  doc.save();

  // Y axis line
  doc.moveTo(plotX, plotY).lineTo(plotX, plotY + totalH - marginTop - marginBottom)
    .strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // X grid lines + ticks
  const xTicks = 4;
  for (let i = 1; i <= xTicks; i++) {
    const tx = plotX + (i / xTicks) * plotW;
    const tv = Math.round((i / xTicks) * maxVal);
    doc.moveTo(tx, plotY).lineTo(tx, plotY + totalH - marginTop - marginBottom)
      .strokeColor('#E5E7EB').lineWidth(0.3).stroke();
    doc.fontSize(5.5).fillColor('#6B7280').font('Helvetica');
    doc.text(String(tv), tx - 10, plotY + totalH - marginTop - marginBottom + 2, { width: 20, align: 'center' });
  }

  data.forEach((d, i) => {
    const by = plotY + i * (barH + barGap);
    const barW = maxVal > 0 ? (d.value / maxVal) * plotW : 0;

    // Label on left
    const maxChars = 22;
    const displayLabel = d.label.length > maxChars ? d.label.substring(0, maxChars - 1) + '…' : d.label;
    doc.fontSize(6).fillColor('#374151').font('Helvetica');
    doc.text(displayLabel, x, by + (barH - 6) / 2, { width: labelWidth - 4, align: 'right' });

    // Bar with 3D effect
    if (barW > 0) {
      const depth = 3;
      doc.path(`M ${plotX} ${by} L ${plotX + depth} ${by - depth} L ${plotX + depth + barW} ${by - depth} L ${plotX + barW} ${by} Z`)
        .fillColor(lightenColor(d.color, 1.15)).fill();
      doc.path(`M ${plotX + barW} ${by} L ${plotX + depth + barW} ${by - depth} L ${plotX + depth + barW} ${by - depth + barH} L ${plotX + barW} ${by + barH} Z`)
        .fillColor(darkenColor(d.color, 0.7)).fill();
      doc.rect(plotX, by, barW, barH).fillColor(d.color).fill();
    }

    // Value label
    if (options.showValues !== false) {
      doc.fontSize(6.5).fillColor('#1F2937').font('Helvetica-Bold');
      doc.text(String(d.value), plotX + barW + 3, by + (barH - 7) / 2, { width: valueMargin - 3 });
    }
  });

  doc.restore();

  if (options.title) {
    doc.save();
    doc.fontSize(9).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text(options.title, x, y - 2, { width: chartWidth, align: 'center' });
    doc.restore();
  }

  doc.x = x;
  doc.y = y + totalH;
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

// ============================================================
// DONUT CHART
// ============================================================
function drawDonutChart(doc, cx, cy, outerRadius, innerRadius, data, options = {}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;
  const nonZero = data.filter(d => d.value > 0);
  let startAngle = -Math.PI / 2;

  nonZero.forEach(slice => {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const midR = (outerRadius + innerRadius) / 2;

    if (nonZero.length === 1) {
      doc.save();
      doc.circle(cx, cy, outerRadius).fillColor(slice.color).fill();
      doc.circle(cx, cy, innerRadius).fillColor('#FFFFFF').fill();
      doc.restore();
    } else {
      // Outer arc points
      const ox1 = cx + outerRadius * Math.cos(startAngle);
      const oy1 = cy + outerRadius * Math.sin(startAngle);
      const ox2 = cx + outerRadius * Math.cos(endAngle);
      const oy2 = cy + outerRadius * Math.sin(endAngle);
      // Inner arc points (reverse direction)
      const ix1 = cx + innerRadius * Math.cos(endAngle);
      const iy1 = cy + innerRadius * Math.sin(endAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      doc.save();
      doc.path(
        `M ${ox1} ${oy1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${ox2} ${oy2}` +
        ` L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
      ).fillColor(slice.color).fill();
      doc.restore();
    }

    // Label inside arc
    if (options.showPercentages !== false && sliceAngle > 0.4) {
      const midAngle = startAngle + sliceAngle / 2;
      const lx = cx + midR * Math.cos(midAngle);
      const ly = cy + midR * Math.sin(midAngle);
      const count = slice.value;
      const pct = ((count / total) * 100).toFixed(0);
      doc.save();
      doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text(`${count} (${pct}%)`, lx - 25, ly - 5, { width: 50, align: 'center' });
      doc.restore();
    }
    startAngle = endAngle;
  });

  // Legend below
  if (options.showLegend !== false) {
    let lx = cx - outerRadius;
    const legendY = cy + outerRadius + 10;
    data.forEach(slice => {
      if (slice.value === 0) return;
      doc.save();
      doc.rect(lx, legendY, 8, 8).fillColor(slice.color).fill();
      doc.fontSize(7).fillColor('#374151').font('Helvetica');
      doc.text(slice.label, lx + 10, legendY, { width: 80 });
      doc.restore();
      lx += 90;
    });
  }

  if (options.title) {
    doc.save();
    doc.fontSize(9).fillColor('#4B5563').font('Helvetica-Bold');
    doc.text(options.title, cx - outerRadius - 10, cy - outerRadius - 18, {
      width: (outerRadius + 10) * 2, align: 'center'
    });
    doc.restore();
  }
}

// ============================================================
// SEMICIRCLE GAUGE
// ============================================================
function drawSemicircleGauge(doc, cx, cy, radius, value, options = {}) {
  const bgColor = options.bgColor || '#E5E7EB';
  const fillColor = options.fillColor || '#0D9488';
  const fillPct = options.fillPercent || 0.75;

  // Background semicircle (top half)
  const segments = 50;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  // Draw background arc
  for (let i = 0; i < segments; i++) {
    const a1 = startAngle + (i / segments) * Math.PI;
    const a2 = startAngle + ((i + 1) / segments) * Math.PI;
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);
    doc.save();
    doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`)
      .fillColor(bgColor).fill();
    doc.restore();
  }

  // Filled portion
  const fillEnd = startAngle + fillPct * Math.PI;
  for (let i = 0; i < Math.floor(segments * fillPct); i++) {
    const a1 = startAngle + (i / segments) * Math.PI;
    const a2 = Math.min(startAngle + ((i + 1) / segments) * Math.PI, fillEnd);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);
    doc.save();
    doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`)
      .fillColor(fillColor).fill();
    doc.restore();
  }

  // Inner white circle to create donut effect
  doc.save();
  doc.circle(cx, cy, radius * 0.65).fillColor('#FFFFFF').fill();
  doc.restore();

  // Number in center
  doc.save();
  doc.fontSize(18).fillColor('#1F2937').font('Helvetica-Bold');
  doc.text(String(value), cx - 40, cy - 18, { width: 80, align: 'center' });
  doc.restore();

  // Label below
  if (options.label) {
    doc.save();
    doc.fontSize(7).fillColor('#6B7280').font('Helvetica');
    doc.text(options.label, cx - 50, cy + 5, { width: 100, align: 'center' });
    doc.restore();
  }
}

// ============================================================
// SIMPLE RISK BARS (5 bars: muy_alto → sin_riesgo)
// ============================================================
function drawSimpleRiskBars(doc, x, y, width, height, riskCounts, total, options = {}) {
  if (total === 0) return;
  const margin = { left: 25, right: 5, top: 5, bottom: 35 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const plotX = x + margin.left;
  const plotY = y + margin.top;

  // Order: muy_alto, alto, medio, bajo, sin_riesgo (left to right, like reference)
  const order = ['riesgo_muy_alto', 'riesgo_alto', 'riesgo_medio', 'riesgo_bajo', 'sin_riesgo'];
  const shortLabels = ['muy alto', 'alto', 'medio', 'bajo', 'sin riesgo'];
  const colors = order.map(k => RISK_COLORS[k]);
  const pcts = order.map(k => total > 0 ? ((riskCounts[k] || 0) / total * 100) : 0);
  const maxPct = Math.max(...pcts, 10);
  const yMax = Math.ceil(maxPct / 10) * 10;

  doc.save();
  // Y axis
  doc.moveTo(plotX, plotY).lineTo(plotX, plotY + plotH).strokeColor('#9CA3AF').lineWidth(0.5).stroke();
  // Y ticks
  for (let i = 0; i <= 5; i++) {
    const tickY = plotY + plotH - (i / 5) * plotH;
    const tickVal = Math.round((i / 5) * yMax);
    doc.fontSize(6).fillColor('#6B7280').font('Helvetica');
    doc.text(tickVal + '%', x, tickY - 4, { width: margin.left - 4, align: 'right' });
    if (i > 0) {
      doc.moveTo(plotX, tickY).lineTo(plotX + plotW, tickY).strokeColor('#E5E7EB').lineWidth(0.3).stroke();
    }
  }
  // X axis
  doc.moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH).strokeColor('#9CA3AF').lineWidth(0.5).stroke();

  // Bars
  const barGap = 6;
  const barWidth = Math.min((plotW - barGap * 6) / 5, 35);
  const totalBW = 5 * barWidth + 4 * barGap;
  const startBX = plotX + (plotW - totalBW) / 2;

  order.forEach((_, i) => {
    const bx = startBX + i * (barWidth + barGap);
    const barH = yMax > 0 ? (pcts[i] / yMax) * plotH : 0;
    const by = plotY + plotH - barH;
    const depth = 3;

    // 3D effect
    if (barH > 0) {
      doc.path(`M ${bx + barWidth} ${by} L ${bx + barWidth + depth} ${by - depth} L ${bx + barWidth + depth} ${by - depth + barH} L ${bx + barWidth} ${by + barH} Z`)
        .fillColor(darkenColor(colors[i], 0.7)).fill();
      doc.path(`M ${bx} ${by} L ${bx + depth} ${by - depth} L ${bx + barWidth + depth} ${by - depth} L ${bx + barWidth} ${by} Z`)
        .fillColor(lightenColor(colors[i], 1.15)).fill();
      doc.rect(bx, by, barWidth, barH).fillColor(colors[i]).fill();
    }

    // Pct on top
    doc.fontSize(7).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text(pcts[i].toFixed(0) + '%', bx - 5, by - 10, { width: barWidth + 10, align: 'center' });
    // Label
    doc.fontSize(5.5).fillColor('#374151').font('Helvetica');
    doc.text(shortLabels[i], bx - 5, plotY + plotH + 3, { width: barWidth + 10, align: 'center' });
  });
  doc.restore();

  if (options.title) {
    doc.save();
    doc.fontSize(7).fillColor('#1F2937').font('Helvetica-Bold');
    doc.text(options.title, x, y - 12, { width, align: 'center' });
    doc.restore();
  }
}

// ============================================================
// COLOR-CODED RISK TABLE (like reference informe)
// ============================================================
function drawColorCodedRiskTable(doc, x, startY, tableWidth, data, options = {}) {
  const fontSize = options.fontSize || 7;
  const cellPad = 3;
  const rowH = options.rowHeight || 16;
  const headerBg = options.headerBg || '#0D9488';
  const headerText = '#FFFFFF';
  const domainBg = options.domainBg || '#1F6F6A';
  const borderColor = '#B0BEC5';

  // Columns: Dominio | sin_riesgo | bajo | medio | alto | muy_alto | Total
  const colWidths = [0.34, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11];
  const colLabels = ['Dominio', 'sin riesgo', 'bajo', 'medio', 'alto', 'muy alto', 'Total'];

  function drawHeader(atY) {
    doc.save();
    doc.rect(x, atY, tableWidth, rowH + 2).fillColor(headerBg).fill();
    doc.rect(x, atY, tableWidth, rowH + 2).strokeColor(borderColor).lineWidth(0.5).stroke();
    let colX = x;
    colLabels.forEach((label, ci) => {
      const colW = colWidths[ci] * tableWidth;
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(headerText);
      doc.text(label, colX + cellPad, atY + cellPad, { width: colW - cellPad * 2, align: ci === 0 ? 'left' : 'center' });
      colX += colW;
    });
    doc.restore();
    return atY + rowH + 2;
  }

  let currentY = drawHeader(startY);

  // Title row if provided
  if (options.tableTitle) {
    doc.save();
    doc.fontSize(10).fillColor('#0D9488').font('Helvetica-Bold');
    doc.text(options.tableTitle, x, startY - 18, { width: tableWidth, align: 'center' });
    doc.restore();
  }

  data.forEach(row => {
    // Page break check
    if (currentY + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      currentY = doc.page.margins.top;
      currentY = drawHeader(currentY);
    }

    if (row.isDomain) {
      // Domain header row
      doc.save();
      doc.rect(x, currentY, tableWidth, rowH).fillColor(domainBg).fill();
      doc.rect(x, currentY, tableWidth, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(row.label, x + cellPad, currentY + cellPad, { width: tableWidth - cellPad * 2 });
      doc.restore();
      currentY += rowH;
    } else {
      // Dimension data row
      const total = (row.sin_riesgo || 0) + (row.riesgo_bajo || 0) + (row.riesgo_medio || 0) + (row.riesgo_alto || 0) + (row.riesgo_muy_alto || 0);
      const pcts = total > 0 ? {
        sin_riesgo: (row.sin_riesgo / total * 100),
        riesgo_bajo: (row.riesgo_bajo / total * 100),
        riesgo_medio: (row.riesgo_medio / total * 100),
        riesgo_alto: (row.riesgo_alto / total * 100),
        riesgo_muy_alto: (row.riesgo_muy_alto / total * 100)
      } : { sin_riesgo: 0, riesgo_bajo: 0, riesgo_medio: 0, riesgo_alto: 0, riesgo_muy_alto: 0 };

      const lowSum = pcts.sin_riesgo + pcts.riesgo_bajo;
      const highSum = pcts.riesgo_alto + pcts.riesgo_muy_alto;

      // Background: white default
      doc.save();
      doc.rect(x, currentY, tableWidth, rowH).fillColor('#FFFFFF').fill();

      // Cell backgrounds based on thresholds
      const riskKeys = ['sin_riesgo', 'riesgo_bajo', 'riesgo_medio', 'riesgo_alto', 'riesgo_muy_alto'];
      let colX = x + colWidths[0] * tableWidth;

      riskKeys.forEach((key, ki) => {
        const colW = colWidths[ki + 1] * tableWidth;
        let cellBg = '#FFFFFF';
        if (key === 'sin_riesgo' || key === 'riesgo_bajo') {
          if (lowSum >= 60) cellBg = '#C6EFCE'; // green
        }
        if (key === 'riesgo_alto' || key === 'riesgo_muy_alto') {
          if (highSum >= 40) cellBg = '#FFC7CE'; // red
        }
        if (cellBg !== '#FFFFFF') {
          doc.rect(colX, currentY, colW, rowH).fillColor(cellBg).fill();
        }
        colX += colW;
      });

      // Border
      doc.rect(x, currentY, tableWidth, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();

      // Cell text
      colX = x;
      // Name column
      doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
      doc.text(row.label || '', colX + cellPad, currentY + cellPad, { width: colWidths[0] * tableWidth - cellPad * 2 });
      colX += colWidths[0] * tableWidth;

      // Data columns
      const values = [pcts.sin_riesgo, pcts.riesgo_bajo, pcts.riesgo_medio, pcts.riesgo_alto, pcts.riesgo_muy_alto, 100];
      values.forEach((val, vi) => {
        const colW = colWidths[vi + 1] * tableWidth;
        doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
        const txt = vi < 5 ? val.toFixed(1) + ' %' : '100,0 %';
        doc.text(txt, colX + cellPad, currentY + cellPad, { width: colW - cellPad * 2, align: 'center' });
        colX += colW;
      });

      doc.restore();
      currentY += rowH;
    }
  });

  doc.x = x;
  doc.y = currentY;
  return currentY;
}

// ============================================================
// RISK PRIORITIZATION MATRIX
// ============================================================
function drawRiskPrioritizationMatrix(doc, x, startY, tableWidth, data, options = {}) {
  const fontSize = options.fontSize || 7;
  const cellPad = 3;
  const rowH = 16;
  const headerBg = '#0D9488';
  const borderColor = '#B0BEC5';

  const colWidths = [0.38, 0.15, 0.17, 0.15, 0.15];
  const colLabels = ['Dominio', 'Magnitud', 'Indice Asociacion', 'Estres', 'Intra'];

  function drawHeader(atY) {
    doc.save();
    doc.rect(x, atY, tableWidth, rowH + 2).fillColor(headerBg).fill();
    doc.rect(x, atY, tableWidth, rowH + 2).strokeColor(borderColor).lineWidth(0.5).stroke();
    let colX = x;
    colLabels.forEach((label, ci) => {
      const colW = colWidths[ci] * tableWidth;
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(label, colX + cellPad, atY + cellPad, { width: colW - cellPad * 2, align: ci === 0 ? 'left' : 'center' });
      colX += colW;
    });
    doc.restore();
    return atY + rowH + 2;
  }

  let currentY = drawHeader(startY);

  data.forEach(row => {
    if (currentY + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      currentY = doc.page.margins.top;
      currentY = drawHeader(currentY);
    }

    if (row.isDomain) {
      // Domain header
      doc.save();
      doc.rect(x, currentY, tableWidth, rowH).fillColor('#E8F5E9').fill();
      doc.rect(x, currentY, tableWidth, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#1B5E20');
      doc.text(row.label, x + cellPad, currentY + cellPad, { width: tableWidth - cellPad * 2 });
      doc.restore();
      currentY += rowH;
    } else {
      doc.save();
      doc.rect(x, currentY, tableWidth, rowH).fillColor('#FFFFFF').fill();

      // Magnitud cell color
      const magCol = x + colWidths[0] * tableWidth;
      const magW = colWidths[1] * tableWidth;
      let magBg = '#C6EFCE'; // green < 40%
      if (row.magnitud >= 60) magBg = '#FFC7CE'; // red
      else if (row.magnitud >= 40) magBg = '#FFEB9C'; // yellow
      doc.rect(magCol, currentY, magW, rowH).fillColor(magBg).fill();

      doc.rect(x, currentY, tableWidth, rowH).strokeColor(borderColor).lineWidth(0.3).stroke();

      // Cell text
      let colX = x;
      doc.fontSize(fontSize).font('Helvetica').fillColor('#374151');
      doc.text(row.label, colX + cellPad, currentY + cellPad, { width: colWidths[0] * tableWidth - cellPad * 2 });
      colX += colWidths[0] * tableWidth;

      doc.text(row.magnitud.toFixed(0) + ' %', colX + cellPad, currentY + cellPad, { width: colWidths[1] * tableWidth - cellPad * 2, align: 'center' });
      colX += colWidths[1] * tableWidth;

      doc.text(row.indiceAsociacion.toFixed(1), colX + cellPad, currentY + cellPad, { width: colWidths[2] * tableWidth - cellPad * 2, align: 'center' });
      colX += colWidths[2] * tableWidth;

      doc.text(String(row.estres), colX + cellPad, currentY + cellPad, { width: colWidths[3] * tableWidth - cellPad * 2, align: 'center' });
      colX += colWidths[3] * tableWidth;

      doc.text(String(row.intra), colX + cellPad, currentY + cellPad, { width: colWidths[4] * tableWidth - cellPad * 2, align: 'center' });
      doc.restore();
      currentY += rowH;
    }
  });

  doc.x = x;
  doc.y = currentY;
  return currentY;
}

// ============================================================
// SECTION HEADER BANNER (turquoise banner like reference)
// ============================================================
function drawSectionBanner(doc, x, y, width, text, options = {}) {
  const h = options.height || 30;
  const bgColor = options.bgColor || '#0D9488';
  doc.save();
  doc.rect(x, y, width, h).fillColor(bgColor).fill();
  doc.fontSize(options.fontSize || 12).fillColor('#FFFFFF').font('Helvetica-Bold');
  doc.text(text, x, y + (h - 14) / 2, { width, align: 'center' });
  doc.restore();
  return y + h;
}

module.exports = {
  drawPieChart,
  drawBarChart,
  drawHorizontalBarChart,
  drawGroupedBarChart,
  drawTable,
  createRiskSeries,
  drawDonutChart,
  drawSemicircleGauge,
  drawSimpleRiskBars,
  drawColorCodedRiskTable,
  drawRiskPrioritizationMatrix,
  drawSectionBanner,
  darkenColor,
  lightenColor,
  RISK_COLORS,
  RISK_ORDER,
  RISK_LABELS
};
