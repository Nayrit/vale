import Image from "next/image";
import Link from "next/link";

const SRC = "/vale-logo.png";
const WIDTH = 1024;
const HEIGHT = 558;

const sizes = {
  sm: 112,
  md: 168,
  lg: 280,
};

export function Logo({
  size = "md",
  href = "/",
  className = "",
  priority = false,
}: {
  size?: keyof typeof sizes;
  href?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const width = sizes[size];
  const image = (
    <Image
      src={SRC}
      alt="Vale — your subscription steward"
      width={WIDTH}
      height={HEIGHT}
      priority={priority}
      className="h-auto"
      style={{ width, height: "auto" }}
    />
  );

  if (!href) {
    return <span className={`inline-block ${className}`}>{image}</span>;
  }

  return (
    <Link href={href} className={`inline-block ${className}`} aria-label="Vale home">
      {image}
    </Link>
  );
}
