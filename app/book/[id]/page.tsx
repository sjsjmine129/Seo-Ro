import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BookDetailClient from "./BookDetailClient";

const CONDITION_LABELS: Record<string, string> = {
	S: "S급",
	A: "A급",
	B: "B급",
	C: "C급",
	D: "D급",
};

const CONDITION_COLORS: Record<string, string> = {
	S: "bg-primary text-white",
	A: "bg-primary/80 text-white",
	B: "bg-primary/60 text-white",
	C: "bg-neutral-500 text-white",
	D: "bg-neutral-400 text-white",
};

type BookDetail = {
	id: string;
	owner_id: string;
	title: string;
	authors: string | null;
	publisher: string | null;
	user_images: string[];
	user_review: string | null;
	condition: string;
	status: string;
	owner: {
		nickname: string | null;
		profile_image: string | null;
		bookshelf_score: number;
	} | null;
	book_libraries: Array<{
		library_id: string;
		libraries: {
			id: string;
			name: string;
			address: string | null;
		} | null;
	}>;
};

async function getBookDetail(
	supabase: Awaited<ReturnType<typeof createClient>>,
	bookId: string,
): Promise<BookDetail | null> {
	const { data, error } = await supabase
		.from("books")
		.select(
			`
			id, owner_id, title, authors, publisher, user_images, user_review, condition, status,
			owner:users!owner_id(nickname, profile_image, bookshelf_score),
			book_libraries(library_id, libraries(id, name, address))
		`,
		)
		.eq("id", bookId)
		.single();

	if (error || !data) return null;

	return data as unknown as BookDetail;
}

export default async function BookDetailPage({
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
	const book = await getBookDetail(supabase, id);

	if (!book) notFound();

	const libraries = (book.book_libraries ?? [])
		.filter((bl) => bl.libraries != null)
		.map((bl) => ({
			id: bl.libraries!.id,
			name: bl.libraries!.name,
			address: bl.libraries!.address ?? null,
		}));
	const conditionColor =
		CONDITION_COLORS[book.condition] ?? CONDITION_COLORS.B;
	const conditionLabel =
		CONDITION_LABELS[book.condition] ?? book.condition + "급";
	const isAvailable = book.status === "AVAILABLE";
	const isOwner = user.id === book.owner_id;

	return (
		<>
			<BookDetailClient
				book={book}
				libraries={libraries}
				conditionColor={conditionColor}
				conditionLabel={conditionLabel}
				isOwner={isOwner}
				isAvailable={isAvailable}
			/>
			<BottomNav />
		</>
	);
}
