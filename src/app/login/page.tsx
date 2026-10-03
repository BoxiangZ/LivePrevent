"use client";

/**
 * Login / 角色选择 — PRD §11 #1（黑客松简化版）
 * 选择角色进入 Demo；角色决定权限矩阵的可见操作（PRD §8.3）。
 * 真实版本需注册、2FA、老人同意与授权流程（PRD §8.1）。
 */

import { useRouter } from "next/navigation";

const ROLE_CARDS = [
  {
    role: "primary_family",
    title: "Alex — 主家属（儿子，旧金山）",
    desc: "付费账户持有人：确认/处理警报、管理联系人与订阅、邀请成员",
  },
  {
    role: "family_member",
    title: "其他家属",
    desc: "查看状态与事件、确认/处理警报；不可修改订阅",
  },
  {
    role: "caregiver",
    title: "护理员（Phase 2 完整支持）",
    desc: "经授权查看部分数据、确认/处理警报",
  },
];

export default function LoginPage() {
  const router = useRouter();

  const enter = (role: string) => {
    document.cookie = `lp_role=${role}; path=/; max-age=86400`;
    router.push("/overview");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          Live<span className="text-indigo-600">Prevent</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          AI-assisted home monitoring and alerting for aging in place.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-gray-400">
          辅助监测与提示工具：不提供医疗诊断，不替代医生判断；不替代紧急呼叫服务；可能出现漏报和误报。
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-center text-xs font-medium uppercase tracking-wide text-gray-400">
          选择角色进入 Demo（黑客松简化登录）
        </div>
        {ROLE_CARDS.map((c) => (
          <button
            key={c.role}
            onClick={() => enter(c.role)}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:shadow-sm"
          >
            <div className="font-semibold text-gray-900">{c.title}</div>
            <div className="mt-0.5 text-xs text-gray-500">{c.desc}</div>
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-gray-100 p-3 text-center text-[11px] text-gray-400">
        真实版本的 Onboarding 包含：老人同意与授权记录、设备绑定、摄像头覆盖地图、联系人链设置（PRD §8 / §11 #1）
      </div>
    </div>
  );
}
