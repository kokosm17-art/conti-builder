"use client";

interface PaymentGateModalProps {
  onClose: () => void;
}

export function PaymentGateModal({ onClose }: PaymentGateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💳</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">
            콘티+디자인을 계속 만들려면<br />결제가 필요해요
          </h2>
          <p className="text-sm text-gray-500">
            무료 체험은 1회 제공됩니다.<br />
            계속 이용하시려면 아래 서비스를 선택해 결제해 주세요.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 text-sm">콘티 생성</div>
              <div className="text-xs text-gray-500 mt-0.5">팔리는 상세페이지 콘티 + 수정 30회</div>
            </div>
            <div className="text-blue-600 font-black text-lg">50,000원</div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 text-sm">디자인 자동화</div>
              <div className="text-xs text-gray-500 mt-0.5">디자인 생성 + 섹션 재생성 30회</div>
            </div>
            <div className="text-purple-600 font-black text-lg">100,000원</div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            disabled
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl opacity-50 cursor-not-allowed text-sm"
          >
            결제하기 (준비 중)
          </button>
          <p className="text-xs text-center text-gray-400">결제 기능은 곧 오픈됩니다</p>
          <button
            onClick={onClose}
            className="w-full border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
