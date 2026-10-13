# 候选专家清单

> `/expert new` 时先看这里。状态：`已建` / `候选`（已有调研，可直接建）/ `待调研`。新建后更新状态和链接。

2026-10-12：用户确认现有专家覆盖已足够，暂停新增角色；未启用项保留为可选扩展，不作为当前必做待办。当前优先改善日常记录、协作续接、长期可靠性与数据／行动日报 PDF。

| 领域 | 建议 name | 状态 | 可借鉴的现成项目（详见调研报告） | 需要的数据 / 记录 |
|---|---|---|---|---|
| 营养 | nutritionist | 已改进，已补查 | 食物成分表；Nutrition5k；DietAI24；nutrition-coach/health-coach（待适配参考） | 餐照；records/nutrition/；NUTRITION.md |
| 健身 | fitness-coach | 已改进，已补查 | ACSM/NSCA/WHO；personal-trainer-skill；adaptive-endurance-coach（参考方法） | FITNESS.md；records/fitness/；计划—实际—恢复—表现 |
| 健康/睡眠与记录 | health-advisor | 已改进，已补查 | Google PHA/PHIA；Informed Patient；FHIR；通用协作 | HEALTH.md；records/health/；records/cases/；COLLABORATION.md |
| 学习/AI 教学 | study-coach | 已合并 | OpenTutor；DeepTutor；OpenMAIC；Kestin 等 2025（采用方法）；中文公开课与社区资源 | STUDY.md；规划/资源/教学/复盘；日志「学习」；共享 memory/tasks/actions；原答与课堂检查点 |
| 职业/效率 | career-coach | 已改进 | Career Coach；Oya/Weekly Review 的证据与复盘方法（未安装第三方） | CAREER.md；records/career/；原件、里程碑、实际工作、成果反馈和职业过程 |
| 购物 | shopping-advisor | 已改进 | JD-Taobao-MCP 已核查；用户指定中文社区；其他候选仍未核验 | SHOPPING.md；报价条件、质量来源、使用/售后版本、目标价关注队列 |
| 审查 | critic | 已改进 | MAI-DxO；fact-checker；Self-Refine | REVIEW.md；任务内审查与整改记录 |
| 心理/情绪/人际互动 | psych-coach | 已启用 | 已核对 ADHD CBT Skill（限定借鉴）、SoulChat2.0/PsyDT；人际互动为用户要求的原生流程 | PSYCH.md；tasks/actions/共享 memory；互动检查点；聊天、送礼、合作分工、共同活动与复盘 |
| 理财/记账 | finance-advisor | 已启用 | 已核对 Finance Assistant/AI Finance/账单转换器；原生快照与精确计算；未安装外部金融系统 | FINANCE.md；版本化快照与原件；披露检查；收支/余额/预算/目标/债务/情景；共享 memory/tasks/actions |
| 旅行 | travel-planner | 已启用 | 已核对 Jianhao / Trip Planner 的 README、核心 Skill 与 MIT 许可；采用核验、路线、预算和备选方法，未安装外部项目 | TRAVEL.md；版本化任务方案与检查点；共享 actions/memory；时间/费用检查；无预订或自动监控 |
| 做饭/菜单 | meal-planner | 候选 | rdmgator12/Parent-Helper；weekly-meal-planner | 与 nutritionist 分工：菜单与采购清单 |
| 循证医学查询 | evidence-checker | 候选 | DrCatHicks/informed-patient；fact-checker.md | records/evidence/ |
| 体检/化验解读 | lab-interpreter | 候选 | Google PHA domain_expert_prompts + few_shots | records/health/labs/ |
| 联系人/人脉管理 | — | 待调研 | COG-second-brain 人脉 CRM（未进一步核查）；日常聊天及人际行动建议由 psych-coach 提供 | records/people/ 仅为候选路径，尚未建立合同 |

2026-10-12：AI 教师 ai-tutor 已并入 study-coach，不再作为活动角色列出。旧定义保存在 agents-disabled/ai-tutor.md；历史名称通过 project.json definitions.role_aliases 接入统一学习角色。旧知识和教学记录保留。见 evolve/research/2026-10-12-study-merge.md。
