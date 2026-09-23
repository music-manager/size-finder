import { products as seedProducts } from './products';
import type { Product } from './types';

interface DbProductRow {
  id: string;
  name: string;
  category: Product['category'];
  brand: string;
  width_cm: number | string;
  depth_cm: number | string;
  height_cm: number | string;
  capacity_or_spec: string;
  image_url: string;
  coupang_url: string;
  tags: string[];
  verified: boolean;
  price: number | string | null;
  price_checked_at: string | null;
  product_id: number | string | null;
}

function rowToProduct(row: DbProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    dimensions: {
      width: Number(row.width_cm),
      depth: Number(row.depth_cm),
      height: Number(row.height_cm),
    },
    capacity_or_spec: row.capacity_or_spec,
    imageUrl: row.image_url,
    coupangUrl: row.coupang_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    verified: row.verified,
    ...(row.price !== null ? { price: Number(row.price) } : {}),
    ...(row.price_checked_at ? { priceCheckedAt: row.price_checked_at } : {}),
    ...(row.product_id !== null ? { productId: Number(row.product_id) } : {}),
  };
}

/**
 * 정적 seed를 안전한 fallback으로 유지하면서 DB 등록분을 같은 id 기준으로 덮어쓴다.
 * DB 장애 시 사이트 전체가 비는 대신 seed 목록으로 fail-soft 한다.
 */
export async function getLiveProducts(): Promise<Product[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return seedProducts;

  try {
    const response = await fetch(
      `${url}/rest/v1/cmpick_products?select=id,name,category,brand,width_cm,depth_cm,height_cm,capacity_or_spec,image_url,coupang_url,tags,verified,price,price_checked_at,product_id&active=eq.true&order=created_at.asc`,
      {
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!response.ok) return seedProducts;

    const rows = (await response.json()) as DbProductRow[];
    const merged = new Map(seedProducts.map((product) => [product.id, product]));
    for (const row of rows) merged.set(row.id, rowToProduct(row));
    return Array.from(merged.values());
  } catch {
    return seedProducts;
  }
}

export async function getLiveProductById(id: string): Promise<Product | undefined> {
  const products = await getLiveProducts();
  return products.find((product) => product.id === id);
}
