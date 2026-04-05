"use client";

import { useState } from "react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { login, signup } from "./actions";

export default function LoginPage() {
	const [isSignup, setIsSignup] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setIsLoading(true);
		setError(null);
		const formData = new FormData(e.currentTarget);
		let redirecting = false;
		try {
			const result = isSignup
				? await signup(formData)
				: await login(formData);
			if (result?.error) {
				setError(result.error);
			}
		} catch (err) {
			if (isRedirectError(err)) {
				redirecting = true;
			} else {
				setError(
					err instanceof Error
						? err.message
						: "요청 처리 중 오류가 발생했습니다.",
				);
			}
		} finally {
			if (!redirecting) {
				setIsLoading(false);
			}
		}
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6">
			{isLoading && (
				<div
					className="fixed inset-0 z-[200] flex items-center justify-center bg-background/75 px-6 backdrop-blur-sm"
					role="status"
					aria-live="polite"
					aria-busy="true"
				>
					<div className="flex max-w-xs flex-col items-center gap-5 rounded-2xl border border-primary/25 bg-white/95 px-10 py-9 text-center shadow-xl backdrop-blur-md">
						<div className="animate-pulse">
							<AnimatedLogo className="mx-auto h-24 w-24 shrink-0 md:h-28 md:w-28" />
						</div>
						<p className="text-sm font-medium text-foreground">
							{isSignup ? "가입 처리 중..." : "로그인 중..."}
						</p>
					</div>
				</div>
			)}

			<div className="w-full max-w-sm">
				{/* Logo & Slogan */}
				<div className="mb-10 flex flex-col items-center text-center">
					<AnimatedLogo className="mx-auto mb-6 h-28 w-28 shrink-0 md:h-32 md:w-32" />
					<h1 className="text-xl font-bold leading-snug text-primary md:text-2xl">
						우리 동네 책 교환 커뮤니티, 서로
					</h1>

					<p className="mt-2 text-sm text-foreground/70">
						공공도서관에서 만나는 바꿔읽기
					</p>
				</div>

				{/* Glassmorphism Card */}
				<div className="rounded-2xl border border-primary/20 bg-white/60 p-6 shadow-md backdrop-blur-md">
					<div className="mb-4 flex gap-2">
						<button
							type="button"
							disabled={isLoading}
							onClick={() => {
								setIsSignup(false);
								setError(null);
							}}
							className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
								!isSignup
									? "bg-primary text-white"
									: "bg-white/50 text-foreground/70 hover:bg-white/70"
							}`}
						>
							로그인
						</button>
						<button
							type="button"
							disabled={isLoading}
							onClick={() => {
								setIsSignup(true);
								setError(null);
							}}
							className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
								isSignup
									? "bg-primary text-white"
									: "bg-white/50 text-foreground/70 hover:bg-white/70"
							}`}
						>
							회원가입
						</button>
					</div>

					<form
						onSubmit={handleFormSubmit}
						className="flex flex-col gap-4"
					>
						<div>
							<label
								htmlFor="email"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								이메일
							</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								disabled={isLoading}
								autoComplete="email"
								placeholder="이메일"
								className="w-full rounded-lg border border-primary/20 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</div>

						{isSignup && (
							<div>
								<label
									htmlFor="nickname"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									닉네임
								</label>
								<input
									id="nickname"
									name="nickname"
									type="text"
									required={isSignup}
									disabled={isLoading}
									autoComplete="nickname"
									placeholder="닉네임을 입력하세요"
									className="w-full rounded-lg border border-primary/20 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
								/>
							</div>
						)}

						<div>
							<label
								htmlFor="password"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								비밀번호
							</label>
							<input
								id="password"
								name="password"
								type="password"
								required
								disabled={isLoading}
								autoComplete={
									isSignup
										? "new-password"
										: "current-password"
								}
								placeholder="비밀번호"
								className="w-full rounded-lg border border-primary/20 bg-white/80 px-4 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</div>

						{error && (
							<div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
								{error}
							</div>
						)}

						<button
							type="submit"
							disabled={isLoading}
							className="mt-1 w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isLoading
								? isSignup
									? "가입 처리 중..."
									: "로그인 중..."
								: isSignup
									? "회원가입"
									: "로그인"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
