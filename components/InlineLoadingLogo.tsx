"use client";

import AnimatedLogo from "@/components/AnimatedLogo";

type InlineLoadingLogoProps = {
	/** Logo box size (Tailwind), e.g. `w-16 h-16` */
	className?: string;
	/** Extra padding around the logo */
	paddingClassName?: string;
};

/**
 * Centered `AnimatedLogo` for modals, lists, and inline loading states.
 */
export default function InlineLoadingLogo({
	className = "h-16 w-16",
	paddingClassName = "p-8",
}: InlineLoadingLogoProps) {
	return (
		<div
			className={`flex w-full items-center justify-center ${paddingClassName}`}
		>
			<AnimatedLogo className={className} />
		</div>
	);
}
