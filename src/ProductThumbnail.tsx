import { useEffect, useState } from "react";
import { getProductImage, subscribeToProductImageUpdates } from "./persistence";

export default function ProductThumbnail({ productId, fallbackText, size = 30 }: { productId: string; fallbackText: string; size?: number }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const load = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      setImageUrl(null);
      void getProductImage(productId).then((entry) => {
        if (!active || !entry) return;
        objectUrl = URL.createObjectURL(entry.imageBlob);
        setImageUrl(objectUrl);
      });
    };
    load();
    const unsubscribe = subscribeToProductImageUpdates(load);
    return () => {
      active = false;
      unsubscribe();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId]);

  const style = { width: size, height: size, flexBasis: size };
  return imageUrl ? <img className="hf-thumb hf-product-thumbnail" style={style} src={imageUrl} alt="" /> : <i className="hf-thumb lavender" style={style}>{fallbackText.slice(0, 1)}</i>;
}
