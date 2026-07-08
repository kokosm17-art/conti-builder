"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UserRow {
  uid: string;
  email: string;
  createdAt?: Timestamp;
  sessionCount: number;
  contiGenCount: number;
  contiEditCount: number;
  designGenCount: number;
  sectionRegenCount: number;
  designEditCount: number;
  lastActivity?: Timestamp;
}

export default function AdminUsagePage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [user, authLoading]);

  async function load() {
    try {
      const [usersSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "sessions")),
      ]);

      const rowsByUid = new Map<string, UserRow>();
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        rowsByUid.set(d.id, {
          uid: d.id,
          email: data.email ?? "-",
          createdAt: data.createdAt,
          sessionCount: 0,
          contiGenCount: 0,
          contiEditCount: 0,
          designGenCount: 0,
          sectionRegenCount: 0,
          designEditCount: 0,
        });
      });

      let active = 0;
      sessionsSnap.docs.forEach((d) => {
        const data = d.data();
        const uid = data.userId as string;
        let row = rowsByUid.get(uid);
        if (!row) {
          row = {
            uid,
            email: "(알수없음)",
            sessionCount: 0,
            contiGenCount: 0,
            contiEditCount: 0,
            designGenCount: 0,
            sectionRegenCount: 0,
            designEditCount: 0,
          };
          rowsByUid.set(uid, row);
        }
        row.sessionCount += 1;
        row.contiGenCount += data.contiGenCount ?? 0;
        row.contiEditCount += data.contiEditCount ?? 0;
        row.designGenCount += data.designGenCount ?? 0;
        row.sectionRegenCount += data.sectionRegenCount ?? 0;
        row.designEditCount += data.designEditCount ?? 0;
        const createdAt = data.createdAt as Timestamp | undefined;
        if (createdAt && (!row.lastActivity || createdAt.toMillis() > row.lastActivity.toMillis())) {
          row.lastActivity = createdAt;
        }
        if (data.status === "active") active += 1;
      });

      const allRows = Array.from(rowsByUid.values());
      allRows.sort((a, b) => (b.lastActivity?.toMillis() ?? 0) - (a.lastActivity?.toMillis() ?? 0));

      setRows(allRows);
      setTotalSessions(sessionsSnap.size);
      setActiveSessions(active);
    } catch (err) {
      console.error("이용 현황 조회 실패:", err);
      setError(err instanceof Error ? err.message : "이용 현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 animate-pulse font-semibold text-center py-20">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="font-black text-gray-900">이용 현황을 불러오지 못했습니다.</p>
        <p className="text-xs text-gray-400 font-mono break-all max-w-md">{error}</p>
      </div>
    );
  }

  const totalUsers = rows.length;
  const totalGenerations = rows.reduce(
    (sum, r) =>
      sum +
      r.contiGenCount +
      r.contiEditCount +
      r.designGenCount +
      r.sectionRegenCount +
      r.designEditCount,
    0
  );

  return (
    <div>
      {/* 전체 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-3xl font-black text-gray-900">{totalUsers}</div>
          <div className="text-xs text-gray-400 mt-1">총 가입자</div>
        </div>
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-3xl font-black text-gray-900">
            {totalSessions}
            <span className="text-sm text-gray-400 font-semibold"> ({activeSessions} 진행중)</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">총 세션</div>
        </div>
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-3xl font-black text-blue-600">{totalGenerations}</div>
          <div className="text-xs text-gray-400 mt-1">총 생성/수정 횟수</div>
        </div>
      </div>

      {/* 계정별 통계 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3 font-semibold">이메일</th>
              <th className="px-4 py-3 font-semibold text-right">세션 수</th>
              <th className="px-4 py-3 font-semibold text-right">콘티 재생성</th>
              <th className="px-4 py-3 font-semibold text-right">콘티 수정</th>
              <th className="px-4 py-3 font-semibold text-right">디자인 재생성</th>
              <th className="px-4 py-3 font-semibold text-right">섹션 재생성</th>
              <th className="px-4 py-3 font-semibold text-right">디자인 수정</th>
              <th className="px-4 py-3 font-semibold text-right">최근 활동</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uid} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 text-gray-800">{row.email}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.sessionCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.contiGenCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.contiEditCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.designGenCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.sectionRegenCount}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.designEditCount}</td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">
                  {row.lastActivity
                    ? new Date(row.lastActivity.toMillis()).toLocaleDateString("ko-KR", {
                        year: "numeric", month: "short", day: "numeric",
                      })
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p>아직 가입자가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
