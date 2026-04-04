import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";

export const metadata = {
	title: "개인정보처리방침 | Seo-Ro",
	description: "서로(Seo-Ro) 개인정보처리방침",
};

export default function PrivacyPage() {
	return (
		<>
			<div className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<div className="mb-3">
					<BackButton />
				</div>
				<article className="mx-auto w-full max-w-lg">
					<h1 className="mb-6 text-2xl font-bold text-foreground">
						개인정보처리방침
					</h1>
					<div className="space-y-4 text-sm">
						<p className="leading-relaxed text-muted-foreground">
							'서로(Seo-Ro)'(이하 '회사')는 이용자의 개인정보를
							중요시하며, "개인정보보호법" 등 관련 법령을 준수하고
							있습니다. 본 개인정보처리방침을 통하여 회사가
							이용자로부터 제공받는 개인정보가 어떠한 용도와
							방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한
							조치가 취해지고 있는지 알려드립니다.
						</p>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							1. 수집하는 개인정보 항목 및 수집 방법
						</h2>
						<ul className="leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
							<li>
								<strong>필수 수집 항목:</strong> 이메일 주소,
								닉네임, 프로필 사진
							</li>
							<li>
								<strong>
									서비스 이용 과정에서 자동으로 수집되는 항목:
								</strong>{" "}
								관심 도서관(위치 기반 데이터), 서비스 이용 기록,
								접속 로그, 쿠키, 기기 정보(푸시 알림용 토큰)
							</li>
							<li>
								<strong>수집 방법:</strong> 회원가입, 서비스
								이용 중 이용자의 자발적 제공 및 시스템 자동 수집
							</li>
						</ul>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							2. 개인정보의 수집 및 이용 목적
						</h2>
						<ul className="leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
							<li>
								<strong>회원 관리:</strong> 회원제 서비스 이용에
								따른 본인확인, 불량 회원의 부정 이용 방지, 가입
								의사 확인
							</li>
							<li>
								<strong>서비스 제공:</strong> 도서관 기반 도서
								교환 매칭, 교환 약속 알림(푸시 알림 등), 책장
								점수(매너 평가) 관리
							</li>
							<li>
								<strong>고충 처리:</strong> 민원인의 신원 확인,
								민원사항 확인, 처리결과 통보
							</li>
						</ul>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							3. 개인정보의 제3자 제공
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							회사는 원칙적으로 이용자의 개인정보를 제3자에게
							제공하지 않습니다. 단, 원활한{" "}
							<strong>
								도서 교환 서비스(매칭 및 약속 잡기) 제공을 위해
								교환이 성사된 상대방 회원에게 귀하의 '닉네임'이
								공개
							</strong>
							됩니다.
						</p>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							4. 개인정보의 보유 및 이용 기간
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							이용자의 개인정보는 원칙적으로 개인정보의 수집 및
							이용목적이 달성되면 지체 없이 파기합니다. 단, 다음의
							정보에 대해서는 아래의 이유로 명시한 기간 동안
							보존합니다.
						</p>
						<ul className="leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
							<li>
								<strong>보존 항목:</strong> 부정이용기록 및
								서비스 이용기록(교환 내역 등)
							</li>
							<li>
								<strong>보존 이유:</strong> 이용자 간 분쟁 해결,
								노쇼 등 서비스 부정 이용 방지
							</li>
							<li>
								<strong>보존 기간:</strong> 회원 탈퇴 후 6개월
							</li>
						</ul>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							5. 이용자의 권리와 그 행사 방법
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							이용자는 언제든지 등록되어 있는 자신의 개인정보를
							조회하거나 수정할 수 있으며, 서비스 탈퇴를 요청할 수
							있습니다. 개인정보 조회, 수정, 탈퇴는 앱 내
							'마이페이지'의 기능을 통하여 가능합니다.
						</p>
					</div>
				</article>
			</div>
			<BottomNav />
		</>
	);
}
