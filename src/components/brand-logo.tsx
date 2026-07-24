import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

type BrandLogoVariant = "mark" | "horizontal" | "stacked" | "wordmark";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  href?: string | null;
  className?: string;
  priority?: boolean;
  /** Accessible label; defaults to TicketFly */
  label?: string;
};

const ASSETS: Record<
  BrandLogoVariant,
  { src: string; width: number; height: number; alt: string; sizes: string }
> = {
  mark: {
    src: "/brand/logo-mark-square.png",
    width: 512,
    height: 512,
    alt: "TicketFly",
    sizes: "40px",
  },
  horizontal: {
    src: "/brand/logo-horizontal.png",
    width: 900,
    height: 240,
    alt: "TicketFly",
    sizes: "(max-width: 640px) 140px, 180px",
  },
  stacked: {
    src: "/brand/logo-stacked.png",
    width: 712,
    height: 569,
    alt: "TicketFly — Voe mais alto. Viva experiências.",
    sizes: "(max-width: 640px) 160px, 200px",
  },
  wordmark: {
    src: "/brand/logo-title.png",
    width: 712,
    height: 100,
    alt: "TicketFly",
    sizes: "160px",
  },
};

const VARIANT_CLASS: Record<BrandLogoVariant, string> = {
  mark: "h-9 w-9 sm:h-10 sm:w-10",
  horizontal: "h-8 w-auto max-w-[min(100%,11.5rem)] sm:h-9 sm:max-w-[12.5rem]",
  stacked: "h-auto w-full max-w-[11rem] sm:max-w-[13rem]",
  wordmark: "h-6 w-auto sm:h-7",
};

export function BrandLogo({
  variant = "horizontal",
  href = "/",
  className,
  priority = false,
  label = "TicketFly",
}: BrandLogoProps) {
  const asset = ASSETS[variant];

  const image = (
    <Image
      alt={asset.alt}
      className={clsx("object-contain object-left", VARIANT_CLASS[variant], className)}
      height={asset.height}
      priority={priority}
      sizes={asset.sizes}
      src={asset.src}
      width={asset.width}
    />
  );

  if (href === null) {
    return (
      <span className="inline-flex shrink-0 items-center" aria-label={label}>
        {image}
      </span>
    );
  }

  return (
    <Link
      aria-label={label}
      className="inline-flex shrink-0 items-center transition-opacity duration-200 hover:opacity-90"
      href={href}
    >
      {image}
    </Link>
  );
}
