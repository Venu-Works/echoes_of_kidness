import Image from "next/image";

// Inserts a Cloudinary transformation (resize/crop + auto format & quality)
// into an upload URL, so the browser gets a right-sized image.
function cloudinaryUrl(url: string, transform: string): string {
  return url.replace(
    "/image/upload/",
    `/image/upload/${transform},f_auto,q_auto/`
  );
}

const PLACEHOLDER_STYLES: Record<string, string> = {
  love: "from-rose-100 via-rose-50 to-pink-100",
  respect: "from-blue-100 via-sky-50 to-indigo-100",
  gratitude: "from-amber-100 via-orange-50 to-yellow-100",
  kindness: "from-emerald-100 via-green-50 to-teal-100",
};

const PLACEHOLDER_EMOJI: Record<string, string> = {
  love: "❤️",
  respect: "🤝",
  gratitude: "🙏",
  kindness: "🌱",
};

// Story illustration with a soft themed placeholder while the image is
// generating (or if generation failed).
export function StoryImage({
  imageUrl,
  theme,
  alt,
  width,
  height,
  className = "",
  priority = false,
}: {
  imageUrl?: string | null;
  theme: string[];
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  if (imageUrl) {
    return (
      <Image
        src={cloudinaryUrl(imageUrl, `w_${width},h_${height},c_fill,g_auto`)}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        priority={priority}
        className={`w-full h-auto object-cover ${className}`}
      />
    );
  }

  const primary = theme[0];
  return (
    <div
      aria-hidden
      style={{ aspectRatio: `${width} / ${height}` }}
      className={`w-full bg-gradient-to-br ${PLACEHOLDER_STYLES[primary] ?? "from-sand-light to-cream"} flex items-center justify-center ${className}`}
    >
      <span className="text-4xl opacity-40">{PLACEHOLDER_EMOJI[primary] ?? "🌸"}</span>
    </div>
  );
}
