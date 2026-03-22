const fs = require('fs');
const path = require('path');
const { TIER_COLORS } = require('./constants');

/**
 * Generate a shields.io-style SVG badge for trust status.
 * @param {object} trustData - Trust check API response
 * @returns {string} SVG string
 */
function generateBadgeSvg(trustData) {
  const label = 'AgentStamp';
  const tier = trustData.tier || 'none';
  const score = trustData.score ?? 0;
  const isTrusted = trustData.trusted;

  const value = isTrusted ? `${tier} | ${score}` : 'Unverified';
  const color = isTrusted ? (TIER_COLORS[tier] || TIER_COLORS.none) : TIER_COLORS.none;

  // Character width estimation (monospace ~7px per char at 11px font)
  const charWidth = 6.5;
  const padding = 10;
  const labelWidth = Math.ceil(label.length * charWidth) + padding * 2;
  const valueWidth = Math.ceil(value.length * charWidth) + padding * 2;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

/**
 * Write badge SVG to a file path, creating directories as needed.
 * @param {string} svgContent - SVG string
 * @param {string} filePath - Output file path
 * @returns {string} Absolute path to the written file
 */
function writeBadge(svgContent, filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, svgContent, 'utf-8');
  return path.resolve(filePath);
}

module.exports = { generateBadgeSvg, writeBadge };
