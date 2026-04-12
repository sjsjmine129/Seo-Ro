/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/utils/supabase/server";
import {
	formatChatListTime,
	loadChatListItems,
	type ChatListItem,
} from "@/lib/chat/loadChatList";

function Avatar({ item }: { item: ChatListItem["otherUser"] }) {
	const cls = "h-12 w-12 shrink-0 rounded-full text-base font-semibold";
	if (item.profile_image) {
		return (
			<img
				src={item.profile_image}
				alt=""
				className={`${cls} object-cover ring-2 ring-primary/10`}
			/>
		);
	}
	return (
		<div
			className={`flex items-center justify-center bg-primary/15 text-primary ring-2 ring-primary/10 ${cls}`}
		>
			{item.nickname?.slice(0, 1) ?? "?"}
		</div>
	);
}

function ChatListRow({ item }: { item: ChatListItem }) {
	const timeLabel = formatChatListTime(item.sortTime);

	return (
		<Link
			href={`/chat/${item.roomId}`}
			className="flex items-center gap-3 border-b border-primary/10 py-3 pr-1 transition-colors hover:bg-white/40"
		>
			<Avatar item={item.otherUser} />
			<div className="min-w-0 flex-1">
				<p className="truncate font-bold text-foreground">
					{item.otherUser.nickname ?? "이웃"}
				</p>
				<p className="truncate text-sm text-gray-500">{item.preview}</p>
			</div>
			<div className="flex shrink-0 flex-col items-end gap-1.5">
				{timeLabel ? (
					<time
						dateTime={item.sortTime}
						className="whitespace-nowrap text-xs text-gray-500"
					>
						{timeLabel}
					</time>
				) : null}
				<div className="h-11 w-8 overflow-hidden rounded bg-neutral-200">
					{item.postBookThumbnail ? (
						<img
							src={item.postBookThumbnail}
							alt=""
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<BookOpen className="h-4 w-4 text-neutral-400" />
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}

export default async function ChatListPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const items = await loadChatListItems(supabase, user.id);

	return (
		<>
			<div className="flex min-h-screen flex-col bg-background pb-32 pt-4">
				<header className="border-b border-primary/15 px-4 pb-3">
					<div className="mx-auto flex max-w-lg items-center gap-2">
						<MessageCircle
							className="h-6 w-6 text-primary"
							strokeWidth={2}
							aria-hidden
						/>
						<h1 className="text-lg font-bold text-foreground">채팅</h1>
					</div>
				</header>

				<div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4">
					{items.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
							<MessageCircle
								className="h-14 w-14 text-muted-foreground/40"
								strokeWidth={1.5}
								aria-hidden
							/>
							<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
								아직 진행 중인 교환이 없어요. 이웃의 책을 구경하고
								바꿔읽기를 제안해 보세요!
							</p>
							<Link
								href="/search"
								className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
							>
								책 찾아보기
							</Link>
						</div>
					) : (
						<div className="flex flex-col">
							{items.map((item) => (
								<ChatListRow key={item.roomId} item={item} />
							))}
						</div>
					)}
				</div>
			</div>
			<BottomNav />
		</>
	);
}
