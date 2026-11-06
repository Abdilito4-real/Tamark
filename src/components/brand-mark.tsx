import Image from "next/image";

export function BrandMark() {
  return (
    <Image
      className="brand-icon"
      src="/solar-leaf-energy-emblem.png"
      alt=""
      width={40}
      height={40}
      aria-hidden="true"
      priority
    />
  );
}
