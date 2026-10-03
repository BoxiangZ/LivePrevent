# LivePrevent

**AI-assisted home monitoring and alerting for aging in place.**

LivePrevent 是面向老人家属的 AI 居家连续监测 Web 平台（MVP 为 B2C，B2B 为 Phase 2）。通过智能手表、摄像头等设备持续观察老人的活动与基础健康参数，学习每位老人自己的"正常基线"，在出现高风险事件或长期异常趋势时，通过 Web Dashboard 与多通道警报（Email / SMS / Push）通知联系人，并提供可解释的事件说明。

> **能力边界声明**：LivePrevent 是辅助监测与提示工具。不提供医疗诊断，不替代医生判断；不替代紧急呼叫服务（如 999 / 911）；可能出现漏报和误报；不承诺"预防"任何疾病或事件，只承诺"更早发现异常、更快通知相关的人"。

## 核心交付（MVP）

- **个人基线异常检测** — 对比"这位老人自己的正常"，发现缓慢变化
- **分级警报** — Stable / Watch / Important / Critical 四级，全产品统一
- **多通道通知与升级链** — Critical 不依赖单一 Email；T+5 / T+15 / T+30 逐级升级
- **可解释的事件复核** — 支持信号、基线对比、30/90 天趋势、AI 摘要（Kimi，仅基于结构化事实）
- **隐私与同意机制** — 老人是同意主体，可随时撤销；摄像头默认端侧处理

## 仓库结构

```
LivePrevent/
├── README.md          # 本文件
├── START.md           # 开发启动指南（必读，含运行与 Demo 操作步骤）
├── docs/
│   └── PRD.md         # 产品需求文档 v0.2（Web 版 MVP）
├── src/
│   ├── types/         # 数据模型（风险/事件/基线/同意/设备/警报/JEV/审计/账户）
│   ├── lib/           # JEV 决策 · 升级链 · 通知模板 · Kimi 摘要 · Demo 引擎
│   ├── data/          # 合成数据集（确定性 PRNG，reset 后可复现）
│   ├── components/    # RiskBadge / CriticalBanner / TrendChart / EscalationTimeline …
│   └── app/           # PRD §11 页面 + 事件详情 + 安全链接落地页 + API 路由
```

## 快速开始

```bash
npm install
cp .env.example .env.local   # KIMI_API_KEY 可留空（自动模板降级）
npm run dev                  # http://localhost:3000
```

详见 [START.md](./START.md)（含 Demo 演示操作步骤）。

## 文档

- [PRD v0.2（Web 版 MVP）](./docs/PRD.md) — 产品定位、风险等级体系、检测判定逻辑、警报链路、隐私合规、Demo 脚本等完整内容

## 非目标（MVP 不做）

不提供医疗诊断 / 治疗建议；不自动呼叫紧急服务；不提供摄像头实时画面远程查看；不做医院多租户与 EHR 对接；不做老人侧 App。完整清单见 PRD 第 15 节。

## 定位一句话

> Families pay for peace of mind and a reliable way to respond. Care providers (next) pay for monitoring efficiency.
