import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
const { generateBadgeSvg, writeBadge } = require('../src/badge');

describe('generateBadgeSvg', () => {
  it('generates SVG for gold tier', () => {
    const svg = generateBadgeSvg({
      trusted: true,
      score: 87,
      tier: 'gold',
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('AgentStamp');
    expect(svg).toContain('gold | 87');
    expect(svg).toContain('#FFD700');
  });

  it('generates SVG for untrusted agent', () => {
    const svg = generateBadgeSvg({
      trusted: false,
      score: 0,
      tier: 'none',
    });
    expect(svg).toContain('Unverified');
    expect(svg).toContain('#9E9E9E');
  });

  it('generates SVG for bronze tier', () => {
    const svg = generateBadgeSvg({
      trusted: true,
      score: 25,
      tier: 'bronze',
    });
    expect(svg).toContain('bronze | 25');
    expect(svg).toContain('#CD7F32');
  });

  it('generates valid XML structure', () => {
    const svg = generateBadgeSvg({
      trusted: true,
      score: 50,
      tier: 'silver',
    });
    expect(svg).toMatch(/^<svg.*<\/svg>$/s);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<title>');
  });
});

describe('writeBadge', () => {
  it('writes SVG file and creates directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badge-test-'));
    const filePath = path.join(tmpDir, 'nested', 'dir', 'badge.svg');
    const svg = '<svg>test</svg>';

    const result = writeBadge(svg, filePath);

    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result, 'utf-8')).toBe(svg);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });
});
