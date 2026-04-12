/* eslint-disable @next/next/no-img-element */
"use client";

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	ArrowLeft,
	ArrowRightLeft,
	BookOpen,
	CalendarClock,
	LogOut,
	Plus,
	Send,
} from "lucide-react";
import BottomSheetModal from "@/components/BottomSheetModal";
import { createClient } from "@/utils/supabase/client";
import { rowToUiMessage } from "@/lib/chat/parseChatMessage";
import type {
	ChatBookPreview,
	ChatMeetingLibrary,
	ChatParticipantPreview,
	ChatUiMessage,
	ChatMessageRow,
	ChatRoomStatus,
	SystemAppointmentPayload,
} from "@/lib/types/chat";
import {
	APPOINTMENT_ACCEPT_TEXT,
	APPOINTMENT_DECLINE_TEXT,
} from "@/lib/chat/chatRoomMessages";
import {
	acceptAppointment,
	changeMyExchangeBook,
	declineAppointment,
	getMyExchangeBookCandidates,
	leaveChatRoom,
	markChatRoomRead,
	proposeAppointmentTime,
} from "./actions";

type ChatRoomClientProps = {
	roomId: string;
	currentUserId: string;
	isInitiator: boolean;
	initiator: ChatParticipantPreview;
	receiver: ChatParticipantPreview;
	postBook: ChatBookPreview;
	initialOfferBook: ChatBookPreview | null;
	meetingLibrary: ChatMeetingLibrary;
	initialMessages: ChatUiMessage[];
	initialRoomStatus: ChatRoomStatus;
	initialLeftByUserIds: string[];
	/** Confirmed meet time (ISO) when status is APPOINTMENT_SET */
	initialAppointmentAt: string | null;
};

function isAppointmentActionable(
	messages: ChatUiMessage[],
	msgIndex: number,
	currentUserId: string,
	roomStatus: ChatRoomStatus,
): boolean {
	const msg = messages[msgIndex];
	if (msg.type !== "SYSTEM_APPOINTMENT") return false;
	if (roomStatus !== "NEGOTIATING") return false;
	if (msg.sender_id === currentUserId) return false;

	let lastApptIdx = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].type === "SYSTEM_APPOINTMENT") {
			lastApptIdx = i;
			break;
		}
	}
	if (msgIndex !== lastApptIdx) return false;

	for (let i = msgIndex + 1; i < messages.length; i++) {
		const m = messages[i];
		if (m.type === "TEXT" && m.sender_id === currentUserId) {
			if (
				m.text === APPOINTMENT_ACCEPT_TEXT ||
				m.text === APPOINTMENT_DECLINE_TEXT
			) {
				return false;
			}
		}
	}
	return true;
}

/** Latest appointment proposal with no accept/decline yet from the non-proposer. */
function hasUnansweredAppointmentProposal(messages: ChatUiMessage[]): boolean {
	let lastApptIdx = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].type === "SYSTEM_APPOINTMENT") {
			lastApptIdx = i;
			break;
		}
	}
	if (lastApptIdx < 0) return false;
	const msg = messages[lastApptIdx];
	if (msg.type !== "SYSTEM_APPOINTMENT") return false;
	const proposerId = msg.payload.proposedByUserId ?? msg.sender_id;
	for (let i = lastApptIdx + 1; i < messages.length; i++) {
		const m = messages[i];
		if (m.type !== "TEXT") continue;
		if (m.sender_id === proposerId) continue;
		if (
			m.text === APPOINTMENT_ACCEPT_TEXT ||
			m.text === APPOINTMENT_DECLINE_TEXT
		) {
			return false;
		}
	}
	return true;
}

/** Fallback when `chat_rooms.appointment_at` is null (legacy threads). */
function extractAgreedMeetIsoFromMessages(
	messages: ChatUiMessage[],
): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.type !== "TEXT" || m.text !== APPOINTMENT_ACCEPT_TEXT) continue;
		for (let j = i - 1; j >= 0; j--) {
			const p = messages[j];
			if (p.type === "SYSTEM_APPOINTMENT") {
				return p.payload.meetAt;
			}
		}
	}
	return null;
}

function TextBubble({ text, isSelf }: { text: string; isSelf: boolean }) {
	return (
		<div
			className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
				isSelf
					? "ml-auto bg-primary text-primary-foreground"
					: "mr-auto border border-primary/20 bg-white/80 text-foreground backdrop-blur-sm"
			}`}
		>
			{text}
		</div>
	);
}

function BookChangeActionCard({
	summary,
	isSelf,
}: {
	summary: string;
	isSelf: boolean;
}) {
	return (
		<div
			className={`max-w-[90%] rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur-sm ${
				isSelf ? "ml-auto" : "mr-auto"
			}`}
		>
			<p className="font-semibold text-foreground">
				교환할 책이 바뀌었어요
			</p>
			<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
				{summary}
			</p>
		</div>
	);
}

function AppointmentActionCard({
	payload,
	isSelf,
	showActionButtons,
	isPending,
	onAccept,
	onDecline,
}: {
	payload: SystemAppointmentPayload;
	isSelf: boolean;
	showActionButtons: boolean;
	isPending: boolean;
	onAccept: () => void;
	onDecline: () => void;
}) {
	const d = new Date(payload.meetAt);
	const formatted = Number.isNaN(d.getTime())
		? payload.meetAt
		: d.toLocaleString("ko-KR", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

	const place =
		payload.libraryName?.trim() ||
		(payload.libraryId ? "도서관" : "장소 미정");

	return (
		<div
			className={`max-w-[90%] rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur-sm ${
				isSelf ? "ml-auto" : "mr-auto"
			}`}
		>
			<p className="font-semibold text-foreground">
				약속 시간이 제안되었어요
			</p>
			<p className="mt-2 text-base font-semibold text-foreground">
				{formatted}
			</p>
			<p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
				<span aria-hidden>📍</span>
				<span>
					만나는 장소:{" "}
					<span className="font-medium text-foreground">{place}</span>
					<span className="mt-0.5 block text-[10px] text-muted-foreground">
						(요청 도서가 등록된 도서관으로 고정됩니다)
					</span>
				</span>
			</p>
			{payload.summary ? (
				<p className="mt-2 text-xs text-muted-foreground">
					{payload.summary}
				</p>
			) : null}
			{showActionButtons ? (
				<div className="mt-3 flex gap-2">
					<button
						type="button"
						disabled={isPending}
						className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
						onClick={onAccept}
					>
						{isPending ? "처리 중…" : "수락"}
					</button>
					<button
						type="button"
						disabled={isPending}
						className="flex-1 rounded-lg border border-primary/30 bg-white/90 py-2 text-xs font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
						onClick={onDecline}
					>
						거절
					</button>
				</div>
			) : null}
		</div>
	);
}

function BookChip({
	book,
	label,
	emptyLabel,
	onClick,
	disabled,
}: {
	book: ChatBookPreview | null;
	label: string;
	emptyLabel: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	const interactive = Boolean(onClick) && !disabled;
	const inner = (
		<>
			<div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-neutral-200">
				{book?.thumbnail_url ? (
					<img
						src={book.thumbnail_url}
						alt=""
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center">
						<BookOpen className="h-4 w-4 text-neutral-400" />
					</div>
				)}
			</div>
			<div className="min-w-0 text-left">
				<p className="text-[9px] font-medium text-muted-foreground">
					{label}
				</p>
				<p className="truncate text-xs font-semibold text-foreground">
					{book?.title ?? emptyLabel}
				</p>
			</div>
		</>
	);

	const cls = `flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-primary/15 bg-white/50 px-2 py-1.5 ${
		interactive
			? "cursor-pointer transition-colors hover:border-primary/35 hover:bg-white/80 active:scale-[0.99]"
			: ""
	} ${disabled ? "cursor-not-allowed opacity-60" : ""}`;

	if (interactive) {
		return (
			<button type="button" className={cls} onClick={onClick}>
				{inner}
			</button>
		);
	}

	return <div className={cls}>{inner}</div>;
}

function Avatar({
	p,
	size = "sm",
}: {
	p: ChatParticipantPreview;
	size?: "sm" | "md";
}) {
	const cls =
		size === "md" ? "h-9 w-9 text-sm" : "h-8 w-8 text-[10px] font-semibold";
	if (p.profile_image) {
		return (
			<img
				src={p.profile_image}
				alt=""
				className={`shrink-0 rounded-full object-cover ring-2 ring-white/80 ${cls}`}
			/>
		);
	}
	return (
		<div
			className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-white/80 ${cls}`}
		>
			{p.nickname?.slice(0, 1) ?? "?"}
		</div>
	);
}

function mergeMessage(
	prev: ChatUiMessage[],
	ui: ChatUiMessage,
): ChatUiMessage[] {
	if (prev.some((m) => m.id === ui.id)) return prev;
	const next = [...prev, ui];
	next.sort(
		(a, b) =>
			new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
	);
	return next;
}

/** Merge DB rows into local message list (dedupe by id, chronological sort). */
function mergeRowsIntoMessages(
	prev: ChatUiMessage[],
	rows: ChatMessageRow[],
): ChatUiMessage[] {
	if (rows.length === 0) return prev;
	let changed = false;
	const next = [...prev];
	for (const row of rows) {
		if (!row?.id || next.some((m) => m.id === row.id)) continue;
		next.push(rowToUiMessage(row));
		changed = true;
	}
	if (!changed) return prev;
	next.sort(
		(a, b) =>
			new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
	);
	return next;
}

async function fetchBookPreviewForHeader(
	supabase: ReturnType<typeof createClient>,
	bookId: string,
): Promise<ChatBookPreview | null> {
	const { data, error } = await supabase
		.from("books")
		.select("id, title, thumbnail_url")
		.eq("id", bookId)
		.single();
	if (error || !data) return null;
	return {
		id: data.id,
		title: data.title ?? "(제목 없음)",
		thumbnail_url: data.thumbnail_url,
	};
}

function rowLibraryJoin(
	row: { libraries: unknown },
): { id: string; name: string } | null {
	const L = row.libraries;
	const one = Array.isArray(L) ? L[0] : L;
	if (
		one &&
		typeof one === "object" &&
		"id" in one &&
		"name" in one &&
		typeof (one as { id: unknown }).id === "string" &&
		typeof (one as { name: unknown }).name === "string"
	) {
		return {
			id: (one as { id: string }).id,
			name: (one as { name: string }).name,
		};
	}
	return null;
}

async function fetchMeetingLibraryForBookClient(
	supabase: ReturnType<typeof createClient>,
	bookId: string,
): Promise<ChatMeetingLibrary> {
	const { data: libRows, error } = await supabase
		.from("book_libraries")
		.select("library_id, libraries(id, name)")
		.eq("book_id", bookId);
	if (error) {
		return { id: "", name: "등록된 도서관 없음" };
	}
	const libs =
		(libRows ?? [])
			.map((r) => rowLibraryJoin(r as { libraries: unknown }))
			.filter((x): x is { id: string; name: string } => x !== null) ?? [];
	libs.sort((a, b) => a.name.localeCompare(b.name, "ko"));
	return libs.length > 0
		? { id: libs[0].id, name: libs[0].name }
		: { id: "", name: "등록된 도서관 없음" };
}

export default function ChatRoomClient({
	roomId,
	currentUserId,
	isInitiator,
	initiator,
	receiver,
	postBook,
	initialOfferBook,
	meetingLibrary,
	initialMessages,
	initialRoomStatus,
	initialLeftByUserIds,
	initialAppointmentAt,
}: ChatRoomClientProps) {
	const router = useRouter();
	const [messages, setMessages] = useState<ChatUiMessage[]>(initialMessages);
	const [roomStatus, setRoomStatus] =
		useState<ChatRoomStatus>(initialRoomStatus);
	const [agreedAppointmentAt, setAgreedAppointmentAt] = useState<
		string | null
	>(initialAppointmentAt);
	const [leftByUserIds, setLeftByUserIds] = useState<string[]>(
		initialLeftByUserIds,
	);
	const userHasLeft = useMemo(
		() => leftByUserIds.includes(currentUserId),
		[leftByUserIds, currentUserId],
	);
	const [appointmentPendingId, setAppointmentPendingId] = useState<
		string | null
	>(null);
	const [offerBook, setOfferBook] = useState<ChatBookPreview | null>(
		initialOfferBook,
	);
	const [postBookPreview, setPostBookPreview] = useState<ChatBookPreview>(
		postBook,
	);
	const [meetingLibraryState, setMeetingLibraryState] =
		useState<ChatMeetingLibrary>(meetingLibrary);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [errorHint, setErrorHint] = useState<string | null>(null);

	const [actionsOpen, setActionsOpen] = useState(false);
	const [changeBookOpen, setChangeBookOpen] = useState(false);
	const [appointmentOpen, setAppointmentOpen] = useState(false);
	const [candidates, setCandidates] = useState<ChatBookPreview[]>([]);
	const [loadingCandidates, setLoadingCandidates] = useState(false);
	const [actionBusy, setActionBusy] = useState(false);
	const [appointmentLocal, setAppointmentLocal] = useState("");

	const endRef = useRef<HTMLDivElement>(null);
	/** Latest messages for polling (avoids stale closures). */
	const messagesRef = useRef<ChatUiMessage[]>(initialMessages);
	messagesRef.current = messages;

	const headerBookIdsRef = useRef({
		postId: postBook.id,
		offerId: initialOfferBook?.id ?? null as string | null,
	});
	useLayoutEffect(() => {
		headerBookIdsRef.current = {
			postId: postBookPreview.id,
			offerId: offerBook?.id ?? null,
		};
	}, [postBookPreview.id, offerBook?.id]);

	// Full header + room slice from server when entering a chat room.
	useEffect(() => {
		setPostBookPreview(postBook);
		setMeetingLibraryState(meetingLibrary);
		setRoomStatus(initialRoomStatus);
		setAgreedAppointmentAt(initialAppointmentAt);
		setOfferBook(initialOfferBook);
		setLeftByUserIds(initialLeftByUserIds);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only reset when navigating to another room
	}, [roomId]);

	const registerBookHref = useMemo(() => {
		const id = meetingLibraryState.id?.trim();
		return id
			? `/book/new?libraryId=${encodeURIComponent(id)}`
			: "/book/new";
	}, [meetingLibraryState.id]);

	const unansweredAppointment = useMemo(
		() => hasUnansweredAppointmentProposal(messages),
		[messages],
	);

	const offerChipChangeDisabled = useMemo(
		() =>
			roomStatus === "COMPLETED" ||
			roomStatus === "APPOINTMENT_SET" ||
			unansweredAppointment,
		[roomStatus, unansweredAppointment],
	);

	const displayAppointmentIso = useMemo(() => {
		if (roomStatus !== "APPOINTMENT_SET") return null;
		if (agreedAppointmentAt) return agreedAppointmentAt;
		return extractAgreedMeetIsoFromMessages(messages);
	}, [roomStatus, agreedAppointmentAt, messages]);

	const appointmentHeaderLabel = useMemo(() => {
		if (!displayAppointmentIso) return null;
		const d = new Date(displayAppointmentIso);
		if (Number.isNaN(d.getTime())) return null;
		return d.toLocaleString("ko-KR", {
			dateStyle: "long",
			timeStyle: "short",
		});
	}, [displayAppointmentIso]);

	useLayoutEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		const supabase = createClient();
		let cancelled = false;
		let channel: ReturnType<typeof supabase.channel> | null = null;
		let pollInFlight = false;

		const POLL_MS = 3000;

		const pollMissingMessages = async () => {
			if (cancelled || pollInFlight) return;
			pollInFlight = true;
			try {
				const prev = messagesRef.current;
				const afterIso =
					prev.length === 0
						? "1970-01-01T00:00:00.000Z"
						: prev.reduce(
								(latest, m) =>
									new Date(m.created_at) > new Date(latest)
										? m.created_at
										: latest,
								prev[0].created_at,
							);

				const { data: rows, error } = await supabase
					.from("messages")
					.select(
						"id, room_id, sender_id, message_type, content, created_at",
					)
					.eq("room_id", roomId)
					.gt("created_at", afterIso)
					.order("created_at", { ascending: true });

				if (cancelled || error || !rows?.length) return;

				setMessages((p) =>
					mergeRowsIntoMessages(p, rows as ChatMessageRow[]),
				);
			} finally {
				pollInFlight = false;
			}
		};

		const pollTimer = window.setInterval(() => {
			void pollMissingMessages();
		}, POLL_MS);

		void (async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (cancelled || !session?.user) return;

			// Wide-open messages INSERTs (filter in JS). Room row UPDATEs use server filter.
			const ch = supabase
				.channel(`chat-room-${roomId}`)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "messages",
					},
					(payload) => {
						console.log("🔥 [RAW PAYLOAD RECEIVED]:", payload);
						const row = payload.new as ChatMessageRow;
						if (!row?.id) return;
						const eventRoom =
							typeof row.room_id === "string"
								? row.room_id
								: String(row.room_id ?? "");
						if (eventRoom !== roomId) return;
						setMessages((prev) =>
							mergeRowsIntoMessages(prev, [row]),
						);
					},
				)
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "chat_rooms",
						filter: `id=eq.${roomId}`,
					},
					(payload) => {
						console.log("🔥 [chat_rooms UPDATE]:", payload);
						const row = payload.new as Record<string, unknown>;
						if (!row || String(row.id ?? "") !== roomId) return;

						if (typeof row.status === "string") {
							setRoomStatus(row.status as ChatRoomStatus);
						}

						if ("appointment_at" in row) {
							const at = row.appointment_at;
							setAgreedAppointmentAt(
								at != null && String(at).trim() !== ""
									? String(at)
									: null,
							);
						}

						if (Array.isArray(row.left_by_user_ids)) {
							setLeftByUserIds(row.left_by_user_ids as string[]);
						}

						void (async () => {
							const newPostRaw = row.post_book_id;
							const newPostId =
								typeof newPostRaw === "string"
									? newPostRaw
									: null;
							const offerRaw = row.initiator_offer_book_id;
							const newOfferId =
								offerRaw === null || offerRaw === undefined
									? null
									: String(offerRaw);

							const { postId: prevPost, offerId: prevOffer } =
								headerBookIdsRef.current;

							if (newPostId && newPostId !== prevPost) {
								const preview = await fetchBookPreviewForHeader(
									supabase,
									newPostId,
								);
								if (cancelled || !preview) return;
								setPostBookPreview(preview);
								const hub = await fetchMeetingLibraryForBookClient(
									supabase,
									newPostId,
								);
								if (!cancelled) setMeetingLibraryState(hub);
							}

							if (newOfferId !== prevOffer) {
								if (!newOfferId) {
									if (!cancelled) setOfferBook(null);
								} else {
									const preview = await fetchBookPreviewForHeader(
										supabase,
										newOfferId,
									);
									if (!cancelled && preview) setOfferBook(preview);
								}
							}
						})();
					},
				)
				.subscribe((status, err) => {
					if (status === "SUBSCRIBED") {
						console.log(
							"🔥 Realtime subscribed:",
							`chat-room-${roomId}`,
						);
					} else if (status === "CLOSED") {
						console.log(
							"🔥 Realtime channel closed:",
							`chat-room-${roomId}`,
						);
					} else if (
						status === "CHANNEL_ERROR" ||
						status === "TIMED_OUT"
					) {
						console.error(
							"🔥 Realtime channel error:",
							status,
							err,
						);
					}
				});

			// Assign immediately so cleanup can always remove the channel, even if
			// this effect is torn down before the next line would have run.
			channel = ch;
			if (cancelled) {
				supabase.removeChannel(ch);
				channel = null;
			}
		})();

		return () => {
			cancelled = true;
			window.clearInterval(pollTimer);
			if (channel) {
				supabase.removeChannel(channel);
				channel = null;
			}
		};
	}, [roomId]);

	const sendText = useCallback(async () => {
		const text = draft.trim();
		if (!text || sending) return;
		setSending(true);
		setErrorHint(null);
		const supabase = createClient();
		const { data, error } = await supabase
			.from("messages")
			.insert({
				room_id: roomId,
				sender_id: currentUserId,
				participant_ids: [initiator.id, receiver.id],
				message_type: "TEXT",
				content: text,
			})
			.select("id, room_id, sender_id, message_type, content, created_at")
			.single();

		setSending(false);
		if (error) {
			setErrorHint(error.message);
			return;
		}
		if (data) {
			const ui = rowToUiMessage(data as ChatMessageRow);
			setMessages((prev) => mergeMessage(prev, ui));
			setDraft("");
		}
	}, [draft, sending, roomId, currentUserId, initiator.id, receiver.id]);

	const openChangeBook = useCallback(
		async (fromActionMenu = true) => {
			if (fromActionMenu) setActionsOpen(false);
			setChangeBookOpen(true);
			setLoadingCandidates(true);
			setErrorHint(null);
			try {
				const list = await getMyExchangeBookCandidates(roomId);
				setCandidates(list);
			} catch (e) {
				setErrorHint(
					e instanceof Error
						? e.message
						: "목록을 불러오지 못했습니다.",
				);
				setCandidates([]);
			} finally {
				setLoadingCandidates(false);
			}
		},
		[roomId],
	);

	const confirmChangeBook = useCallback(
		async (bookId: string) => {
			setActionBusy(true);
			setErrorHint(null);
			try {
				const { offerBook: nextOffer, postBook: nextPost, meetingLibrary: nextHub, messageRow } =
					await changeMyExchangeBook(roomId, bookId);
				if (nextOffer) setOfferBook(nextOffer);
				if (nextPost) setPostBookPreview(nextPost);
				if (nextHub) setMeetingLibraryState(nextHub);
				const ui = rowToUiMessage(messageRow);
				setMessages((prev) => mergeMessage(prev, ui));
				setChangeBookOpen(false);
			} catch (e) {
				setErrorHint(
					e instanceof Error ? e.message : "변경에 실패했습니다.",
				);
			} finally {
				setActionBusy(false);
			}
		},
		[roomId],
	);

	const confirmAppointment = useCallback(async () => {
		if (!appointmentLocal) {
			setErrorHint("날짜와 시간을 선택해 주세요.");
			return;
		}
		const parsed = new Date(appointmentLocal);
		if (Number.isNaN(parsed.getTime())) {
			setErrorHint("유효한 날짜·시간을 선택해 주세요.");
			return;
		}
		setActionBusy(true);
		setErrorHint(null);
		try {
			const { messageRow } = await proposeAppointmentTime(
				roomId,
				parsed.toISOString(),
			);
			const ui = rowToUiMessage(messageRow);
			setMessages((prev) => mergeMessage(prev, ui));
			setAppointmentOpen(false);
			setAppointmentLocal("");
		} catch (e) {
			setErrorHint(
				e instanceof Error ? e.message : "제안에 실패했습니다.",
			);
		} finally {
			setActionBusy(false);
		}
	}, [appointmentLocal, roomId]);

	const openAppointmentSheet = useCallback(() => {
		setActionsOpen(false);
		setAppointmentOpen(true);
		setAppointmentLocal("");
		setErrorHint(null);
	}, []);

	const handleAcceptAppointment = useCallback(
		async (messageId: string) => {
			setAppointmentPendingId(messageId);
			setErrorHint(null);
			try {
				const { messageRow, nextRoomStatus, appointmentAt } =
					await acceptAppointment(roomId, messageId);
				setRoomStatus(nextRoomStatus);
				if (appointmentAt) setAgreedAppointmentAt(appointmentAt);
				const ui = rowToUiMessage(messageRow);
				setMessages((prev) => mergeMessage(prev, ui));
			} catch (e) {
				setErrorHint(
					e instanceof Error
						? e.message
						: "수락 처리에 실패했습니다.",
				);
			} finally {
				setAppointmentPendingId(null);
			}
		},
		[roomId],
	);

	const handleDeclineAppointment = useCallback(
		async (messageId: string) => {
			setAppointmentPendingId(messageId);
			setErrorHint(null);
			try {
				const { messageRow, nextRoomStatus } = await declineAppointment(
					roomId,
					messageId,
				);
				setRoomStatus(nextRoomStatus);
				const ui = rowToUiMessage(messageRow);
				setMessages((prev) => mergeMessage(prev, ui));
			} catch (e) {
				setErrorHint(
					e instanceof Error
						? e.message
						: "거절 처리에 실패했습니다.",
				);
			} finally {
				setAppointmentPendingId(null);
			}
		},
		[roomId],
	);

	const handleLeaveChat = useCallback(() => {
		if (
			!window.confirm(
				"정말 채팅방을 나가시겠습니까? 진행 중인 교환이 취소됩니다.",
			)
		) {
			return;
		}
		setActionBusy(true);
		setErrorHint(null);
		void (async () => {
			try {
				const { messageRow } = await leaveChatRoom(roomId);
				if (messageRow) {
					const ui = rowToUiMessage(messageRow);
					setMessages((prev) => mergeMessage(prev, ui));
				}
				setActionsOpen(false);
				router.push("/chat");
			} catch (e) {
				setErrorHint(
					e instanceof Error ? e.message : "나가기에 실패했습니다.",
				);
			} finally {
				setActionBusy(false);
			}
		})();
	}, [roomId, router]);

	const roomClosed = roomStatus === "COMPLETED";

	const lastMessageId = messages[messages.length - 1]?.id ?? "";

	useEffect(() => {
		if (userHasLeft) return;
		const delay = lastMessageId ? 400 : 0;
		const t = window.setTimeout(() => {
			void markChatRoomRead(roomId);
		}, delay);
		return () => window.clearTimeout(t);
	}, [roomId, lastMessageId, userHasLeft]);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header
				className="sticky top-0 z-40 border-b border-primary/15 bg-glass-bg/95 px-3 py-2 shadow-sm backdrop-blur-md"
				style={{
					paddingTop: "max(0.5rem, env(safe-area-inset-top))",
				}}
			>
				<div className="mx-auto flex max-w-lg flex-col gap-2">
					<div className="relative flex min-h-[2.75rem] w-full items-center justify-between">
						<Link
							href="/chat"
							className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-white/60"
							aria-label="뒤로"
						>
							<ArrowLeft className="h-5 w-5" />
						</Link>
						<div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
							<Avatar p={initiator} />
							<span className="text-muted-foreground">·</span>
							<Avatar p={receiver} />
						</div>
						<div className="relative z-10 h-9 w-9 shrink-0" aria-hidden />
					</div>
					<div className="flex w-full items-center justify-center gap-2 px-1">
						<BookChip
							book={postBookPreview}
							label="요청 책"
							emptyLabel="—"
						/>
						<div className="flex h-full shrink-0 items-center self-center text-lg text-primary">
							↔
						</div>
						<BookChip
							book={offerBook}
							label="제안 책"
							emptyLabel="제안 책 미정"
							onClick={
								offerChipChangeDisabled
									? undefined
									: () => void openChangeBook(false)
							}
							disabled={offerChipChangeDisabled}
						/>
					</div>
					{displayAppointmentIso && appointmentHeaderLabel ? (
						<div className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-2.5 py-2 text-xs text-foreground shadow-sm">
							<CalendarClock
								className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
								aria-hidden
							/>
							<p className="min-w-0 leading-snug">
								<span aria-hidden>📅 </span>
								<span className="font-semibold">약속 시간: </span>
								<span>{appointmentHeaderLabel}</span>
							</p>
						</div>
					) : null}
				</div>
			</header>

			<main
				className={`mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 ${
					userHasLeft ? "pb-8" : roomClosed ? "pb-28" : "pb-36"
				}`}
			>
				{errorHint ? (
					<p className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
						{errorHint}
					</p>
				) : null}
				{messages.map((msg, msgIndex) => {
					const isSelf = msg.sender_id === currentUserId;
					if (msg.type === "TEXT") {
						return (
							<TextBubble
								key={msg.id}
								text={msg.text}
								isSelf={isSelf}
							/>
						);
					}
					if (msg.type === "SYSTEM_BOOK_CHANGE") {
						return (
							<BookChangeActionCard
								key={msg.id}
								summary={
									msg.payload.summary ??
									"제안 도서가 변경되었습니다."
								}
								isSelf={isSelf}
							/>
						);
					}
					const showAppointmentActions = isAppointmentActionable(
						messages,
						msgIndex,
						currentUserId,
						roomStatus,
					);
					return (
						<AppointmentActionCard
							key={msg.id}
							payload={msg.payload}
							isSelf={isSelf}
							showActionButtons={showAppointmentActions}
							isPending={appointmentPendingId === msg.id}
							onAccept={() =>
								void handleAcceptAppointment(msg.id)
							}
							onDecline={() =>
								void handleDeclineAppointment(msg.id)
							}
						/>
					);
				})}
				<div ref={endRef} aria-hidden />
			</main>

			{!userHasLeft ? (
				<div
					className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/15 bg-glass-bg/95 px-3 py-2 backdrop-blur-md"
					style={{
						paddingBottom:
							"max(0.75rem, env(safe-area-inset-bottom))",
					}}
				>
					<div className="mx-auto flex max-w-lg items-center gap-2">
						<button
							type="button"
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-white/70 text-primary shadow-sm transition-colors hover:bg-white"
							aria-label="액션 메뉴"
							onClick={() => {
								setErrorHint(null);
								setActionsOpen(true);
							}}
						>
							<Plus className="h-5 w-5" />
						</button>
						{!roomClosed ? (
							<div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-primary/20 bg-white/80 px-3 py-2 shadow-inner">
								<input
									type="text"
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											void sendText();
										}
									}}
									placeholder="메시지를 입력하세요"
									className="min-h-[2.25rem] min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
								/>
								<button
									type="button"
									className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground ${
										draft.trim() && !sending
											? ""
											: "pointer-events-none opacity-50"
									}`}
									disabled={!draft.trim() || sending}
									aria-label="보내기"
									onClick={() => void sendText()}
								>
									<Send className="h-4 w-4" />
								</button>
							</div>
						) : null}
					</div>
				</div>
			) : null}

			<BottomSheetModal
				open={actionsOpen}
				onClose={() => setActionsOpen(false)}
				className="pointer-events-auto w-full max-w-lg rounded-2xl border border-primary/15 bg-glass-bg p-4 shadow-xl"
			>
				<p className="text-sm font-semibold text-foreground">액션</p>
				<div className="mt-3 flex flex-col gap-2">
					<button
						type="button"
						disabled={
							userHasLeft ||
							roomClosed ||
							actionBusy ||
							offerChipChangeDisabled
						}
						className="flex items-center rounded-xl border border-primary/20 bg-white/80 py-3 px-3 text-left text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
						onClick={() => void openChangeBook(true)}
					>
						<ArrowRightLeft className="mr-3 h-5 w-5 shrink-0 text-primary" />
						교환 책 변경
					</button>
					<button
						type="button"
						disabled={userHasLeft || roomClosed || actionBusy}
						className="flex items-center rounded-xl border border-primary/20 bg-white/80 py-3 px-3 text-left text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
						onClick={openAppointmentSheet}
					>
						<CalendarClock className="mr-3 h-5 w-5 shrink-0 text-primary" />
						시간 약속 잡기
					</button>
				</div>
				<div className="my-3 h-px bg-primary/15" />
				<button
					type="button"
					disabled={userHasLeft || actionBusy}
					className="flex w-full items-center rounded-xl border border-red-200/80 bg-white/80 py-3 px-3 text-left text-sm font-medium text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
					onClick={handleLeaveChat}
				>
					<LogOut className="mr-3 h-5 w-5 shrink-0 text-red-500" />
					채팅방 나가기
				</button>
				<button
					type="button"
					className="mt-4 w-full rounded-xl py-2 text-sm text-muted-foreground"
					onClick={() => setActionsOpen(false)}
				>
					닫기
				</button>
			</BottomSheetModal>

			<BottomSheetModal
				open={changeBookOpen}
				onClose={() => setChangeBookOpen(false)}
				className="pointer-events-auto max-h-[min(70vh,520px)] w-full max-w-lg overflow-hidden rounded-2xl border border-primary/15 bg-glass-bg shadow-xl"
			>
				<div className="flex max-h-[min(70vh,520px)] flex-col p-4">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="text-sm font-semibold text-foreground">
								{isInitiator
									? "교환할 내 책 선택"
									: "제공할 내 책 선택"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{isInitiator
									? "요청 도서와 같은 도서관에 등록된 내 책만 표시됩니다."
									: "상대방 제안 책과 같은 도서관에 등록된 내 책만 표시됩니다."}
							</p>
						</div>
						<Link
							href={registerBookHref}
							onClick={() => setChangeBookOpen(false)}
							className="shrink-0 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
						>
							새 책 등록
						</Link>
					</div>
					<div className="mt-3 flex-1 overflow-y-auto">
						{loadingCandidates ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								불러오는 중…
							</p>
						) : candidates.length === 0 ? (
							<div className="flex flex-col items-center gap-4 py-10 text-center">
								<p className="max-w-[240px] text-sm text-muted-foreground">
									이 도서관에 등록된 교환 가능한 책이 없어요.
									새 책을 등록해 보세요.
								</p>
								<Link
									href={registerBookHref}
									onClick={() => setChangeBookOpen(false)}
									className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
								>
									책 등록하기
								</Link>
							</div>
						) : (
							<ul className="flex flex-col gap-2">
								{candidates.map((b) => (
									<li key={b.id}>
										<button
											type="button"
											disabled={actionBusy}
											className="flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-white/80 px-3 py-2 text-left text-sm transition-colors hover:bg-white disabled:opacity-50"
											onClick={() =>
												void confirmChangeBook(b.id)
											}
										>
											<div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-neutral-200">
												{b.thumbnail_url ? (
													<img
														src={b.thumbnail_url}
														alt=""
														className="h-full w-full object-cover"
													/>
												) : (
													<div className="flex h-full w-full items-center justify-center">
														<BookOpen className="h-4 w-4 text-neutral-400" />
													</div>
												)}
											</div>
											<span className="line-clamp-2 font-medium text-foreground">
												{b.title}
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</BottomSheetModal>

			<BottomSheetModal
				open={appointmentOpen}
				onClose={() => setAppointmentOpen(false)}
				className="pointer-events-auto w-full max-w-lg rounded-2xl border border-primary/15 bg-glass-bg p-4 shadow-xl"
			>
				<p className="text-sm font-semibold text-foreground">
					시간 약속 잡기
				</p>
				<p className="mt-3 flex items-start gap-1 rounded-lg border border-primary/15 bg-white/60 px-3 py-2 text-xs text-muted-foreground">
					<span aria-hidden>📍</span>
					<span>
						만나는 장소:{" "}
						<span className="font-semibold text-foreground">
							{meetingLibraryState.name}
						</span>
					</span>
				</p>
				<label className="mt-4 block text-xs font-medium text-muted-foreground">
					날짜·시간
					<input
						type="datetime-local"
						value={appointmentLocal}
						onChange={(e) => setAppointmentLocal(e.target.value)}
						className="mt-1 w-full rounded-xl border border-primary/20 bg-white/90 px-3 py-2 text-sm text-foreground"
					/>
				</label>
				<button
					type="button"
					disabled={actionBusy}
					className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
					onClick={() => void confirmAppointment()}
				>
					{actionBusy ? "처리 중…" : "제안 보내기"}
				</button>
				<button
					type="button"
					className="mt-2 w-full rounded-xl py-2 text-sm text-muted-foreground"
					onClick={() => setAppointmentOpen(false)}
				>
					취소
				</button>
			</BottomSheetModal>
		</div>
	);
}
