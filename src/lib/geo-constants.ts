export interface GeoCountry {
  code: string;
  name: string;
}

export const LATAM_COUNTRIES: GeoCountry[] = [
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" },
  { code: "EC", name: "Ecuador" },
  { code: "VE", name: "Venezuela" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "BO", name: "Bolivia" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panama" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "SV", name: "El Salvador" },
  { code: "NI", name: "Nicaragua" },
  { code: "DO", name: "Dominican Republic" },
  { code: "CU", name: "Cuba" },
  { code: "HT", name: "Haiti" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "GY", name: "Guyana" },
  { code: "SR", name: "Suriname" },
  { code: "BZ", name: "Belize" },
  { code: "PR", name: "Puerto Rico" },
  { code: "GF", name: "French Guiana" },
];

export const LATAM_CODES = LATAM_COUNTRIES.map((c) => c.code);

export const TIER1_CODES = ["US", "UK", "CA", "AU"];

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  UK: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  GLOBAL: "Worldwide / Global",
  ...Object.fromEntries(LATAM_COUNTRIES.map((c) => [c.code, c.name])),
  // Case-insensitive mapping for full names as well
  ...Object.fromEntries(LATAM_COUNTRIES.map((c) => [c.name.toUpperCase(), c.name])),
};

export function getGeoDisplayName(code: string): string {
  const upper = code.toUpperCase();
  const name = COUNTRY_NAMES[upper];
  if (!name) return code;
  if (name.toUpperCase() === upper) return name;
  return `${code} — ${name}`;
}

export function getCountryFlag(countryCode: string): string {
  if (!countryCode) return "🌐";
  const upper = countryCode.toUpperCase();
  if (upper === "GLOBAL") return "🌐";
  const code = upper === "UK" ? "GB" : upper;
  if (code.length !== 2) return "🌐";
  try {
    const codePoints = code
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

