import { JoinForm } from "@/components/join-form";

/// 초대 코드 교환 화면 (설계 10-3).
///
/// **`proxy.ts` 의 matcher 에서 이 경로만 빠져 있다.** 안 빼면 로그인이 필요한
/// 화면으로 판정돼 자기 자신에게 리다이렉트된다.
///
/// `AppShell` 을 안 쓴다 — 아직 계정이 없는 사람에게 목록 · 어드민 이동을 보여줄 이유가 없다.
export const dynamic = "force-dynamic";

export default function JoinPage() {
  return <JoinForm />;
}
