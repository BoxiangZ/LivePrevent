# START — LivePrevent 开发启动指南

> 面向新加入的开发者 / 黑客松队友。先读完本文，再按需查阅 [PRD](./docs/PRD.md)。

## 1. 项目是什么

LivePrevent 是 AI 居家老人监测与警报 Web 平台（MVP：B2C 家属版）。

核心链路（也是 Demo 要展示的完整闭环）：

```
Detection → AI Decision (JEV) → Multi-channel Alert → Escalation
        → Acknowledge → Review (Kimi 摘要 + 趋势) → Resolve
```

## 2. 必读的 PRD 章节

| 场景 | 章节 |
|---|---|
| 产品定位与合规口径 | PRD §1、§1.1（能力边界声明，对外文案必须遵守） |
| 风险四级体系 | PRD §3（Stable / Watch / Important / Critical） |
| 检测与判定逻辑 | PRD §5（冷启动、跌倒两阶段判定、JEV 等级规则） |
| 警报与升级链 | PRD §6（通道、T+5/T+15/T+30 升级、状态机） |
| 通知内容规范 | PRD §7（最小化原则，邮件/短信不含健康数据） |
| 隐私与权限 | PRD §8（同意流程、权限矩阵、数据保留） |
| AI 架构与 Kimi 边界 | PRD §10（**JEV 定等级，Kimi 只摘要，不判定**） |
| 页面清单 | PRD §11（Login/Onboarding、Overview、Elder Detail、Alerts、Settings） |
| Demo 脚本 | PRD §19（黑客松演示流程） |

## 3. 系统架构（目标形态）

```
Smartwatch + Camera (+ device heartbeat)
        ↓
Data Layer（清洗、对齐、数据质量标记）
        ↓
Personal Baseline（含冷启动与异常排除）
        ↓
JEV — Risk Decision（风险概率 + 等级规则；唯一决定风险等级）
        ↓
Alert Engine（通道、升级、状态机）──→ 立即发送模板通知（不等 Kimi）
        ↓
Kimi — 结构化事实摘要生成（可降级到模板）
        ↓
Web Dashboard（事件详情、趋势、摘要）
```

三条铁律：

1. **Critical 警报不得只依赖 Email**，也不依赖 Kimi——模板即时发送。
2. **Kimi 不参与风险判定**，只把 JEV 的结构化事实写成人话；数值校验失败则丢弃，降级为模板。
3. **通知最小化**：邮件 / 短信不含具体健康数据（心率数值、百分比等），详情登录后看。

## 4. 关键设计决策（速查）

- **风险四级**：Stable 🟢 / Watch 🟡 / Important 🟠 / Critical 🔴，Dashboard 与通知统一用这套。
- **跌倒两阶段判定**：Possible Fall → 3 分钟恢复观察窗（Demo 加速为 10 秒）→ 有恢复降 Watch / 无恢复升 Critical。
- **JEV 决策规则（初始值）**：p(critical) ≥ 0.60 且 ≥2 独立信号 → Critical；单信号封顶 Important 等佐证。
- **升级时间线（初始值）**：T+0 联系人 #1（Email+SMS+Push）→ T+5min #2 → T+15min 全员 → T+30min 标记 Unacknowledged 并每 15 分钟重复提醒。Critical 不受静音时段限制。
- **警报状态机**：Open → Acknowledged → Resolved；Watch/Important 可 Auto-expire；Critical 必须人工 Resolve。
- **冷启动**：基础指标 14 天 / 睡眠趋势 28 天；学习期只开跌倒检测、设备离线、保守通用阈值。
- **设备离线也是事件**：单设备 >2h = Watch；全数据源 >4h = Important（Data gap），并抑制基于该设备的误报。
- **隐私**：老人是同意主体，可撤销、可暂停；摄像头默认端侧处理，不上传视频；发给 Kimi 的内容去标识化。

## 5. Demo 实现要点（黑客松）

- 使用**模拟数据**：合成 30 天历史 + 注入事件（摄像头疑似跌倒 + 手表冲击 + 心率偏离），不涉及真实个人数据。
- Demo 时间轴加速：恢复观察窗 3 分钟 → 10 秒；升级 T+5 分钟 → 相应加速。
- 开场必须声明："本 Demo 使用模拟输入与合成数据，不代表真实检测精度。"
- 页面最小集：Overview（含数据新鲜度、基线学习进度）、Alerts（横幅 + Acknowledge/Resolve/标记误报）、事件详情（支持信号 + 基线对比 + 趋势 + Kimi 摘要）、Patient Risk Board（B2B 预览，静态即可）。
- 邮件模板按 PRD §7.2，附免责声明。

## 6. 仓库结构（随开发更新）

```
LivePrevent/
├── README.md               # 项目门面
├── START.md                # 本文件
├── docs/
│   └── PRD.md              # PRD v0.2
├── src/
│   ├── types/              # 数据模型（风险/事件/基线/同意/设备/警报/JEV/审计/账户/视图）
│   ├── lib/
│   │   ├── constants.ts    # PRD 全部初始值（阈值、升级时间线、保留期、Demo 加速）
│   │   ├── labels.ts       # 事件/等级/状态标签（通知模板与 Dashboard 共用）
│   │   ├── jev/            # JEV 决策（decide.ts）+ 结构化事实构建（facts.ts）
│   │   ├── alerts/         # 升级链纯函数（escalation.ts）+ 通知模板（templates.ts）
│   │   ├── llm/kimi.ts     # Kimi 摘要（数值校验 + 模板降级，永不阻塞警报链）
│   │   └── demo/           # 内存 store + 懒求值引擎 + 事件注入 + 状态快照
│   ├── data/seed.ts        # 合成数据集（"Mum" + 30 天趋势 + 历史事件，确定性 PRNG）
│   ├── components/         # RiskBadge / CriticalBanner / TrendChart / EscalationTimeline 等
│   └── app/
│       ├── overview|alerts|settings|login|board/   # PRD §11 页面
│       ├── elders/[id]/    # Elder Detail
│       ├── events/[id]/    # 事件详情复核页（Demo 步骤 7）
│       ├── ack/[token]/    # Critical 一次性安全链接落地页
│       └── api/            # demo/state|inject|reset|pause、alerts/[id]/ack|resolve、kimi/summary
```

## 6.5 运行（团队上手）

```bash
npm install
cp .env.example .env.local   # 然后找队友拿 KIMI_API_KEY 填进去；不填也能跑（自动走模板降级）
npm run dev                  # http://localhost:3000
```

- **没有 Kimi key 也能完整演示**：`src/lib/llm/kimi.ts` 在 key 缺失 / 超时 / 校验失败时自动降级为模板摘要（PRD §10.3），页面会标注"模板降级"。
- 想强制离线排练：`.env.local` 里设 `DEMO_KIMI_OFFLINE=1`。
- `.env.local` 已在 .gitignore，**任何 key 都不进 git**；团队共享受限 key 走私信，勿发群聊明文。
- Demo 状态为服务端内存存储（`globalThis` 单例），**重启 dev server 会清空** — 演示前点底部 Demo 条的 "Reset demo" 即可回到初始合成数据。

### Demo 操作（PRD §19）

1. 底部常驻 Demo 条：点 **"⚡ Inject fall"** 注入模拟跌倒（摄像头姿态 + 手表冲击 + 心率偏离）
2. 观察 Overview 顶部：先出现 🟠 恢复观察窗倒计时（10 秒，封顶 Important — PRD §5.2/§5.3）
3. 窗内无恢复 → 自动升级 🔴 Critical，全局红色横幅出现，联系人 #1（Alex）收到模拟 Email+SMS+Push
4. 不点确认，等 ~17 秒（T+5min ÷ 18×）→ 升级通知联系人 #2（Mrs. Chan）
5. 在 Alerts 页的通知卡片里点 **"Review & Acknowledge"** 安全链接 → 以 Mrs. Chan 身份确认 → 进入事件详情页复核（信号 / 基线对比 / 30 天趋势 / Kimi 摘要）
6. Resolve 选择原因（如"真实事件已处理"）→ 写入审计日志

## 7. 下一步（建议顺序）

1. 定技术栈与仓库骨架（前端 / 后端 / 模拟数据管线）✅ Next.js 15 + Tailwind + 内存 Demo store
2. 定义数据模型：事件、基线、联系人、警报状态机、审计日志 ✅ `src/types/`
3. 实现模拟数据注入 + JEV 决策规则（PRD §5.3）✅ `src/lib/jev/` + `src/lib/demo/`
4. 实现警报引擎：模板通知 + 升级链 ✅ `src/lib/alerts/`（通知为模拟渲染，未接真实服务商）
5. Web Dashboard 五个页面（PRD §11）✅ + Elder Detail + 事件详情 + Board 预览
6. 接入 Kimi 摘要（含数值校验与模板降级）✅ `src/lib/llm/kimi.ts`
7. 排练 Demo 脚本（PRD §19）← 现在这一步

## 8. 待决策事项

技术实现相关的待决策点（完整清单见 PRD §17）：硬件品牌 / 型号支持、摄像头端侧方案、SMS / 推送服务商、数据保留与处理地域、价格。开发期间遇到这些范围的问题，先按 PRD 初始值假设推进，不要阻塞。
