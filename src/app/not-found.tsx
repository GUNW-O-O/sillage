import Link from "next/link";

import { NoticePage, noticeButton } from "@/components/notice-page";

/// 없는 주소 전부가 여기로 온다. **어드민 레이아웃의 `notFound()` 도 마찬가지다** —
/// admin 세그먼트에 not-found 를 따로 두지 않으므로 루트인 이 화면이 쓰인다.
/// 어드민이 아닌 사람에게 403 대신 404 를 주기로 한 판단이 여기에 걸려 있다 (설계 4-2).
export default function NotFound() {
  return (
    <NoticePage title="찾는 페이지가 없어요" body="주소가 바뀌었거나 지워진 페이지예요.">
      <Link href="/" className={noticeButton}>
        목록으로
      </Link>
    </NoticePage>
  );
}
