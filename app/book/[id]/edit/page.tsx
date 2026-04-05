import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BookEditClient from "./BookEditClient";

type BookForEdit = {
	id: string;
	owner_id: string;
	title: string;
	authors: string | null;
	publisher: string | null;
	isbn: string | null;
	thumbnail_url: string | null;
	user_images: string[];
	user_review: string | null;
	condition: string;
	status: string;
	book_libraries: Array<{
		library_id: string;
		libraries: { id: string; name: string } | null;
	}>;
};

async function getBookForEdit(
	supabase: Awaited<ReturnType<typeof createClient>>,
	bookId: string,
): Promise<BookForEdit | null> {
	const { data, error } = await supabase
		.from("books")
		.select(
			`
			id, owner_id, title, authors, publisher, isbn, thumbnail_url, user_images, user_review, condition, status,
			book_libraries(library_id, libraries(id, name))
		`,
		)
		.eq("id", bookId)
		.single();

	if (error || !data) return null;
	return data as unknown as BookForEdit;
}

export default async function BookEditPage({
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
	const book = await getBookForEdit(supabase, id);

	if (!book) notFound();
	if (book.owner_id !== user.id) redirect(`/book/${id}`);
	if (book.status !== "AVAILABLE") {
		redirect(`/book/${id}`);
	}

	const libraries = (book.book_libraries ?? [])
		.filter((bl) => bl.libraries != null)
		.map((bl) => ({
			id: bl.libraries!.id,
			name: bl.libraries!.name,
		}));

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col pb-[calc(8rem+env(safe-area-inset-bottom))]">
			<BookEditClient book={book} initialLibraries={libraries} />
			<BottomNav />
		</div>
	);
}
