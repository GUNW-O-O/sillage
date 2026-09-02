import { listAccounts, listInviteCodes } from "@/app/actions";
import { AccountAdmin } from "@/components/account-admin";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, codes] = await Promise.all([listAccounts(), listInviteCodes()]);

  return (
    <main className="max-w-[1000px]">
      <h1 className="font-serif text-[26px] text-ink">계정</h1>
      <p className="mt-2 mb-6 text-[13px] text-muted">
        초대 코드는 6자리 · 24시간 · 1회용이다. 어드민이 발급해 직접 건넨다 (요구 FR-10).
        코드를 받을 사람의 이름을 적어 발급하면 그 이름이 새 계정의 표시명이 된다.
      </p>
      <AccountAdmin accounts={accounts} codes={codes} />
    </main>
  );
}
