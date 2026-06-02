import { seasonalPalettes } from '@/data/seasonalPalettes';
import { ColorTypeName, getPalettesForColorType } from '@/data/colorTypeRules';

export const colorTypeNamesMap: Record<string, ColorTypeName> = {
  'SOFT WINTER': 'SOFT_WINTER',
  'BRIGHT WINTER': 'BRIGHT_WINTER',
  'VIVID WINTER': 'VIVID_WINTER',
  'SOFT SUMMER': 'SOFT_SUMMER',
  'DUSTY SUMMER': 'DUSTY_SUMMER',
  'VIVID SUMMER': 'VIVID_SUMMER',
  'GENTLE AUTUMN': 'GENTLE_AUTUMN',
  'FIERY AUTUMN': 'FIERY_AUTUMN',
  'VIVID AUTUMN': 'VIVID_AUTUMN',
  'GENTLE SPRING': 'GENTLE_SPRING',
  'BRIGHT SPRING': 'BRIGHT_SPRING',
  'VIBRANT SPRING': 'VIBRANT_SPRING',
};

export interface PaletteColor {
  name: string;
  hex: string;
  paletteNum: number;
}

export function getColorsForColorTypeKey(colorTypeKey: ColorTypeName): PaletteColor[] {
  const paletteInfo = getPalettesForColorType(colorTypeKey);
  const seasonPalettes = seasonalPalettes[paletteInfo.season];

  const colors: PaletteColor[] = [];
  Object.entries(seasonPalettes.palette1).forEach(([name, hex]) => {
    colors.push({ name, hex, paletteNum: 1 });
  });
  Object.entries(seasonPalettes.palette2).forEach(([name, hex]) => {
    colors.push({ name, hex, paletteNum: 2 });
  });
  Object.entries(seasonPalettes.palette3).forEach(([name, hex]) => {
    colors.push({ name, hex, paletteNum: 3 });
  });
  return colors;
}

export function getColorsForColorTypeName(colorTypeName: string): PaletteColor[] {
  const colorTypeKey = colorTypeNamesMap[colorTypeName];
  if (!colorTypeKey) return [];
  return getColorsForColorTypeKey(colorTypeKey);
}

export function normalizeHex(hex: string): string {
  let h = hex.trim().toLowerCase();
  if (h.length === 9 && h.endsWith('ff')) {
    h = h.slice(0, 7);
  }
  return h;
}
