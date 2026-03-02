# 005-object-type-crud-frontend 技术方案评审（Architecture Review）

**评审对象**: `features/v0.1.0/005-object-type-crud-frontend/design.md`  
**交叉基线**:
- `features/v0.1.0/005-object-type-crud-frontend/spec.md`
- `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md`

**结论**: 当前方案存在 **2 个高优先级阻塞项**，建议先修订后再进入实现。

---

## Findings（按严重级别）

### High

1. **详情侧边栏“状态徽标”与“变更状态徽标”被混用，和规格不一致**
- **位置**: `design.md:140-144`, `spec.md:92-97`, `spec.md:152-159`, `PRD.md:522-524`
- **问题**: 方案中 `statusBadge = ChangeStateBadge(data.changeState)`，把“状态（active/experimental/deprecated）”和“变更状态（created/modified/deleted）”合并成同一徽标语义。
- **影响**: AC-D1 要求的状态展示会丢失或被错误替代；后续实现容易出现 UI 文案与颜色语义错位。
- **建议**: 明确为两个独立显示位。
  - 状态徽标: `status`（Active/Experimental/Deprecated）
  - 变更状态徽标: `changeState`（published 不显示，其他显示 New/Modified/Deleted）

2. **“当前页客户端筛选”会导致筛选结果失真，并与列表/空态验收口径冲突**
- **位置**: `design.md:96-99`, `spec.md:50-51`, `spec.md:61-65`, `PRD.md:1101-1104`
- **问题**: 方案写明“仅对当前页数据做筛选”，且接受“筛选后条数少于 pageSize”。这会出现“当前页无命中但其他页有命中”的假空态。
- **影响**: 用户会看到错误的空状态，引导“Create your first object type”，与 AC-L6“无对象类型才显示空态”语义冲突；分页总数也无法反映筛选后的真实结果。
- **建议**:
  - 首选: 补充后端筛选参数（status/visibility），前后端统一分页语义。
  - 若 MVP 暂不改后端: 方案中必须明确“筛选仅作用于当前页”为临时约束，并区分两种空态（全局无数据 vs 当前筛选无结果），避免误导创建入口文案。

### Medium

3. **缺少 `/:rid -> /:rid/overview` 重定向实现契约**
- **位置**: `spec.md:97`, `design.md:217-222`
- **问题**: 路由变更只写了删除 `/object-types/new` 和替换 Overview 占位页，没有显式定义详情根路由重定向。
- **影响**: AC-D2 有漏实现风险，且路由测试难以覆盖。
- **建议**: 在 plan 里补充明确实现（`index -> Navigate("overview", replace)`）和对应测试用例。

4. **错误码处理矩阵覆盖不足，更新/删除路径缺兜底策略**
- **位置**: `design.md:63-70`, `spec.md:166-173`, `PRD.md:496`, `PRD.md:530-532`
- **问题**: 方案仅覆盖创建时 3 个错误码。规格中还有 `OBJECT_TYPE_INVALID_ID`、`OBJECT_TYPE_INVALID_API_NAME`、`OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME`、`OBJECT_TYPE_ACTIVE_CANNOT_DELETE` 等。
- **影响**: 当 UI 状态与后端校验不一致（并发更新、陈旧数据）时，用户得到不清晰或重复错误提示。
- **建议**: 在 plan 中新增统一错误码映射表，覆盖 create/update/delete 三类 mutation，并定义字段级错误与全局 message 的优先级。

5. **非功能“加载态”未落到组件级设计与测试点**
- **位置**: `spec.md:196`, `design.md:286-300`
- **问题**: 规格明确要求列表 Skeleton、详情 Spin；方案仅有手动验证清单，缺少组件级加载态策略与自动化验证点。
- **影响**: 实现容易遗漏加载体验，验收口径不稳定。
- **建议**: 在 plan 增补“加载态设计小节”，至少明确列表首屏、详情首屏、内联编辑提交中的 loading 行为及测试覆盖。

6. **引入 Recently Viewed 集成属于跨特性扩展，缺少本特性验收闭环**
- **位置**: `design.md:100-103`, `PRD.md:90-97`
- **问题**: 该能力属于 Discover 相关体验，当前 F005 spec 未定义对应 AC。
- **影响**: 增加跨模块耦合和回归面，但缺少本特性验收收益。
- **建议**: 标记为“可选增强”并迁移到独立任务，或移出本 plan。

### Low

7. **前置假设已过时，可能造成不必要的生成与噪音 diff**
- **位置**: `design.md:11`
- **问题**: 方案写“`openapi.json` 仅含 `/health`”，但当前仓库 `apps/server/openapi.json` 已包含 `/api/v1/object-types` 路由。
- **影响**: 执行者可能误判，进行不必要的 artifact 变更。
- **建议**: 改为条件式描述: “仅当后端 schema 变更时再执行 `server-openapi` / `web-typegen`”。

8. **文件清单统计与路径表达不一致，影响执行清晰度**
- **位置**: `design.md:267-280`
- **问题**: 标题写“修改文件 (~8 个)”，实际列出 10 个；同时路径既有 `src/...` 又有 `apps/server/...`，根路径口径不统一。
- **影响**: 任务拆解和 code review 时容易遗漏。
- **建议**: 统一为仓库根相对路径并校正数量。

---

## 建议修订优先级

1. 先修复 High 1-2（状态语义、筛选语义与空态口径）。
2. 再修复 Medium 3-6（路由重定向、错误处理矩阵、加载态、范围控制）。
3. 最后修复 Low 7-8（文档准确性与可执行性）。

---

## 评审结论（Gate）

- **当前状态**: `Changes Requested`
- **通过条件**:
  - High 项全部关闭；
  - Medium 至少关闭 3/4（第 3-6 项）。
