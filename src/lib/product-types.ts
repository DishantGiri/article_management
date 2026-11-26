export const ALLOWED_PRODUCT_TYPES = ["Ecom", "Nutra"] as const;

export type AllowedProductType = (typeof ALLOWED_PRODUCT_TYPES)[number];

/**
 * Normalizes any product type input strictly into one of the two supported
 * Product Types: "Ecom" or "Nutra". Returns null for niche categories
 * (e.g. "Skin Care", "Supplements", "Liver Health") or legacy values ("Multi-Lang").
 */
export function normalizeProductTypeName(raw?: string | null): AllowedProductType | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!cleaned) return null;

  if (
    cleaned === "ecom" ||
    cleaned === "ecomm" ||
    cleaned === "ecommerce" ||
    cleaned === "ecomproduct" ||
    cleaned === "ecomproducts"
  ) {
    return "Ecom";
  }

  if (
    cleaned === "nutra" ||
    cleaned === "nutraceutical" ||
    cleaned === "nutraceuticals" ||
    cleaned === "nutraproduct" ||
    cleaned === "nutraproducts"
  ) {
    return "Nutra";
  }

  return null;
}

export function isAllowedProductTypeName(raw?: string | null): boolean {
  return normalizeProductTypeName(raw) !== null;
}

function cleanText(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim().replace(/\s+/g, " ");
  return trimmed || null;
}

function isLegacyOrTypeLabel(val: string): boolean {
  return Boolean(normalizeProductTypeName(val)) || /^multi[-\s_]*lang$/i.test(val.trim());
}

/**
 * Resolves spreadsheet Type / Category / Product Category columns so that:
 * - Product Type (`Category` model) is ALWAYS "Ecom" or "Nutra" (defaults to "Nutra").
 * - Any other classification (e.g. "Skin Care", "Supplements", "Liver Health")
 *   is stored as Product Category (`productCategory` / `ProductCategory` model).
 */
export function resolveImportedTypeAndCategory(input: {
  rawType?: string | null;
  rawCategoryCol?: string | null;
  rawProductCategoryCol?: string | null;
}): {
  productType: AllowedProductType;
  explicitProductType: AllowedProductType | null;
  productCategory: string | null;
} {
  const cleanType = cleanText(input.rawType);
  const cleanCatCol = cleanText(input.rawCategoryCol);
  const cleanProdCatCol = cleanText(input.rawProductCategoryCol);

  const explicitProductType =
    normalizeProductTypeName(cleanType) ||
    normalizeProductTypeName(cleanCatCol) ||
    normalizeProductTypeName(cleanProdCatCol);

  const productType: AllowedProductType = explicitProductType || "Nutra";

  let productCategory: string | null = null;
  if (cleanProdCatCol && !normalizeProductTypeName(cleanProdCatCol) && !/^multi[-\s_]*lang$/i.test(cleanProdCatCol)) {
    productCategory = cleanProdCatCol;
  } else if (cleanCatCol && !isLegacyOrTypeLabel(cleanCatCol)) {
    productCategory = cleanCatCol;
  } else if (cleanType && !isLegacyOrTypeLabel(cleanType)) {
    productCategory = cleanType;
  }

  return {
    productType,
    explicitProductType,
    productCategory,
  };
}
