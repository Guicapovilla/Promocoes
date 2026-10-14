"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { pickProduct } from "@/lib/recent";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { slug: string; productId: string; price: number };

/** Link que torna o produto o destaque da home, registra em "Visto por último" e rola ao topo. */
export function PickLink({ slug, productId, price, onClick, ...rest }: Props) {
  return (
    <Link
      {...rest}
      href={`/?p=${slug}`}
      scroll={false}
      onClick={(e) => {
        onClick?.(e);
        pickProduct(productId, price);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}
