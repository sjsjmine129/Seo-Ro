import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import ExchangeInteractiveUI from "./ExchangeInteractiveUI";

type ExchangeUserSnippet = {
	nickname: string | null;
	profile_image: string | null;
	bookshelf_score: number;
};

type ExchangeDetail = {
	id: string;
	status: string;
	requester_id: string;
	owner_id: string;
	requester_book_id: string;
	owner_book_id: string;
	library_id: string;
	meet_at: string | null;
	proposed_times: string[] | null;
	requester_completed: boolean;
	owner_completed: boolean;
	requester_user: ExchangeUserSnippet | null;
	owner_user: ExchangeUserSnippet | null;
	requester_book: {
		id: string;
		title: string;
		thumbnail_url: string | null;
		condition: string;
	};
	owner_book: {
		id: string;
		title: string;
		thumbnail_url: string | null;
		condition: string;
	};
	library: {
		id: string;
		name: string;
		address: string | null;
	};
};

async function getExchangeDetail(
	supabase: Awaited<ReturnType<typeof createClient>>,
	exchangeId: string,
	userId: string,
): Promise<ExchangeDetail | null> {
	const { data, error } = await supabase
		.from("exchanges")
		.select(
			`
			id, status, requester_id, owner_id, requester_book_id, owner_book_id, library_id, meet_at, proposed_times, requester_completed, owner_completed,
			requester_user:users!requester_id(nickname, profile_image, bookshelf_score),
			owner_user:users!owner_id(nickname, profile_image, bookshelf_score),
			requester_book:books!requester_book_id(id, title, thumbnail_url, condition),
			owner_book:books!owner_book_id(id, title, thumbnail_url, condition),
			library:libraries(id, name, address)
		`,
		)
		.eq("id", exchangeId)
		.or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
		.single();

	if (error || !data) return null;

	return data as unknown as ExchangeDetail;
}

export default async function ExchangePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	const { id } = await params;
	const exchange = await getExchangeDetail(supabase, id, user.id);

	if (!exchange) notFound();

	const isRequester = user.id === exchange.requester_id;
	const isOwner = user.id === exchange.owner_id;

	return (
		<>
			<div className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<div className="mb-3">
					<BackButton />
				</div>
				<main className="mx-auto w-full max-w-lg">
					<ExchangeInteractiveUI
						exchange={exchange}
						isRequester={isRequester}
						isOwner={isOwner}
					/>
				</main>
			</div>
			<BottomNav />
		</>
	);
}
