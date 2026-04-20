"use client";

import Image from "next/image";

export function SHPLNavIcon({
  src,
  fallback,
  size = "md",
}: {
  src?: string;
  fallback: string;
  size?: "sm" | "md";
}) {
  const wrapperClassName =
    size === "sm"
      ? "inline-flex h-6 w-6 items-center justify-center"
      : "inline-flex h-5 w-5 items-center justify-center";

  const iconSize = size === "sm" ? 20 : 18;

  return (
    <span className={wrapperClassName}>
      {src ? (
        <Image
          alt=""
          aria-hidden="true"
          className="h-auto w-auto object-contain brightness-0 invert"
          height={iconSize}
          src={src}
          width={iconSize}
        />
      ) : (
        <span className="text-sm font-black uppercase tracking-[0.08em] text-[rgba(255,236,184,0.96)]">
          {fallback}
        </span>
      )}
    </span>
  );
}
