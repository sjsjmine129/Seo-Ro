import Image from "next/image";
import type { HTMLAttributes } from "react";

type LogoProps = {
	className?: string;
	/** When true, preloads the image (use for above-the-fold logos). */
	priority?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

/**
 * Seo-Ro app logo — raster mark from `/logo.png` (transparent background).
 */
export default function Logo({
	className = "h-10 w-10",
	priority = false,
	...rest
}: LogoProps) {
	return (
		<div className={`relative shrink-0 ${className}`} {...rest}>
			<Image
				src="/logo.png"
				alt="Seo-Ro Logo"
				fill
				sizes="(max-width: 768px) 128px, 160px"
				className="object-contain"
				priority={priority}
			/>
		</div>
	);
}
