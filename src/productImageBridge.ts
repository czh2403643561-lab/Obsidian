export interface ProductImageRequestProduct {
  productId: string;
  name: string;
}

export interface ProductImageRequest {
  type: "OBSIDIAN_PRODUCT_IMAGE_REQUEST";
  products: ProductImageRequestProduct[];
}

export interface ProductImageResult {
  productId: string;
  imageBlob: Blob;
  sourceUrl?: string;
}

export type ProductImageRequestResponse =
  | { type: "OBSIDIAN_PRODUCT_IMAGE_RESULT"; status: "unavailable"; results: [] }
  | { type: "OBSIDIAN_PRODUCT_IMAGE_RESULT"; status: "complete"; results: ProductImageResult[] };

interface ProductImageCollector {
  requestProductImages(request: ProductImageRequest): Promise<ProductImageRequestResponse>;
}

declare global {
  interface Window {
    OBSIDIAN_PRODUCT_IMAGE_COLLECTOR?: ProductImageCollector;
  }
}

export const isImageCollectorAvailable = (): boolean => typeof window !== "undefined" && Boolean(window.OBSIDIAN_PRODUCT_IMAGE_COLLECTOR);

export const requestProductImages = async (products: ProductImageRequestProduct[]): Promise<ProductImageRequestResponse> => {
  const collector = typeof window === "undefined" ? undefined : window.OBSIDIAN_PRODUCT_IMAGE_COLLECTOR;
  if (!collector) return { type: "OBSIDIAN_PRODUCT_IMAGE_RESULT", status: "unavailable", results: [] };
  return collector.requestProductImages({ type: "OBSIDIAN_PRODUCT_IMAGE_REQUEST", products });
};
