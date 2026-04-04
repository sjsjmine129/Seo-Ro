import AnimatedLogo from "@/components/AnimatedLogo";

export default function Loading() {
	return (
		<div className="flex min-h-[80vh] w-full items-center justify-center bg-background px-4">
			<AnimatedLogo className="h-24 w-24" />
		</div>
	);
}
