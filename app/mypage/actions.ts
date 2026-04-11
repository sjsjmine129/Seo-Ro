"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_SIZE_MB = 2;

export type UpdateUserProfileResult = {
	nickname: string;
	profileImageUrl: string | null;
};

export async function updateUserProfile(
	nickname: string,
	profileImageFile: File | null,
): Promise<UpdateUserProfileResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	const trimmedNickname = nickname.trim();
	if (!trimmedNickname) {
		throw new Error("닉네임을 입력해 주세요.");
	}

	let profileImageUrl: string | null = null;

	if (profileImageFile && profileImageFile.size > 0) {
		if (profileImageFile.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
			throw new Error(`프로필 이미지는 ${MAX_AVATAR_SIZE_MB}MB 이하여야 합니다.`);
		}
		const ext = profileImageFile.name.split(".").pop() || "jpg";
		const path = `${user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from(AVATARS_BUCKET)
			.upload(path, profileImageFile, {
				contentType: profileImageFile.type,
				upsert: true,
			});

		if (uploadError) {
			console.error("Avatar upload error:", uploadError);
			throw new Error(`프로필 이미지 업로드 실패: ${uploadError.message}`);
		}

		const { data: urlData } = supabase.storage
			.from(AVATARS_BUCKET)
			.getPublicUrl(path);
		profileImageUrl = urlData.publicUrl;
	}

	const updatePayload: { nickname: string; profile_image?: string | null } = {
		nickname: trimmedNickname,
	};
	if (profileImageFile) {
		updatePayload.profile_image = profileImageUrl;
	}

	const { error } = await supabase
		.from("users")
		.update(updatePayload)
		.eq("id", user.id);

	if (error) {
		console.error("Profile update error:", error);
		throw new Error(`프로필 업데이트 실패: ${error.message}`);
	}

	const { data: fresh, error: freshErr } = await supabase
		.from("users")
		.select("nickname, profile_image")
		.eq("id", user.id)
		.single();

	revalidatePath("/mypage");

	if (freshErr || !fresh) {
		return {
			nickname: trimmedNickname,
			profileImageUrl: profileImageUrl,
		};
	}

	return {
		nickname: fresh.nickname ?? trimmedNickname,
		profileImageUrl: fresh.profile_image ?? null,
	};
}
