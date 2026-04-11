"use client";

export function PlayerAvatar({
  name,
  photoDataUrl,
  size = "md",
}: {
  name: string;
  photoDataUrl?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClassName =
    size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,208,101,0.18)] bg-[linear-gradient(180deg,rgba(255,213,78,0.2),rgba(200,136,7,0.2))] text-[rgba(255,236,184,0.96)] ${sizeClassName}`}
    >
      {photoDataUrl ? (
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${photoDataUrl})` }}
        />
      ) : (
        <span className="font-semibold tracking-[0.08em]">{initials || "PJ"}</span>
      )}
    </div>
  );
}
