/**
 * The four-band resistor colour code (docs/design.md §7): two digits, a multiplier and a gold
 * tolerance band. 470 Ω reads yellow (4), violet (7), brown (×10), gold.
 */

export const BAND_COLOURS = [
  'black',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'violet',
  'grey',
  'white',
] as const;

/** A digit's colour, or as a multiplier, its power of ten; gold and silver divide by 10 and 100. */
export type BandColour = (typeof BAND_COLOURS)[number] | 'gold' | 'silver';

/**
 * The bands for a resistance, rounded to two significant figures as the code allows. A resistance
 * must be at least 0.1 Ω (silver, the smallest multiplier) and below 100 GΩ (white, the largest).
 */
export function colourBands(ohms: number): readonly [BandColour, BandColour, BandColour, 'gold'] {
  if (!Number.isFinite(ohms) || ohms < 0.1 || ohms >= 1e11) {
    throw new RangeError(`No colour code for ${ohms} Ω`);
  }
  let exponent = Math.floor(Math.log10(ohms)) - 1;
  let digits = Math.round(ohms / 10 ** exponent);
  // Rounding 99.5 up gives 100, which takes one more power of ten.
  if (digits === 100) {
    digits = 10;
    exponent += 1;
  }
  const multiplier: BandColour =
    exponent === -1 ? 'gold' : exponent === -2 ? 'silver' : BAND_COLOURS[exponent]!;
  return [BAND_COLOURS[Math.floor(digits / 10)]!, BAND_COLOURS[digits % 10]!, multiplier, 'gold'];
}
