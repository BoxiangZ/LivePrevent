# LivePrevent 产品体验、前后端 API 与分析服务设计

**日期：** 2026-10-03  
**状态：** 设计基线；桌面端、v3 契约与样例分析流程已实现，等待成品验收。  
**范围：** 家属桌面端、客户端与服务端接口契约、样例数据导入、可选样例视频、分析结果、告警与设置。手机端暂不做。  
**依据：** 用户提供的 `/demo-studio` 截图、当前分支代码、`docs/PRD.md`、`docs/API_CONTRACTS.md`；原 UI/UX 与接口审查的有效内容已合并至本文附录。

## 文档使用说明

**本文是本轮 UI/UX 简化、资料上传及多模态分析改造的唯一设计入口，已按用户指示进入实现，等待成品验收。** 正文描述目标方案，附录记录改造前的问题与验收场景；附录中的旧页面名称和接口路径仅用于定位现有实现，不是另一套开发方案。

- `PRD.md`：保留产品背景与业务规则；本轮导航、样例来源展示及可选视频上传的调整以本文为准。未涉及的业务规则继续参考 PRD。
- `API_CONTRACTS.md`：记录当前 v3 正式实现契约、逐页字段映射和验证方式。共享运行时 schema 是字段定义的唯一来源。
- 原 `UI_UX_API_REVIEW.md` 已合并并删除，无需同时遵循两份设计分析文档。

## 1. 本次改变与核心判断

产品应让家属快速完成两件事：**查看当前情况并处理告警**，以及**提交一份观察资料并查看分析**。技术演示参数不应占据家属界面。当前截图以「Demo I/O」「Simulated data」「synthetic observation」「No raw video is accepted」作为首屏信息，还要求填写 `camera_posture`、`possible_fall` 与四个概率；普通用户很难理解，也不像可上线的产品。

新版界面使用正式产品的导航、文案和结果表达；同时在**资料选择、提交前确认和每份结果的来源位置**如实标明样例资料。不能把样例记录包装成真实连续监测、真实通知送达或临床判断。来源提示应靠近相关数据，以低视觉权重出现，不使用全站醒目的「Simulated data」徽标。

用户新增的**可选样例视频上传**是本版目标。仓库内 PRD v0.2 的「原始视频不上传」与现有页的「No raw video is accepted」反映的是旧设计；若采纳本版，需同步修订 PRD、隐私文案与接口契约。样例视频先限定为用户主动提交的单次资料；真实居家视频与持续采集另行设计授权与数据治理。产品不作疾病诊断。

## 2. 截图逐项修改

| 目前位置/内容 | 问题 | 目标方案与建议英文文案 |
| --- | --- | --- |
| 顶栏六项：Overview / Alerts / Demo I/O / Person details / Care Network / Settings | 同级入口过多；按技术模块而非任务组织 | `Overview / Alerts / Assessments / Settings`；Person 选择器始终在右侧。Person details 由 Overview 的「View history」进入；Care Network 归入 Settings。 |
| 顶栏 `Simulated data` 徽标 | 抢占视觉注意，页面像内部测试台 | 移除全站徽标。工作区/数据来源说明放在 Person 菜单内；样例来源在相关状态卡、导入区、结果卡和历史记录中逐条显示。 |
| 全站黄色 stale banner 出现在分析页 | 上传历史资料与实时设备新鲜度是两种信息，混放会误导 | 仅在 Overview/Alerts 或确实影响当前告警时显示设备问题；分析页显示本次资料的采集时间与完整度。 |
| `Demo input and output` 与解释文字 | 技术视角；否定视频上传 | 页面名 `New assessment`，说明「Add observations and, if available, a short video clip. Review the findings after analysis.」 |
| `Input · Margaret Chan` | 重复暴露选中者姓名，且切人后信息密集 | 卡片标题 `Information to review`；其下简短显示「For selected person」与选择器联动。姓名只在选择器/必要的确认层出现，不在每个模块硬编码。 |
| Preset + Event type | 两层选择重复；暴露机器枚举 | 普通模式只选「What would you like reviewed?」：Possible fall / Reduced activity / Heart rate change / General check。样例场景可用「Use example」填充，不作为必经步骤。 |
| Signals 两列自由编辑 | 原始字段名难理解，缺少删除、来源与时间 | 「Sensor observations」：上传 CSV/JSON 或点「Add observation」用自然语言字段输入；每条展示类型、时间、来源、值/描述、覆盖情况。可预览、更正、删除。原始字段放 Advanced。 |
| 四个概率、冲突和恢复勾选 | 家属不应手填模型概率或越过业务判定 | 从普通界面移除。数据不足由系统判断；用户可提交「已观察到恢复活动」作为人工观察，必须保留来源与时间。概率与规则只在结果的「How this was assessed」和演示者工具中显示。 |
| 左右各一半，右侧大面积空白 | 未提交时空结果占屏，任务路径不清晰 | 单列分步：① 添加资料 ② 核对与分析 ③ 结果。仅分析完成后出现结果和历史入口。桌面可在结果态右侧放证据摘要。 |
| `Submit observation` | 用户不知接下来会发生什么 | 主按钮 `Analyze information`；处理中显示上传/分析进度，可返回列表、失败可重试。 |
| Output 显示 rule、event ID、alert ID | 操作结果技术化 | 顶部先给「What we noticed」「Current assessment」「Recommended next step」「Data used」；规则、版本和 ID 在可展开详情。 |

### 页面骨架

```text
LivePrevent  Overview  Alerts  Assessments  Settings         Person [选择器]

New assessment                  [About data sources]
Review one set of observations for the selected person.

1  Add information
   Sensor observations  [Upload data] [Add manually] [Use example]
   Video clip · optional [Choose video] [Preview] [Remove]
   Time of observation [自动读取 / 可修正]

2  Review and analyze
   本次资料摘要 + 缺失项提示 + 来源说明
   [Analyze information]

3  Findings（仅有结果后显示）
   当前判断 / 证据 / 不确定性 / 建议行动
   [Open related event] [View assessment history]
   [How this was assessed ▾]
```

首访在 Overview 先看到固定顺序：**当前状态 → 数据是否新鲜 → 下一步行动**。若尚无资料，给「Add information」入口，而不是绿色 Stable。日常回访默认 Overview；用户不需先理解 Assessments 才能处理警报。移动端不在本轮设计范围。

## 3. 两条核心用户流程

### 3.1 家属处理一次告警

选择绑定的 Person → Overview 看到当前状态、设备新鲜度与一个主行动 → 进入 Alerts 的待处理项 → 事件详情先看「发生了什么 / 应做什么 / 谁在处理」→ 点击「I'm responding」→ 补充联系情况 →「Mark resolved」并选择结果（真实事件/误报/设备问题/不确定）→ Overview 与时间线同步更新。无当前设备资料、设备过期和暂停状态不能显示可信的 Stable。

### 3.2 上传资料并得到一次分析

选择 Person → Assessments → New assessment → 上传结构化样例数据或手动添加观察（至少一种）→ **可选**上传样例视频、预览与移除 → 系统核对格式、时间、覆盖范围和来源 → 用户确认这是样例资料 → 分析任务排队/运行 → 展示模型提取的观察、与传感器数据的吻合/冲突、判定等级或「无法判断」、下一步建议 → 用户可查看证据时间点、修正输入后重新分析，或打开关联事件。没有视频时仍完成结构化数据分析；视频失败时若传感器资料足够，明确显示「部分结果」并继续。

## 4. 页面信息层级与交互规则

### Overview

首屏只保留「状态」「数据新鲜度」「下一步」三个主块。状态六态建议：Stable / Watch / Important / Critical / Unable to verify / Paused。数据过期不沿用 Stable 绿色。次屏放近期事件、指标趋势与设备详情入口。样例记录影响的状态旁显示「Based on sample information」，并显示分析时间；不能写成实时监测结论。

### Alerts / Event

列表一行一个事件：等级、发生时间、简短原因、处理状态、主操作。详情首屏为行动，其次才是证据、通知与判定过程。若来源是上传资料，标明「Uploaded information」，列出结构化数据和视频各自参与情况。未产生 alert 的 assessment 仍能查看详情，不出现断链。通知必须区分模拟记录、已发送、送达、失败。

### Assessments

默认列表展示最近分析：创建时间、关联 Person、资料类型（sensor / video）、结果状态、是否样例、处理状态。顶部仅一个主按钮「New assessment」。导入控件给出文件格式说明、样例文件、错误行号；视频给出缩略预览、时长、上传进度、取消、删除和失败重试。运行中不显示空白「Output」卡。结果卡使用自然语言，但必须显示判定时间、数据覆盖、证据来源、可信度/不确定性和建议动作。模型观察与最终规则判定分栏显示，避免用户以为一句模型描述就是已验证的风险等级。

### Settings

按「People & access / Devices & coverage / Care contacts & notifications / Privacy & data」组织。真正可编辑的控件直接保存或有明确保存按钮；只读状态用徽标，不做假开关。引导式 Setup 只用于首次配置。原来的「raw video is never uploaded」等绝对声明必须更新为精确的两种处理路径：自动设备监测默认只上传结构化观察；用户主动提交的视频在告知用途和保存期限后才上传分析。

### 样例工作区的诚实表达

- 顶栏不放样例徽标；Person 菜单内的「Data sources」说明「当前记录用于体验产品流程，不代表真实设备正在监测」。与样例有关的状态卡本身保留小字号来源标签，避免单独浏览 Overview 时误判。
- 导入：示例文件卡标 `Example information`；用户上传的视频标 `Uploaded clip`，不能统一说成「模拟数据」。
- 结果：逐项写 `Source: example sensor data / uploaded sample video` 与时间。若 Kimi 未调用成功，写 `Assessment based on rules` 或 `Text summary unavailable`，不写「AI analyzed」。
- 警报/通知：样例事件产生的是样例工作区状态与模拟通知，不把未发送的消息写成 delivered。这里的来源说明不可隐藏在只供开发者查看的 Advanced 中。

## 5. Kimi 与健康状态分析：现状、目标和边界

| 环节 | 当前仓库 | 本版目标 |
| --- | --- | --- |
| 样例事件概率 | 预设或在 Demo I/O 手填 | 普通用户不输入概率；由版本化的分析/融合组件产生并标注来源。 |
| 风险等级与升级 | 本地 JEV 规则与观察窗 | 保留可审计的决策层；模型提取证据，规则/经验证的分类器决定等级和升级。 |
| Kimi 调用 | `src/server/llm/kimi.ts` 默认 `moonshot-v1-8k`，仅对结构化事实生成文字摘要 | 新增独立的视觉分析适配器，明确配置支持视频的模型，并将结构化传感器事实与视频观察送入融合流程。 |
| 视频 | 无上传、无解析、无结果关联 | 样例视频可选；异步上传、分析、删除；结果有视频证据片段/时间点。 |
| 失败回退 | 摘要走模板 | 视频分析失败可生成传感器资料的部分结果；无可靠资料则显示「无法判断」，不能冒充模型分析。 |

Kimi [官方视觉接口文档](https://platform.kimi.com/docs/guide/use-kimi-vision-model)现已写明部分模型支持视频，并给出 `files.create(..., purpose="video")` 与 `video_url: {url: "ms://<file-id>"}` 的调用方式；[K2.6 文档](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart)也给出视频输入示例。因此目标可以设计为真正的视频理解，而非只写上传 UI。实施前仍要在**当前账号、区域、模型和样例文件**上验证格式、大小、费用与延迟；不能把旧的 `moonshot-v1-8k` 文本摘要调用直接当作视频分析。模型接口/能力随时间变化，集成时再以官方接口和实际请求验证。

建议处理链：`浏览器选择文件 → 服务器签发受限上传 → 私有暂存与校验 → Kimi 视频上传/引用 → 返回可验证的结构化观察（时间点、看见什么、置信/不确定） → 传感器数据按时间对齐 → 决策层判定 → 生成家属可读的说明 → 保存来源、版本与审计`。模型输出要做 schema、证据时间点、禁止凭空数字等校验；输入/输出均记录版本。模型可描述「看到疑似跌倒姿态」，不可单凭视频文案下医学诊断。Critical 通知不等待文字润色完成。

视频可包含高度敏感的居家画面。样例阶段也应限制文件类型、大小和时长，提供上传前告知、访问控制、删除和保留期限；API Key 只在服务端。正式居家视频需要另行确认被监测者同意、撤销、保存位置/期限、谁能查看原片和第三方模型处理安排。UI 隐私承诺必须与实际处理一致。

## 6. 接口先契约：覆盖页面每个事实点

本轮已实现的正式字段、端点、状态机、错误码、限制与逐页覆盖矩阵集中在 [API_CONTRACTS.md](API_CONTRACTS.md)。机器可校验定义位于 `src/shared/contracts/`，前后端共同使用。此处不重复维护另一套目标字段，以免设计与实现分叉。

允许前端派生枚举翻译、日期格式、上传百分比和样式；状态、原因、时间、来源、等级、动作、模型执行结果与通知送达情况由服务端返回。

实现选择：列表在本地工作区返回完整数组，审计分页；暂停/恢复复用 Settings PATCH；移除计划权益/邀请按钮；Setup 复用 Settings，暂不额外维护首次引导；MP4 进行格式、大小和时长校验，病毒扫描与生产级转码隔离尚不具备，不宣称已实现。

## 7. 现有假交互的处置

| 当前控件 | 决定 |
| --- | --- |
| Demo I/O 的概率、规则、预设 | 家属界面移除；保留在独立的演示者/开发者工具，不与真实分析按钮共用。预设概率必须写明是预设。 |
| Settings / Care Network 的假开关 | 改成实际保存流程；暂不能保存的先改为只读状态与「Edit」入口。 |
| `Talk to us`、`Invite provider` 等不可用按钮 | 有真实目标时接通；否则从主路径移除。 |
| 联系人代确认 | 改为当前登录身份确认；演示者角色切换需显式标示。 |
| Reset scenario | 从家属界面移除；演示者工具拆分「重置事件」与「恢复全部样例」，后者说明会清除哪些资料。 |
| 视频 Upload / Delete / Retry | 必须有真实上传状态、后端文件记录、删除和失败恢复；不能只显示本地选中文件名。 |
| 分析结果的「View event」 | 仅当 `eventId` 存在且详情可访问时出现；无警报事件也可打开。 |

## 8. 开发路线与可验收产出

| 阶段 | 产出物 | 验收条件 |
| --- | --- | --- |
| A：契约与场景 | v3 OpenAPI/运行时 schema、逐页字段矩阵、样例/视频/模型/规则来源枚举、错误码与空态样本 | 截图和原型上的每个事实点能对应字段；稳定、过期、暂停、无数据、部分分析、无 alert 事件均有响应样本。 |
| B：主界面简化 | 四项导航、Overview 固定首屏、Alerts/事件详情行动优先、Settings 单一编辑源、样例说明低权重呈现 | 新用户能在 Overview 找到下一步；不见 raw 枚举和概率；没有假的开关；过期不显示 Stable。 |
| C：结构化资料分析 | Assessments 列表/单列表单、CSV/JSON 与手填、解析预览、异步任务、真实结果页 | 不上传视频也可完成一次输入→分析→结果→事件的闭环；错误可定位并重试；Kimi 摘要与规则来源分明。 |
| D：可选视频 | 视频选择/预览/删除、私有上传、Kimi 视频适配器、证据时间点与部分失败处理 | 样例视频可真正进入支持视频的模型；结果能指出视频参与了什么；视频失败不冒充成功；删除后不可再读取。 |
| E：权限与产品化验收 | 登录身份绑定动作、同意与隐私文案、通知状态、可访问性与桌面端走查、端到端场景 | 所有可见操作有实际结果或清晰不可用说明；样例不会误写成真实送达；每个结果可追溯输入、模型与决策版本。 |

## 9. 待验收的设计决定

1. **推荐**将「Demo I/O」替换为产品化的 `Assessments`，家属导航采用四项；技术调试收进演示者工具。
2. **推荐**每次至少提交一条结构化观察或一份结构化数据文件；视频可选，用于补充视觉证据。若将来开放仅视频分析，应另设无传感器交叉验证的判定规则。
3. **推荐**样例视频仅允许主动上传的短片，不改变自动设备监测默认的边缘处理路径；相应更新 PRD 和隐私文案。
4. **推荐**模型负责生成带证据的观察与解释，最终告警等级仍交由可审计的决策层。模型能力不等于临床有效性。
5. 页面沿用目前英文 UI，文案以家属能理解的行动语言为准；中文文档供本次评审。

**实施边界：** 本文件供用户验收，并作为前端、接口与样例服务端实现的共同基线。当前实现仍须按阶段 A 的接口契约补齐测试、错误处理、持久化、安全与部署方案后，才可视为生产级能力。


## 附录 A：现有实现审查与迁移清单

以下为 2026-10-03 对改造前代码的审查记录，保留具体缺口，供实施时逐项核对。目标 UI 与接口命名统一遵循正文第 2–8 节。

### A.1 原型页面数据覆盖审查

标记：**已覆盖** = 现有 API 返回且页面使用；**部分覆盖** = 数据存在但文案/语义/来源不一致；**缺口** = 页面有静态事实、假交互或所需字段没有契约。仅样式标签、时间本地化和颜色可以由前端从明确枚举派生；时间、数值、处理状态、推荐动作、来源、策略必须有后端契约。

| 页面/区块 | 页面展示或操作的数据点 | 当前接口/来源 | 审查结果与目标 |
| --- | --- | --- | --- |
| 全局 Header / Person | 人员 ID、显示标签、别名、各人的未结警报数及等级、当前选择、模拟标志 | `GET /api/demo/state`: `people[]`；选择保存在 localStorage | **部分覆盖**：切人时整份快照清空，选项暂时消失；建议独立 `people` 契约并保持选择器稳定。角色/访问范围尚无服务端校验。 |
| 全局 Critical 横幅 | 事件类型、警报状态、下一升级时间、是否未确认、联系人、确认动作 | `alerts[]`, `contacts[]`, `nowMs` | **部分覆盖**：确认按钮可指定任意联系人；应由服务端身份决定。 |
| Overview 状态 | 当前等级、状态原因、监测暂停、更新时间 | `overallLevel`, `subject.monitoringPaused`, `alerts[]` | **缺口**：缺少统一 `displayStatus`（含 `unknown/stale/paused`）、状态原因与独立 `evaluatedAt`；Stable 当前只看警报。 |
| Overview 数据新鲜度 | 设备在线/佩戴/电量/最近同步、整体 `asOf` 与 stale | `dataStatus`, `deviceDetails[]`, `devices[]` | **部分覆盖**：整体 `asOf` 取最新设备同步时间，但 stale 可由另一设备触发；需逐设备原因、阈值和整体可验证状态。 |
| Overview 下一步 | 建议动作、目标链接、优先级、是否需要处理 | 前端根据 `activeAlerts` 硬编码 | **缺口**：稳定时跳 Demo I/O；应由后端返回与当前状态一致的 `primaryAction`。 |
| Overview 指标/基线/趋势 | 四指标当前值、单位、中位数、P25/P75、相对偏离、状态、解释、7/30/90 天序列 | `metricSummaries[]`, `baselines[]`, `trends` | **已覆盖数据；部分覆盖解释**：解释由快照拼接；`learningProgress` 恒为 null，PRD 冷启动状态无法呈现。 |
| Person details | 年龄、状态、设备类型/位置/在线/佩戴/电量/覆盖、健康指标、最近事件 | `subject`, `deviceDetails[]`, `metricSummaries[]`, `trends`, `events[]`, `alerts[]` | **已覆盖主体数据**；与 Overview 重复，需明确此页主职能为历史与设备详情。 |
| Alerts 列表 | 等级、标题、时间、状态、前两个信号、通知对象、建议动作 | `alerts[]`, `events[]`, `contacts[]` | **部分覆盖**：卡片的建议动作由前端事件类型映射，可能与事件详情 Kimi 建议不同；应统一 `recommendedAction`。 |
| Alerts 通知日志 | 渠道、收件人、发送时间、消息、送达状态 | `notifications[]` | **缺口**：列表没有 `deliveryStatus`，详情页始终写“delivered”，即使底层记录可为 sent/failed；需真实状态字段。 |
| Event 详情 | 事件时间/类型/信号/覆盖/独立通道数、跌倒阶段与观察窗、风险及历史、概率/规则、基线偏离、趋势、AI 摘要 | `events[]`, `alerts[]`, `deviations`, `baselines`, `trends`, `kimiSummaries` | **部分覆盖**：概率和 `ruleApplied` 仅在 Demo run 返回/审计中，普通详情无完整判定来源。稳定结果或订阅关闭时仍有 event 无 alert，Demo I/O 的“View event details”链接会进入 `Event not found`。 |
| Event 升级/通知 | 当前阶段、下一时间、阶段日志、收件人、渠道、发送/送达状态、预览、一次性链接 | `alert.escalation`, `alert.notifications`, `notifications[]`; 预览另查 `/api/demo/notifications/:id` | **部分覆盖**：各通道共用邮件外观的预览；缺少可见的 sent/failed 状态；预览接口只有 `personId`，演示以外需授权。 |
| Event 审计 | 动作、操作者、时间、处理理由与备注 | `auditLog[]`, `alerts[]` | **缺口**：全局快照只返回最近 50 条，详情却宣称“Every action”；应有按 alert/event 分页查询。 |
| Care Network | 联系人姓名、顺序、渠道、手机号验证、时区/安静时段、订阅；T+0/5/15/30 策略 | `contacts[]`, `subscription`; 时间线文案写在前端 | **部分覆盖**：策略参数/接收规则是前端静态事实，应从同一策略契约返回；开关为 `aria-disabled` 的展示控件，真正编辑在 Setup。 |
| Settings | 订阅、主联系人渠道/安静时段、设备、监测暂停、隐私声明、套餐/权益/当前计划 | `subscription`, `contacts`, `deviceDetails`, `subject.monitoringPaused`; 套餐和隐私断言写在前端 | **部分覆盖/缺口**：开关外观不可编辑；“Current plan”与权益无 API；无安静时段时仍写“非紧急消息夜间暂缓”，与数据可能不符。 |
| Setup | 显示名、别名、年龄、时区、联系人顺序/渠道、订阅、摄像头覆盖、同意状态 | `GET/PUT /api/demo/config` | **部分覆盖**：同意记录虽在 `subject` 中，却不在表单或保存流程；无法编辑手机号验证/安静时段；错误只返回泛化字符串，不能定位字段。 |
| Demo I/O | 事件类别、时间、信号/覆盖、四档概率、数据不足/恢复、备注、决策规则、等级、alert/event、历史 runs | `POST/GET /api/demo/observations` | **部分覆盖**：表单不提供 `occurredAt` 和 `withinCoverage` 编辑，提交时强制写当前时间；能添加超过 API 上限的 8 个信号；稳定/订阅关闭事件的详情链接失效。 |
| Demo 快捷控件 | 预设事件、活跃状态、重置范围 | `/api/demo/inject`, `/api/demo/reset` | **部分覆盖**：预设注入真实写本地状态；Reset 无确认且会重置当前人配置与 runs。 |
| Login / 机构预览 | 角色、被分配对象、机构患者 ID/姓名/年龄/等级/原因/更新时间 | 登录仅写 `lp_role` cookie；`carePatients[]` 来自 seed + 当前人投影 | **缺口**：角色不控制路由或 API；Care provider 仍跳家属 Overview。机构三行是静态合成数据，`lastUpdatedIso` 每次构建取“现在”，会误显为实时更新。 |

### A.2 当前接口一致性审查

现有 `docs/API_CONTRACTS.md` 提供页面级字段组，但仍缺少可机器校验的逐字段契约、来源、空值、错误码和权限。`DemoStateSnapshot` 是 TypeScript 类型，并未对服务端输出和客户端接收做运行时 schema 校验；`DemoProvider` 直接断言响应类型。下列问题会使“前后端严格遵守”无法验收：

| 现有端点 | 当前页面/动作 | 实际契约问题 |
| --- | --- | --- |
| `GET /api/demo/state?personId` | 几乎所有页面每 500ms 拉取 | 巨型快照把家庭端、机构预览、通知、审计混在一起；GET 会推进引擎；无运行时响应校验；`learningProgress=null` |
| `GET/PUT /api/demo/config` | Setup 编辑；Settings/Care Network 只读 | 可保存部分配置；同意、安静时段、验证状态未形成可用编辑流程；错误非字段级 |
| `GET/POST /api/demo/observations` | Demo I/O 输入与历史 | 请求要求 `occurredAt`、`withinCoverage` 等，表单未完整暴露；返回的 `alertId` 可为 null，而详情要求 alert |
| `POST /api/demo/inject` | 右下 Demo 快捷按钮 | 真正写入合成事件；概率来自预设，不能标为 Kimi 预测；活跃同类警报时返回 `{ok:false}` 但 HTTP 仍为 200，前端按成功响应清除错误 |
| `POST /api/demo/reset` | 右下 Reset | 重建所选人的全部状态与 runs，包括 Setup 配置；按钮未说明、无二次确认 |
| `POST /api/demo/pause` | Settings 暂停/恢复 | 写入状态；`paused` 使用布尔强制转换，非法输入不会返回字段错误；Overview 主状态未反映 Paused |
| `POST /api/alerts/:id/ack` | Critical 横幅/事件详情/安全链接 | 真正停止升级；无身份绑定，非 token 路径可指定任意联系人；`personId` 在普通路径也非必填 |
| `POST /api/alerts/:id/resolve` | 事件详情结案 | 真正写入理由/备注；未传联系人时默认第一联系人，实际操作者可能不一致 |
| `POST /api/kimi/summary` | 事件详情自动请求 | Kimi 或模板结果均返回 200；`source` 可识别，但失败原因与生成时间不在契约；页面级失败反馈不足 |
| `GET /api/demo/notifications/:id` | 消息预览 | 返回预览和 Demo 链接；通知送达状态不在通用预览结构；生产形态必须加权限校验 |
| `GET /api/demo/ack/:token` | 一次性链接落地页 | 可查有效/过期/已用；Demo 简化了会话验证，不能视为真实身份授权 |

1. **多个事实来源：** 风险来自 JEV，但推荐动作、策略时间、计划权益、送达文案仍写在 UI；不同页面可能表达不一致。
2. **缺少页面级语义字段：** 快照有原始警报与设备数据，却没有 `displayStatus`、数据不可验证原因、`primaryAction`、警报处理权限、摘要来源与失败说明。
3. **输入输出不对称：** Demo I/O 声称结构化输入，但表单没覆盖 `occurredAt`、`withinCoverage`；`POST /api/demo/observations` 可能返回 `alertId=null`，详情页却要求有 alert。
4. **错误形状不统一：** 有的路由 `{error}`，有的 `{ok:false,error}`；字段级错误、冲突与重试语义未统一。`/api/demo/pause` 将任意值强制转布尔。
5. **身份与权限未形成契约：** 当前 login cookie 不参与 API 鉴权；ack 可提交任意 `contactId`，resolve 默认第一联系人；这些是 Demo 简化，不能当成可用的真实权限流程。
6. **状态读取与副作用混合：** `GET /api/demo/state` 会执行 `advance` 并可能写库；页面每 500ms 轮询一次。应有清晰的时钟/事件处理职责和请求频率策略。
7. **历史不完整：** `auditLog` 全局截取 50 条，不适合作为事件完整审计契约。

### A.3 交互细节与验收场景

- 切换 Person 时保留人员选择器与当前选择；新请求加载期间不得展示上一人的结果，迟到响应不能覆盖新选择。
- 首次 Setup 按「被监测人及同意 → 设备与覆盖 → 联系人与升级顺序 → 通知规则 → 核对并保存」组织；支持返回修改、字段级错误和草稿。同意不能只依赖预置数据。
- 「I'm responding」成功后停止对应升级提醒；Critical 未确认前不能结案时，页面应说明原因。服务端校验当前身份和动作权限。
- 风险等级同时使用文字与颜色；同一动作跨页面使用同一名称；上传、保存和分析状态对键盘及辅助技术可用。
- 机构预览保留独立入口，完整机构功能不纳入本轮；样例行不能每次读取都把数据时间刷新为“现在”。
- 状态读取不应依靠 GET 请求推进引擎并写库；改造时明确后台任务职责，替换所有页面每 500ms 拉取巨型快照的方式。
- 重置事件默认保留联系人、设备与设置；恢复全部样例明确说明会清除资料，避免隐式重置配置。

契约与页面验收至少覆盖：稳定且新鲜、稳定但设备过期、暂停、基线学习期、无数据、跌倒候选观察窗、Critical 升级、确认停止升级、结案、订阅关闭仍有事件、无警报事件、第二位 Person 数据隔离、通知失败、Kimi 回退与真实模型结果。新增上传场景另覆盖：仅结构化资料、结构化资料加视频、文件解析错误、视频上传失败、部分分析、取消/重试、重复提交幂等、删除视频以及切人时有任务运行。

历史审查曾发现本地已有 `source=llm` 的摘要缓存；这仅说明曾返回模型摘要，不能证明每次调用成功，更不能证明现有风险概率由 Kimi 预测。后续应以每次任务保存的模型调用与来源记录为准。


## 本轮实现与验收记录（2026-10-03）

- 已实现：四项导航、Person 选择、Overview 状态→新鲜度→行动、告警处理/结案、Settings 持久化与版本冲突提示；登录态与人员范围校验。
- 已实现：单列表单、CSV/JSON 解析、手工观察、可选私有 MP4 上传/预览/删除、异步分析/取消/重试、带来源与不确定性的结果、无告警事件可访问。
- 共享 schema、逐页数据契约和测试说明以 `API_CONTRACTS.md` 为准。修改设置、告警、上传和分析会真实写入本地 SQLite/私有文件目录。
- 模型路径：Kimi 提取观察与生成解释；版本化样例规则负责等级。无密钥、离线、模型失败时直接显示部分结果及原因。真实视频识别质量尚须用获准的代表性短片验收。
- 本地原型边界：单持久 Node 进程、样例身份、模拟通知、MP4 容器校验；没有生产账号体系、真实设备接入、真实短信投递、分布式队列或病毒扫描服务。手机端、连续视频采集、诊断、支付和机构邀请不在本次实现范围。
- 核验：TypeScript/生产构建；隔离 API 场景回归；模拟提供方的模型协议/错误路径测试；浏览器登录、Overview 与样例提交走查。
