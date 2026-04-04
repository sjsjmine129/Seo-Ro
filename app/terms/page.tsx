import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";

export const metadata = {
	title: "이용약관 | Seo-Ro",
	description: "서로(Seo-Ro) 이용약관",
};

export default function TermsPage() {
	return (
		<>
			<div className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<div className="mb-3">
					<BackButton />
				</div>
				<article className="mx-auto w-full max-w-lg">
					<h1 className="mb-6 text-2xl font-bold text-foreground">
						이용약관
					</h1>
					<div className="space-y-4 text-sm">
						<p className="leading-relaxed text-muted-foreground">
							환영합니다! 본 약관은 '서로(Seo-Ro)'(이하 '회사')가
							제공하는 위치 기반 도서 교환 서비스의 이용과
							관련하여 회사와 회원 간의 권리, 의무 및 책임사항을
							규정함을 목적으로 합니다.
						</p>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							제1조 (서비스의 목적 및 성격)
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							회사는 공공도서관을 거점으로 이용자 간에 중고 도서를
							상호 교환할 수 있도록 매칭해 주는 온라인 플랫폼을
							제공합니다.{" "}
							<strong>
								회사는 도서의 소유자나 판매자가 아니며, 교환
								당사자 간의 거래에 개입하지 않습니다.
							</strong>
						</p>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							제2조 (회원의 의무 및 교환 규칙)
						</h2>
						<ul className="leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
							<li>
								회원은 본인이 합법적으로 소유하고 있는 도서만을
								플랫폼에 등록해야 합니다.
							</li>
							<li>
								회원은 도서의 상태를 사실대로 기재해야 하며,
								훼손이 심하거나 교환이 불가능한 도서를
								등록해서는 안 됩니다.
							</li>
							<li>
								금전적 요구, 상업적 판매, 불법 복제물 및 유해
								매체물의 교환은 엄격히 금지됩니다.
							</li>
							<li>
								회원은 교환 약속(시간 및 장소)을 성실히 이행해야
								하며, 노쇼(No-show) 시 서비스 이용이 제한될 수
								있습니다.
							</li>
						</ul>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							제3조 (회사의 면책)
						</h2>
						<ul className="leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
							<li>
								<strong>
									회사는 플랫폼 내에서 회원이 게재한 도서
									정보의 정확성, 신뢰성 및 교환되는 도서의
									품질이나 상태에 대해 어떠한 보증도 하지
									않으며, 이로 인해 발생하는 손해에 대해
									책임지지 않습니다.
								</strong>
							</li>
							<li>
								<strong>
									회사는 온라인 플랫폼만 제공할 뿐, 오프라인
									교환 과정(이동, 만남 등)에서 발생하는 회원
									간의 분쟁, 신체적/정신적/물질적 피해, 사고,
									범죄 등에 대하여 일체의 책임을 지지
									않습니다.
								</strong>{" "}
								오프라인 교환 시 안전에 각별히 유의하시기
								바랍니다.
							</li>
							<li>
								회원 상호 간 또는 회원과 제3자 간에 서비스를
								매개로 발생한 분쟁에 대해 회사는 개입할 의무가
								없으며 이로 인한 손해를 배상할 책임이 없습니다.
							</li>
						</ul>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							제4조 (서비스 이용의 제한 및 중지)
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							회사는 회원이 본 약관의 의무를 위반하거나 서비스의
							정상적인 운영을 방해한 경우(잦은 약속 취소, 노쇼,
							타인에 대한 폭언 및 욕설, 부적절한 이미지 업로드
							등), 사전 통지 없이 해당 회원의 서비스 이용을
							영구적으로 정지하거나 회원 자격을 상실시킬 수
							있습니다.
						</p>

						<h2 className="mt-6 font-semibold text-foreground text-base">
							제5조 (기타)
						</h2>
						<p className="leading-relaxed text-muted-foreground">
							본 약관에 명시되지 않은 사항은 관련 법령 및 상관례에
							따르며, 회사와 회원 간에 발생한 분쟁에 관한 소송은
							회사의 본점 소재지를 관할하는 법원을 전속
							관할법원으로 합니다.
						</p>
					</div>
				</article>
			</div>
			<BottomNav />
		</>
	);
}
