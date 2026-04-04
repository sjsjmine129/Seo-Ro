import * as React from "react";

export type ExchangeConfirmedEmailProps = {
	bookTitle: string;
	appointmentTime: string;
	libraryName: string;
	partnerNickname: string;
	isRequester: boolean;
};

const boxStyle: React.CSSProperties = {
	backgroundColor: "#f8f7ff",
	border: "1px solid #e4e0ff",
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
 * HTML email for Resend — inline styles only (no Tailwind in mail clients).
 */
export default function ExchangeConfirmedEmail({
	bookTitle,
	appointmentTime,
	libraryName,
	partnerNickname,
	isRequester,
}: ExchangeConfirmedEmailProps) {
	return (
		<div
			style={{
				fontFamily:
					'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
				backgroundColor: "#faf9ff",
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
					color: "#4f46e5",
					margin: "0 0 16px",
					lineHeight: 1.4,
				}}
			>
				[서로] 📚 도서 교환 약속이 확정되었습니다!
			</h1>
			<p style={{ fontSize: 15, lineHeight: 1.7, margin: "0 0 8px" }}>
				안녕하세요! 서로(Seo-Ro)에서 도서 교환 약속이 확정되어 안내해 드립니다.
			</p>
			<p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
				{isRequester
					? "요청자로 참여 중인 교환입니다."
					: "책 소유자로 참여 중인 교환입니다."}
			</p>

			<div style={boxStyle}>
				<p style={{ ...labelStyle, marginTop: 0 }}>
					📖 교환 도서: <strong>{bookTitle}</strong>
				</p>
				<p style={labelStyle}>
					⏰ 약속 시간: <strong>{appointmentTime}</strong>
				</p>
				<p style={labelStyle}>
					📍 교환 장소: <strong>{libraryName}</strong>
				</p>
				<p style={{ ...labelStyle, marginBottom: 0 }}>
					🤝 상대방: <strong>{partnerNickname}</strong>
				</p>
			</div>

			<p style={{ fontSize: 15, lineHeight: 1.7, margin: 0 }}>
				약속 시간에 늦지 않게 도착해 주세요. 따뜻한 책 교환 되시길 바랍니다!
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
