"use server";

import { createElement } from "react";
import { Resend } from "resend";
import ExchangeCanceledEmail from "@/components/emails/ExchangeCanceledEmail";
import ExchangeConfirmedEmail from "@/components/emails/ExchangeConfirmedEmail";

const SUBJECT = "[서로] 📚 도서 교환 약속이 확정되었습니다!";
const SUBJECT_CANCELED =
	"[서로] ⚠️ 도서 교환 약속이 취소되었습니다.";

/** Free tier / unverified domain: Resend requires this exact onboarding sender. */
const FROM = "Seo-Ro <onboarding@resend.dev>";

function getResend() {
	const key = process.env.RESEND_API_KEY;
	if (!key) return null;
	return new Resend(key);
}

export type ExchangeConfirmationPayload = {
	requesterEmail: string | null;
	ownerEmail: string | null;
	requesterNickname: string;
	ownerNickname: string;
	/** Book the requester receives (owner's book). */
	ownerBookTitle: string;
	/** Book the owner receives (requester's book). */
	requesterBookTitle: string;
	appointmentTimeFormatted: string;
	libraryName: string;
};

/**
 * Sends a confirmation email to both parties. Swallows errors after logging so
 * callers can complete the exchange flow even if mail fails.
 */
export async function sendExchangeConfirmationEmails(
	payload: ExchangeConfirmationPayload,
): Promise<void> {
	const resend = getResend();
	if (!resend) {
		console.warn(
			"[sendEmail] RESEND_API_KEY is not set; skipping exchange confirmation emails.",
		);
		return;
	}

	const {
		requesterEmail,
		ownerEmail,
		requesterNickname,
		ownerNickname,
		ownerBookTitle,
		requesterBookTitle,
		appointmentTimeFormatted,
		libraryName,
	} = payload;

	if (requesterEmail) {
		try {
			const { data, error } = await resend.emails.send({
				from: FROM,
				to: requesterEmail,
				subject: SUBJECT,
				react: createElement(ExchangeConfirmedEmail, {
					bookTitle: ownerBookTitle,
					appointmentTime: appointmentTimeFormatted,
					libraryName,
					partnerNickname: ownerNickname,
					isRequester: true,
				}),
			});
			if (error) {
				console.error(
					"❌ Resend Delivery Failed! Details:",
					error,
					"[recipient: requester]",
				);
			} else {
				console.log(
					"✅ Resend Success! Message ID:",
					data?.id,
					"[recipient: requester]",
				);
			}
		} catch (e) {
			console.error(
				"❌ Resend Exception (requester):",
				e,
			);
		}
	} else {
		console.warn(
			"[sendEmail] Missing requester email; skipping mail to requester.",
		);
	}

	if (ownerEmail) {
		try {
			const { data, error } = await resend.emails.send({
				from: FROM,
				to: ownerEmail,
				subject: SUBJECT,
				react: createElement(ExchangeConfirmedEmail, {
					bookTitle: requesterBookTitle,
					appointmentTime: appointmentTimeFormatted,
					libraryName,
					partnerNickname: requesterNickname,
					isRequester: false,
				}),
			});
			if (error) {
				console.error(
					"❌ Resend Delivery Failed! Details:",
					error,
					"[recipient: owner]",
				);
			} else {
				console.log(
					"✅ Resend Success! Message ID:",
					data?.id,
					"[recipient: owner]",
				);
			}
		} catch (e) {
			console.error(
				"❌ Resend Exception (owner):",
				e,
			);
		}
	} else {
		console.warn("[sendEmail] Missing owner email; skipping mail to owner.");
	}
}

export type ExchangeCancellationPayload = {
	requesterEmail: string | null;
	ownerEmail: string | null;
	requesterNickname: string;
	ownerNickname: string;
	ownerBookTitle: string;
	requesterBookTitle: string;
	cancelReason?: string | null;
};

/**
 * Notifies both parties when a scheduled exchange is canceled. Logs only;
 * does not throw.
 */
export async function sendExchangeCancellationEmails(
	payload: ExchangeCancellationPayload,
): Promise<void> {
	const resend = getResend();
	if (!resend) {
		console.warn(
			"[sendEmail] RESEND_API_KEY is not set; skipping exchange cancellation emails.",
		);
		return;
	}

	const {
		requesterEmail,
		ownerEmail,
		requesterNickname,
		ownerNickname,
		ownerBookTitle,
		requesterBookTitle,
		cancelReason,
	} = payload;

	if (requesterEmail) {
		try {
			const { data, error } = await resend.emails.send({
				from: FROM,
				to: requesterEmail,
				subject: SUBJECT_CANCELED,
				react: createElement(ExchangeCanceledEmail, {
					bookTitle: ownerBookTitle,
					partnerNickname: ownerNickname,
					cancelReason: cancelReason ?? undefined,
				}),
			});
			if (error) {
				console.error(
					"❌ Resend Delivery Failed! Details:",
					error,
					"[cancellation / recipient: requester]",
				);
			} else {
				console.log(
					"✅ Resend Success! Message ID:",
					data?.id,
					"[cancellation / recipient: requester]",
				);
			}
		} catch (e) {
			console.error(
				"❌ Resend Exception (cancellation / requester):",
				e,
			);
		}
	} else {
		console.warn(
			"[sendEmail] Missing requester email; skipping cancellation mail to requester.",
		);
	}

	if (ownerEmail) {
		try {
			const { data, error } = await resend.emails.send({
				from: FROM,
				to: ownerEmail,
				subject: SUBJECT_CANCELED,
				react: createElement(ExchangeCanceledEmail, {
					bookTitle: requesterBookTitle,
					partnerNickname: requesterNickname,
					cancelReason: cancelReason ?? undefined,
				}),
			});
			if (error) {
				console.error(
					"❌ Resend Delivery Failed! Details:",
					error,
					"[cancellation / recipient: owner]",
				);
			} else {
				console.log(
					"✅ Resend Success! Message ID:",
					data?.id,
					"[cancellation / recipient: owner]",
				);
			}
		} catch (e) {
			console.error(
				"❌ Resend Exception (cancellation / owner):",
				e,
			);
		}
	} else {
		console.warn(
			"[sendEmail] Missing owner email; skipping cancellation mail to owner.",
		);
	}
}
