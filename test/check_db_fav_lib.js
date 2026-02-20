// test/check_db.js
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111";
if (!supabaseUrl || !supabaseKey) {
	console.error(
		"❌ 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.",
	);
	process.exit(1);
}

// Supabase 클라이언트 초기화
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
	console.log("🔌 Supabase DB 연결 테스트를 시작합니다...\n");

	try {
		const { data, error, count } = await supabase
			.from("user_interested_libraries")
			.select("library_id, libraries (id, name)")
			.eq("user_id", MOCK_USER_ID);

		if (error) {
			throw error;
		}

		console.log(`✅ DB 연결 성공! (총 ${count}개의 데이터가 존재합니다)`);
		console.log("\n📚 [샘플 데이터]");
		console.table(data);
	} catch (error) {
		console.error("❌ DB 조회 중 에러가 발생했습니다:");
		console.error(error.message);
	}
}

runTest();
