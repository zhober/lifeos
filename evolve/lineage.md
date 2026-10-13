# 专家谱系（来源与借鉴）

> 每位 agent 借鉴了谁、因什么反馈改过。由 evolver 维护；agent 文件本身只写领域内容。
> 状态：`已借用` = 已融入定义；`待参考` = 下次改进时优先看。
> Attribution of external projects and papers used by each role. Paths under `evolve/research/` and `evolve/sources/` refer to the original development workspace and are not distributed; the project names, URLs and licenses here are the public record.

## career-coach
- Implemented on 2026-10-12: original sourced work/project/opportunity/process record utilities, exact design/adoption/milestone views, duration-basis/uncertainty separation, case freshness and career mode procedures. Adopted researched proof/bottleneck/feedback concepts, without copying third-party code, scorecards or vendor paths. Source/implementation/test details: `evolve/research/2026-10-12-career-improvement.md`. The following introduction-stage note is historical and superseded for adoption status.
- 2026-10-12 researched before introduction, not adopted: Jeff-Kazzee/career-coach Skill and weekly/performance playbooks (MIT), Oya planning Skill (license unverified), borghei Weekly Review (MIT + Commons Clause), and a Chinese course/skill/career rule-based demo. Existing role definition remains unchanged. Pending methods: outcome/proof and bottleneck distinction, dated commitments/review, project evidence and learning handoff. See `evolve/research/2026-10-12-career-coach-introduction.md`; original reference-only snapshots are retained under `evolve/sources/career-coach-2026-10-12/`.

## critic
- 2026-10-11 follow-up: retained complete fact-checker prompt/MIT license and Self-Refine Apache-2.0 license. Its domain-based/example confidence scoring is not adopted. Existing critic behavior is unchanged; see `evolve/research/2026-10-11-existing-agent-followup.md`.
- 已借用：Microsoft MAI-DxO（arXiv 2506.22405）— 唱反调与成本/可行性角色
- 已参考：davila7/claude-code-templates `deep-research-team/fact-checker.md` — 原始来源追溯、时效/适用性与逐项证据核查；2026-10-11 核实，采用方法，不复制代码或权限。
- 已参考：madaan/self-refine（arXiv 2303.17651）— 反馈、修订、再次检查的迭代结构；最终方案绑定、问题处置、三轮上限和文件验证为 LifeOS 自身约定。
- 改进依据与测试：`evolve/research/2026-10-11-critic-review.md`、`evolve/research/2026-10-11-critic-improvement.md`。

## finance-advisor
- Implemented on 2026-10-12: active original English adviser, FINANCE.md and immutable sourced worksheets/originals with non-value disclosure descriptors. Original Node amount/cashflow/balances/budget/goal/debt/scenario helpers use safe minor-unit arithmetic, actual/cash/forecast/coverage distinctions and current source/version/subject checks. No bank converter, SQLite authority, tax engine, vendor setup or fixed score copied. See evolve/research/2026-10-12-finance-implementation.md; the following candidate notes are historical.
- 2026-10-12 user privacy extension: added voluntary minimal financial input, persistent/request-scoped refusals, general/range/hypothetical alternatives and no cross-role/history/proxy recovery of withheld fields. Shared preference convention and optional format validation are implemented; the financial role/ledger remains inactive. No personal choice was inferred from the general feature request. Details: evolve/research/2026-10-12-finance-privacy.md.
- 2026-10-12 introduction research: inspected googlarz/finance-assistant README/core instruction sections/CC BY 4.0 declaration, zubair-trabzada/ai-finance-claude README/main orchestrator (declared MIT; separate license fetch failed), and deb-sig/double-entry-generator README/documentation/Apache-2.0 license. Retained seven original reference-only snapshots with source URLs/hashes and attribution. No execution or financial correctness/security/effectiveness audit.
- Proposed an original provider-neutral read-only role for traceable bookkeeping/reconciliation, budgets, debt/savings/assets and conditional scenarios. Do not adopt vendor setup, foreign tax defaults, fixed scores, recurring actual auto-booking or a competing SQLite profile. Current status: evolve/drafts/2026-10-12-finance-advisor.md is inactive; no ledger/importer/calculator/financial schema enabled. Details: evolve/research/2026-10-12-finance-advisor-introduction.md.

## fitness-coach
- 2026-10-11 verified pending references: personal-trainer Skill/training (license unverified), adaptive-endurance-coach Skill/recovery (MIT). Exercise preferences and periodized feedback are candidates; fixed readiness/clinical thresholds and external calendar writes are not adopted. See the follow-up report.
- 2026-10-11 implemented immutable typed sessions/plans/adoption/recovery/performance records, explicit units/scales, exact plan comparison, live exercise projections, descriptive metrics, and shared-case freshness. Reused the official exercise-channel catalog; a focused Foster primary-source abstract lookup informed only the duration/RPE descriptive proxy. Original code without medical risk thresholds, framework/API dependence or copied external implementation. See `evolve/research/2026-10-11-fitness-improvement.md` and `evolve/research/2026-10-11-fitness-implementation.md`.
- 待参考：npapatheodorou/personal-trainer-skill — 循证训练计划
- 待参考：mprecilio20/adaptive-endurance-coach — 周期化与伤病处理
- 待参考：PH-LLM（arXiv 2406.06474）`phllm/autoeval` — 健身教练回答评分标准

## health-advisor
- 2026-10-11 follow-up: PHA official README and retained prompts; PHIA prompts/CC BY-NC 4.0 license; Informed Patient description/CC BY 4.0 license. PHA README declares Apache-2.0; separate license fetch failed. Informed Patient's full Skill was not retrieved. These are references, not new clinical rules; see the follow-up report.
- 2026-10-11 source-appraisal refinement: Cochrane/NICE evidence-certainty and applicability methods, and DORA's distinction between journal metrics and article quality. Adopted a qualitative claim-specific rubric and MD/JSON metadata rather than an automatic score or formal GRADE service. See `evolve/research/2026-10-11-health-source-appraisal.md`.
- 2026-10-11 implemented sourced symptoms, measurement/report context, visits, medication statements, attributed diagnosis history, all-year retrieval, and generic coordinator-mediated cases. Conceptual references: Google PHA, FHIR R5, and A2A task lifecycle; original code, no framework/server/provider dependency. See `evolve/research/2026-10-11-health-collaboration.md` and `evolve/research/2026-10-11-health-collaboration-implementation.md`.
- 已借用：Google PHA（arXiv 2508.20148）— 动机式访谈三问、记忆模块（经 `experts/_common.md` 与 /ask /panel）
- 待参考：PH-LLM 睡眠报告“洞察→病因→建议”三段式与评分标准
- 待参考：PHA `domain_expert_prompts`（`evolve/sources/google-pha/`）— 将来体检/化验解读
- 待参考：DrCatHicks/informed-patient — 循证查询

## nutritionist
- 2026-10-11 verified pending references: NataMoroz/nutrition-coach and H1an1/health-coach (MIT), with original prompts retained. Intake basis/Chinese workflows can be compared with NUTRITION.md; universal targets, unverified food tables and duplicate-count-prone corrections are not adopted. See the follow-up report.
- 已借用：《中国食物成分表》第6版（Sanotsu/china-food-composition-data）— `data/food/` 营养计算
- 已参考：Google Nutrition5k、Runz96/DietAI24 — 食物识别、份量推断、成分数据计算及图像方法的适用限制；采用方法，未复制模型或调用其 API。
- 2026-10-11 已实现：原图与结构化观察留存、营养范围、标签单位、已知小计和全天完整性、不可改写的餐食版本；依据 `evolve/research/2026-10-11-nutritionist-review.md` 和 `evolve/research/2026-10-11-photo-nutrition.md`。
- 2026-10-11 second-review repairs: structured conflicts, explicit-unit sanity validation, separate provenance/scope/numeric coverage, evidence-backed per-nutrient structural zeros, complete-day comparison statistics, and independent-total/cache recovery. Local implementation rather than external code; evidence in `evolve/research/2026-10-11-nutrition-review-2-implementation.md`.
- 待参考：npapatheodorou/personal-trainer-skill、NataMoroz/nutrition-coach、xeroctation/macros-log — 饮食记录格式与宏量目标
- 待参考：rdmgator12/Parent-Helper、marklavine-mlv/weekly-meal-planner — 周菜单与购物清单

## shopping-advisor
- Implemented on 2026-10-12: original exact-variant offer/quality/ownership/watch file contracts, integer quote arithmetic, recorded minima and source-unit/cash-flow/chronology checks; shared case/memory integration and JD/Taobao/Pinduoduo + Xiaohongshu/Zhihu/Bilibili lookup procedures. Reused retained JD tool documentation and explicit user needs, not unverified candidate code. See evolve/research/2026-10-12-shopping-improvement.md. The earlier introduction-stage note below is historical.
- 2026-10-12 introduction research: reused retained JD-Taobao-MCP documentation/license and searched additional public shopping Skill/agent leads. Filtmall-Shopping-Skill and AI-Shopping-Assistant-Agentic-System have repository-metadata evidence only; source-body retrieval failed, so their implementation/license/effectiveness is unverified and no new behavior is adopted. Current role remains unchanged. See `evolve/research/2026-10-12-shopping-advisor-introduction.md` for logic and pending price/quality/ownership evidence gaps.
- 2026-10-11 rechecked JD-Taobao-MCP documentation/MIT license. It is a browsing tool, not a complete advisory role; no external operation was added.
- 已借用：HaonanYu123/JD-Taobao-MCP — 关键参数 + 好评/差评各 5 条的输出约束
- 已借用：2026-10-11 实测反馈 — 价格可信度分级、联网优先级
- 待参考：京东联盟/淘宝联盟/多多进宝 API（需申请 key）— 将来接入实时价

## psych-coach
- Implemented on 2026-10-12 after user authorization: activated the reviewed English role, added PSYCH.md and a pointer-oriented interaction checkpoint, initialized empty checked-reference templates and connected shared entry/configuration/ask/log/review/panel procedures. Reused original source/iteration decisions without copying external models, clinical thresholds, hotline numbers or vendor configuration. Scope includes support, reflection, communication, gifts/cooperation/shared activities and outcome review. See evolve/research/2026-10-12-psych-implementation.md; candidate/draft-only notes below are historical.
- 2026-10-12 further user extension: broadened communication to interpersonal interaction, including gift suitability/gestures, cooperative division of work, shared activities and outcome review. These are original user-directed draft procedures, not newly verified public gift/collaboration agents. Specific product research and formal project planning retain shopping/career contracts; participant consent and actual actions are not inferred from proposals. Still inactive. Details: evolve/research/2026-10-12-psych-interaction.md.
- 2026-10-12 user-directed extension: added interpersonal communication advice, natural reply drafts, optional clearly labeled rehearsal and evidence-based interaction review to the inactive proposal. Retained shared memory/cases and existing work/shopping responsibilities; this is an original bounded procedure based on the user's requested scope, not a newly verified external communication agent. No automatic messaging or independent contacts database was enabled. Details: evolve/research/2026-10-12-psych-communication.md.
- 2026-10-12 introduction research: inspected LittleSound/adhd-cbt-skill README/core Skill/MIT license, SoulChat2.0 README/Apache-2.0 root license and PsyDT publisher metadata/abstract (ACL 2025, DOI 10.18653/v1/2025.acl-long.55). Retained five original reference-only snapshots. Proposed an original general emotional-support/optional-reflection adaptation, not copied disease-specific therapy assumptions, static hotline numbers or vendor memory/configuration instructions.
- Status: draft only at evolve/drafts/2026-10-12-psych-coach.md; no active role, personal-data schema, model installation or clinical-efficacy verification. Research and limits: evolve/research/2026-10-12-psych-coach-introduction.md. SoulChat2.0 and its publication are the same evidence lineage, not independent corroboration.

## study-coach
- Current implementation, 2026-10-12: merged planning, resources, teaching and review into one canonical read-only learning role. Reused the inspected teaching methods and existing source/answer/assistance/checkpoint contract. ai-tutor is now a shared historical alias, not an active second expert; original prompts and personal history are retained. See evolve/research/2026-10-12-study-merge.md. The following implementation/research notes are historical.
- Current implementation, 2026-10-11: resource selection and teacher handoff are active in the role/STUDY.md. Chinese resource fit/reliability/access, direct instruction, assistance/performance distinction and task-based checkpoints are implemented procedures. Dedicated curriculum storage/automatic scheduling remain future work. See `evolve/research/2026-10-11-study-teaching-implementation.md`; the earlier research-only note below is historical.
- 2026-10-11 researched, not yet adopted: LEARNableLabs/OpenTutor (MIT), HKUDS/DeepTutor (Apache-2.0), THU-MAIC/OpenMAIC (current root MIT), and Kestin et al. (2025), DOI 10.1038/s41598-025-97652-6. Focused source inspection informs Chinese resource selection, source-bound teaching, practice feedback and file continuity. See `evolve/research/2026-10-11-teaching-agents.md`; existing study-coach behavior and data contracts are unchanged.

## ai-tutor
- Retired as a separate role on 2026-10-12: teaching procedures are incorporated into study-coach. The original active definition is preserved byte-for-byte at agents-disabled/ai-tutor.md. Shared role aliases resolve new requests to study-coach; existing identifiers, references and checkpoints are not rewritten. The activation notes below record earlier stages.
- Current implementation, 2026-10-11: adapted the English draft into agents/ai-tutor.md and added learn/checkpoint instructions. The role is discoverable. Earlier candidate notes below describe the research-only stage and are superseded by this activation.
- Proposed separate teaching role; not enabled. Draft: `evolve/drafts/2026-10-11-ai-tutor.md`; staged integration: `evolve/drafts/2026-10-11-study-teaching-plan.md`.
- OpenTutor is the closest file/procedure reference, but its generated curricula and fixed thresholds are not accepted as verified knowledge or mastery rules. DeepTutor contributes material/video-location concepts; OpenMAIC contributes optional interactive-activity concepts. Published physics-trial outcomes are not attributed to these implementations or generalized to all learning.
- Twelve original reference-only source snapshots with upstream URLs, licenses and SHA-256 are retained under `evolve/sources/teaching-agents/`. DeepTutor uses commit `6cf793bd868ba5ecbe64722936d4be8fab5a01df`; other snapshots are content-hash identified. No external code or skill has been installed or adopted.

## travel-planner
- Activated on 2026-10-12 after the user's acceptance: original English role/TRAVEL.md, task-based itinerary/checkpoint templates, exact-input schedule/cost arithmetic and empty pointer/reference seeds. Reused inspected procedural ideas without copying source tooling, vendor installation, route/booking services or private profiles. Details: evolve/research/2026-10-12-travel-implementation.md. Candidate-only notes below record the preceding stage.
- 2026-10-12 introduction research, not activated: inspected awangwang123/jianhao-travel-planner and skywain/trip-planner-skill README/selected core Skill operating sections/root MIT licenses; six original snapshots are retained under evolve/sources/travel-introduction-2026-10-12/ with retrieval hashes and failed-fetch/fallback metadata. No scripts/renderers/connectors or travel accuracy claim reproduced.
- Proposed original file-based role: proportionate planning modes, current source/condition checks, comparable costs, practical buffers/alternatives, affected-plan revisions and shared memory/control/cases. Do not adopt locale-based identity/origin inference, author-specific pacing, fixed travel/policy/medical examples, compulsory visuals, vendor paths or additional account authority.
- Status: English draft only at evolve/drafts/2026-10-12-travel-planner.md; no active role, TRAVEL.md, typed record schema, route/FX helper, booking service, watcher or cloud deployment. Report: evolve/research/2026-10-12-travel-planner-introduction.md.

## 调研记录
- `evolve/research/2026-10-10-同类项目调研.md`
- `evolve/research/2026-10-11-已发表与开源生活域agent调研.md`
# Main assistant and shared long-term memory

- Control lifecycle update on 2026-10-11: borrowed persistent cursor, pause/resume, and checkpoint concepts from official LangGraph documentation, implemented as original file-based state and event utilities. Sources and scope are recorded in `evolve/research/2026-10-11-control-lifecycle.md`; no framework or API dependency was introduced.

- Adopted on 2026-10-11: Basic Memory's file-centered knowledge and link retrieval; Graphiti's temporal facts and provenance; Mem0's distinction between reusable memory and full conversation context; LangChain and Letta's memory/context separation; LongMemEval's temporal update and abstention evaluation categories.
- Implemented in ORCHESTRATOR.md, MEMORY.md, shared expert instructions, and local memory/work/storage scripts. Original implementation; no third-party code was copied or memory service installed.
- Research and limitations: `evolve/research/2026-10-11-long-memory.md`.

