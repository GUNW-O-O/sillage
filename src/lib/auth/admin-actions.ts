/// 어드민 전용 서버 액션 명단. **가드가 붙었는지를 이 명단으로 검사한다**
/// (`admin-actions.test.ts`). 어드민 액션을 새로 만들면 여기에 이름을 더한다 —
/// 안 더하면 검사가 그 액션을 아예 안 본다.
///
/// `updateProductName` · `updateProductAttributes` · `updateSellerNote` 는 **여기 없다.**
/// 원두 상세에서 사용자가 고치는 경로다 (설계 4-1).
export const ADMIN_ACTIONS = [
  // 미매핑
  "listUnmappedNotes",
  "attachNote",
  "deleteNote",
  "deleteExtraNote",
  // 승인 · 기각
  "listPending",
  "approveVendor",
  "approveLookup",
  "approveVendorWith",
  "approveLookupWith",
  "approveLookupEdited",
  "rejectVendor",
  "rejectLookup",
  // 병합
  "mergeVendor",
  "mergeLookup",
  // 직접 생성
  "createVendorApproved",
  "createLookupApproved",
  "createFlavorNodeL2",
  "createNodeAndAttach",
  // 별칭
  "remapAlias",
  "unmapAlias",
  // 목록 · 통계
  "adminStats",
  "listFlavorTree",
  "listFlavorTreeDetailed",
  "listVendorsAdmin",
  "listLookupsAdmin",
  "listLookupsByKind",
  "listApprovedVendors",
  // 노트 제안 · 원두 노트 (이미 걸려 있던 것)
  "listNoteProposals",
  "approveNoteProposal",
  "rejectNoteProposal",
  "getAdminProduct",
  "addSellerNote",
  "deleteSellerNote",
] as const;
