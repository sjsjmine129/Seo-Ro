import * as React from "react";

export type ExchangeCanceledEmailProps = {
	bookTitle: string;
	partnerNickname: string;
	cancelReason?: string | null;
};

const boxStyle: React.CSSProperties = {
	backgroundColor: "#fff7ed",
	border: "1px solid #fed7aa",
	borderRadius: 12,
	padding: "20px 18px",
	marginTop: 20,
	marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
	margin: "10px 0",
	fontSize: 15,
	color: "#1f2937",
	lineHeight: 1.6,
};

/**
 * HTML email for Resend — cancellation notice (warning / warm accent).
 */
export default function ExchangeCanceledEmail({
	bookTitle,
	partnerNickname,
	cancelReason,
}: ExchangeCanceledEmailProps) {
	return (
		<div
			style={{
				fontFamily:
					'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
				backgroundColor: "#fffbeb",
				color: "#1f2937",
				padding: "32px 24px",
				maxWidth: 560,
				margin: "0 auto",
			}}
		>
			<h1
				style={{
					fontSize: 20,
					fontWeight: 700,
					color: "#c2410c",
					margin: "0 0 16px",
					lineHeight: 1.4,
				}}
			>
				[서로] ⚠️ 도서 교환 약속이 취소되었습니다.
			</h1>
			<p style={{ fontSize: 15, lineHeight: 1.7, margin: "0 0 16px" }}>
				안녕하세요. 아쉽게도 서로(Seo-Ro)에서 예정되었던 도서 교환 약속이 취소되어
				안내해 드립니다.
			</p>

			<div style={boxStyle}>
				<p style={{ ...labelStyle, marginTop: 0 }}>
					📖 취소된 도서: <strong>{bookTitle}</strong>
				</p>
				<p style={{ ...labelStyle, marginBottom: 0 }}>
					🤝 상대방: <strong>{partnerNickname}</strong>
				</p>
			</div>

			{cancelReason ? (
				<p
					style={{
						fontSize: 14,
						color: "#9a3412",
						backgroundColor: "#ffedd5",
						borderRadius: 8,
						padding: "12px 14px",
						margin: "0 0 16px",
						lineHeight: 1.6,
					}}
				>
					<strong>안내:</strong> {cancelReason}
				</p>
			) : null}

			<p style={{ fontSize: 15, lineHeight: 1.7, margin: 0 }}>
				다음 기회에 더 좋은 책 교환으로 뵙기를 바랍니다!
			</p>
			<p
				style={{
					fontSize: 12,
					color: "#9ca3af",
					marginTop: 28,
					marginBottom: 0,
				}}
			>
				본 메일은 Seo-Ro(서로) 서비스 알림용으로 발송되었습니다.
			</p>
		</div>
	);
}
