import { fontData, experimental_getFontFileURL } from "astro:assets";
import type { SatoriOptions } from "satori";
import { getFontPathByWeight } from "./getFontPathByWeight";

/** Load the Latin and Chinese fonts required by both OG image routes. */
export async function getOgFonts(url: URL): Promise<SatoriOptions["fonts"]> {
  const variants = [
    {
      cssVariable: "--font-google-sans-code",
      name: "Google Sans Code",
      weight: 400,
    },
    {
      cssVariable: "--font-google-sans-code",
      name: "Google Sans Code",
      weight: 700,
    },
    { cssVariable: "--font-noto-sans-sc", name: "Noto Sans SC", weight: 400 },
  ] as const;

  return Promise.all(
    variants.map(async ({ cssVariable, name, weight }) => {
      const path = getFontPathByWeight(fontData[cssVariable], weight);
      if (path === undefined) {
        throw new Error(`Cannot find the font path for ${name} (${weight}).`);
      }
      const response = await fetch(experimental_getFontFileURL(path, url));
      if (!response.ok) {
        throw new Error(`Cannot load ${name} (${weight}): ${response.status}.`);
      }
      return {
        name,
        weight,
        style: "normal",
        data: await response.arrayBuffer(),
      };
    })
  );
}
