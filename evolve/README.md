# 迭代线（evolve/）

> 这一层记录**系统自身**的改进，不属于任何生活领域。维护者只有系统迭代师 `evolver`。

| 位置 | 内容 |
|---|---|
| `evolve/changelog.md` | 系统每次改动：改了什么、为什么、依据。只追加 |
| `evolve/lineage.md` | 每个 agent 借鉴了谁、待参考什么 |
| `evolve/candidates.md` | 候选 agent 清单及调研状态 |
| `evolve/research/` | 调研报告（`YYYY-MM-DD-<topic>.md`） |
| `evolve/sources/` | 下载的 prompt / skill 原文（只读参考，附来源 URL、日期、许可） |
| `evolve/drafts/` | 新建 / 修改 agent 的草稿 |

## 部署边界

部署只分发 `changelog.md`、`lineage.md`、`candidates.md` 和本文件，即使用库需要读懂的迭代记录和 evolver 的写作位置。

调研报告、下载原文和草稿属于开发过程：它们体积大、只在开发目录积累，且包含尚未采纳的提案与评审提示词，部署到个人库里既无用也多一份误当真迹的风险。开发目录因为改动被覆盖而丢失既有调研时，再从开发目录按需复制，不使用库里的旧副本。

系统与调研目录（`research/`、`sources/`）以及 `drafts/` 不再从开发目录复制。升级时，之前部署过且未被手动修改的调研/原文/草稿会按“孤立文件”规则移除；改动过的会保留并报告。需要在本库继续调研时，由 `evolver` 直接在该库的 `evolve/` 下新建目录，或把开发目录里已核实的报告单独复制过来。

## 迭代流程

```
提出需求（新领域 / 反馈 / 无效建议 / 测试问题）
  → evolver 调研现成项目与论文方法（先查 evolve/，再联网）
  → 在 evolve/drafts/ 起草
  → 按用户已有授权落实；必要时确认未授权范围 → 管家落地到 agents/ 等位置
  → evolver 更新谱系、候选清单、迭代日志
```

规则：**新建或大改任何 agent 前必须先调研**有没有别人做好的；领域专家文件只写领域内容，来源与借鉴只写在 `evolve/lineage.md`。完整说明见 `docs/core/ARCHITECTURE.md` 第五节与 `agents/evolver.md`。
