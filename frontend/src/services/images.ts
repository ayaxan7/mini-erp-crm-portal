import { useEffect, useState } from 'react';
import { api } from './api';
import type { Product } from '../types/domain';

interface ImageUrlResult {
  url: string | null;
  expiresIn: number;
}

const cache = new Map<string, { url: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<string | null>>();

export async function resolveProductImage(productId: number, imageKey: string): Promise<string | null> {
  const cacheKey = `${productId}:${imageKey}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt - 60_000 > now) return cached.url;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const task = (async () => {
    try {
      const res = await api.get<ImageUrlResult>(`/products/${productId}/image-url`);
      const data = res.data;
      const url = data?.url ?? null;
      if (url && data) {
        cache.set(cacheKey, { url, expiresAt: now + (data.expiresIn ?? 900) * 1000 });
      } else {
        cache.delete(cacheKey);
      }
      return url;
    } catch {
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, task);
  return task;
}

export function useProductImageUrl(product: Product | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!product?.image_key) {
      setUrl(null);
      return;
    }
    resolveProductImage(product.id, product.image_key).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.image_key]);

  return url;
}
