# Tasks: F018 Agent Sidekick — AI 助手侧栏

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | Spec Discovery + SDD Review 完成 |
| tasks.md | ✅ 已拆解 | SDD Review LGTM |
| 实现 | 🔲 未开始 | 0 / 18 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
无数据库迁移（F018 不引入新表）。

**前端 Test-Alongside**：前端实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 1: 后端 Domain 模型

- [ ] **T001**: Sidekick Domain 模型
  **文件**: `apps/server/app/domain/sidekick.py`
  **逻辑**: 定义所有 Sidekick 相关的 Pydantic 模型，继承 `DomainModel`（`alias_generator=to_camel, populate_by_name=True`）：
  - `SidekickPageType(str, Enum)`: `object_type_detail`, `property_list`, `link_type_detail`
  - `SuggestionType(str, Enum)`: `missing_description`, `missing_title_key`, `missing_primary_key`, `orphan_link`, `duplicate_property_name`, `suggest_link`, `cardinality_review`, `naming_improvement`, `description_enhancement`
  - `SuggestionSource(str, Enum)`: `completeness_check`, `consistency_check`, `pattern_matching`, `semantic_inference`, `best_practices`
  - `SidekickContext`: `page_type`, `entity_rid`, `ontology_rid`
  - `Suggestion`: `id`, `suggestion_type`, `title`, `description`, `confidence(float)`, `confidence_level(str)`, `source`, `reasoning`, `requires_llm(bool=False)`, `action_payload(dict|None)`
  - `SuggestionsResponse`: `suggestions: list[Suggestion]`, `has_llm_suggestions: bool`
  - `SuggestionApplyRequest`: `suggestion_type`, `entity_rid`, `action_payload(dict|None)`
  - `SuggestionApplyResponse`: `success: bool`, `message: str`
  - `GenerateContentRequest`: `content_type: str`, `entity_rid: str`, `context: dict|None`
  - `GenerateContentResponse`: `content: str`
  **依赖**: 无

### Phase 2: 后端规则引擎（Test-First）

- [ ] **T002**: 规则引擎单元测试
  **文件**: `apps/server/tests/unit/test_sidekick_rules.py`
  **逻辑**: 使用 `mock_db_session` mock 数据库，测试 `SidekickRulesEngine` 的每条规则：
  - `test_missing_description_detected` — OT 无 description → 返回 missing_description 建议，confidence=1.0, source=completeness_check, requires_llm=True → AC-03
  - `test_missing_description_not_triggered` — OT 有 description → 不返回此建议
  - `test_missing_title_key_detected` — OT 无 titleKeyPropertyId → 返回 missing_title_key 建议，confidence=0.9 → AC-04
  - `test_missing_primary_key_detected` — OT 无 primaryKeyPropertyId → 返回建议
  - `test_orphan_link_detected` — LinkType 引用不存在的 OT → 返回 orphan_link 建议，confidence=1.0 → AC-05
  - `test_duplicate_property_name_detected` — 多个 OT 有同名属性 → 返回建议
  - `test_no_issues_empty_list` — 一切正常 → 返回空列表
  - `test_ot_detail_page_rules` — pageType=object_type_detail → 只返回 OT 相关规则
  - `test_link_type_detail_page_rules` — pageType=link_type_detail → 只返回 LinkType 相关规则
  **覆盖 AC**: AC-03, AC-04, AC-05
  **依赖**: T001

- [ ] **T003**: 规则引擎实现
  **文件**: `apps/server/app/services/sidekick_rules.py`
  **逻辑**: `SidekickRulesEngine` 类，接收 `AsyncSession`：
  - `async analyze(context: SidekickContext) -> list[Suggestion]`：根据 pageType 调用对应规则集
  - OT 详情页规则：通过 `ObjectTypeService.get()` 获取 OT 数据（含 merged view），检查 description/titleKeyPropertyId/primaryKeyPropertyId
  - LinkType 详情页规则：通过 `LinkTypeService.get()` 获取 LT 数据，检查两端 OT 是否存在
  - Property 列表页规则：通过 `PropertyService.list()` 获取属性列表，检查同名属性
  - 每条规则输出标准 `Suggestion` 对象，id 使用 `uuid.uuid4().hex[:12]`
  - `missing_description` 的 `requires_llm=True`（Accept 需 LLM 生成描述）
  - `missing_title_key` 的 `requires_llm=False`（可直接选择属性）
  **测试**: T002 全部通过
  **覆盖 AC**: AC-03, AC-04, AC-05
  **依赖**: T001

### Phase 3: 后端 LLM 引擎（Test-First）

- [ ] **T004**: LLM 引擎单元测试
  **文件**: `apps/server/tests/unit/test_sidekick_llm.py`
  **逻辑**: mock Anthropic SDK 调用，测试 `SidekickLlmEngine`：
  - `test_analyze_returns_suggestions` — mock LLM 返回 JSON → 解析为 Suggestion 列表，confidence 在 0.5-0.9 范围 → AC-06
  - `test_analyze_no_api_key` — API Key 未配置 → 返回空列表（不报错） → AC-12
  - `test_analyze_llm_error` — LLM 调用异常 → 返回空列表 + 日志记录
  - `test_generate_content_success` — 生成 OT 描述文本 → AC-20
  - `test_generate_content_no_api_key` — 无 API Key → 抛出 AppError(SIDEKICK_LLM_UNAVAILABLE) → AC-20
  - `test_suggestion_has_required_fields` — 每条建议含 confidence + source + reasoning → AC-14
  **覆盖 AC**: AC-06, AC-12, AC-14, AC-20
  **依赖**: T001

- [ ] **T005**: LLM 引擎实现
  **文件**: `apps/server/app/services/sidekick_llm.py`
  **逻辑**: `SidekickLlmEngine` 类：
  - `_is_available() -> bool`：检查 `ANTHROPIC_API_KEY` 环境变量
  - `async analyze(context, entity_data, ontology_summary) -> list[Suggestion]`：
    - 不可用时返回 `[]`
    - 构建 system prompt（要求 JSON 输出：`[{ type, title, description, confidence, source, reasoning }]`）
    - 使用 Anthropic SDK `messages.create(model=LLM_MODEL, temperature=0.3, max_tokens=1024)`
    - 解析 JSON 响应为 `Suggestion` 列表
    - 异常时 `logger.warning()` + 返回 `[]`
  - `async generate_content(request: GenerateContentRequest) -> str`：
    - 不可用时抛出 `AppError(code="SIDEKICK_LLM_UNAVAILABLE", status=503)`
    - 根据 `content_type` 选择 prompt 模板（目前支持 "description"）
    - 调用 LLM 返回纯文本
  **测试**: T004 全部通过
  **覆盖 AC**: AC-06, AC-12, AC-14, AC-20
  **依赖**: T001

### Phase 4: 后端编排服务（Test-First）

- [ ] **T006**: SidekickService 单元测试
  **文件**: `apps/server/tests/unit/test_sidekick_service.py`
  **逻辑**: mock `SidekickRulesEngine` 和 `SidekickLlmEngine`，测试 `SidekickService`：
  - `test_get_suggestions_rules_only` — LLM 不可用 → 仅返回规则建议, has_llm_suggestions=False → AC-12
  - `test_get_suggestions_mixed` — LLM 可用 → 规则 + LLM 建议合并，按 confidence 降序 → AC-06
  - `test_get_suggestions_invalid_context` — entityRid 不存在 → 抛出 AppError(SIDEKICK_INVALID_CONTEXT) → AC-18
  - `test_apply_missing_description` — 调用 generate_content + ObjectTypeService.update → AC-07
  - `test_apply_missing_description_with_edit` — actionPayload 含用户描述 → 直接更新不调 LLM → AC-09
  - `test_apply_missing_title_key` — 选取最合适属性 + PropertyService.update → AC-08
  - `test_apply_entity_not_found` — entityRid 无效 → 抛出 AppError(ENTITY_NOT_FOUND) → AC-19
  - `test_generate_content_success` — 委托给 LlmEngine → AC-20
  - `test_suggestions_sorted_by_confidence` — 验证返回顺序
  **覆盖 AC**: AC-06, AC-07, AC-08, AC-09, AC-12, AC-18, AC-19, AC-20
  **依赖**: T003, T005

- [ ] **T007**: SidekickService 实现
  **文件**: `apps/server/app/services/sidekick_service.py`
  **逻辑**: `SidekickService` 类，接收 `AsyncSession`：
  - `async get_suggestions(context: SidekickContext) -> SuggestionsResponse`：
    1. 验证 entityRid 存在（调用对应 Service.get）
    2. 调用 `SidekickRulesEngine.analyze(context)` 获取规则建议
    3. 调用 `SidekickLlmEngine.analyze(context, entity_data, ontology_summary)` 获取 LLM 建议
    4. 合并两个列表，按 confidence 降序排列
    5. 返回 `SuggestionsResponse(suggestions=merged, has_llm_suggestions=bool(llm_suggestions))`
  - `async apply_suggestion(request: SuggestionApplyRequest) -> SuggestionApplyResponse`：
    - `missing_description`：若 actionPayload 有 description 直接用；否则调 generate_content → ObjectTypeService.update(rid, {description: content})
    - `missing_title_key`：查询 OT 属性列表，选择 name/email/title 类属性 → PropertyService.update 设置 isTitleKey
    - `missing_primary_key`：查询 OT 属性列表，选择 id 类属性 → PropertyService.update 设置 isPrimaryKey
    - 其他类型：返回 success + 提示信息（v0.2.0 仅支持上述 Apply 类型）
  - `async generate_content(request: GenerateContentRequest) -> GenerateContentResponse`：委托给 LlmEngine
  **测试**: T006 全部通过
  **覆盖 AC**: AC-06, AC-07, AC-08, AC-09, AC-12, AC-18, AC-19, AC-20
  **依赖**: T003, T005

### Phase 5: 后端 API 层（Test-First）

- [ ] **T008**: API 路由集成测试
  **文件**: `apps/server/tests/integration/test_sidekick_api.py`
  **逻辑**: 使用 `seeded_client` fixture，测试 3 个 HTTP 端点：
  - `test_suggestions_success` — POST /api/v1/sidekick/suggestions，有效 context → 200 + suggestions 列表 → AC-18
  - `test_suggestions_invalid_page_type` — 非法 pageType → 422 → AC-18
  - `test_suggestions_entity_not_found` — entityRid 不存在 → 400 SIDEKICK_INVALID_CONTEXT → AC-18
  - `test_apply_success` — POST /api/v1/sidekick/apply，有效请求 → 200 → AC-19
  - `test_apply_entity_not_found` — entityRid 无效 → 404 ENTITY_NOT_FOUND → AC-19
  - `test_generate_content_success` — POST /api/v1/sidekick/generate-content，有效请求 → 200 → AC-20（需 mock LLM）
  - `test_generate_content_no_api_key` — 无 API Key → 503 SIDEKICK_LLM_UNAVAILABLE → AC-20
  **覆盖 AC**: AC-18, AC-19, AC-20
  **依赖**: T007

- [ ] **T009**: API 路由实现 + Router 注册
  **文件**: `apps/server/app/routers/sidekick.py`, `apps/server/app/main.py`
  **逻辑**:
  - `sidekick.py`：定义 `router = APIRouter(prefix="/api/v1/sidekick", tags=["sidekick"])`
    - `POST /suggestions`：解析 `SidekickContext` → `SidekickService.get_suggestions()` → `SuggestionsResponse`
    - `POST /apply`：解析 `SuggestionApplyRequest` → `SidekickService.apply_suggestion()` → `SuggestionApplyResponse`
    - `POST /generate-content`：解析 `GenerateContentRequest` → `SidekickService.generate_content()` → `GenerateContentResponse`
    - 使用 `get_async_session` 依赖注入
  - `main.py`：添加 `app.include_router(sidekick.router)`
  **测试**: T008 全部通过
  **覆盖 AC**: AC-18, AC-19, AC-20
  **依赖**: T007

- [ ] **T010**: OpenAPI 类型重新生成
  **文件**: `apps/server/openapi.json`, `apps/web/src/generated/api.ts`
  **逻辑**:
  - `cd apps/server && PYTHONPATH=. uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json`
  - `cd apps/web && pnpm run generate-types`（或对应的 openapi-typescript 命令）
  **依赖**: T009

### Phase 6: 前端基础（Store + API Hooks + i18n）

- [ ] **T011**: Zustand Store + 测试
  **文件**: `apps/web/src/stores/sidekick-store.ts`, `apps/web/src/stores/__tests__/sidekick-store.test.ts`
  **逻辑**:
  - Store 定义：`isOpen`, `editingSuggestionId`, `ignoredSuggestionIds(Set)`, `toggle()`, `open()`, `close()`, `setEditingSuggestionId()`, `ignoreSuggestion()`, `resetIgnored()`
  - 测试：`toggle` 切换状态、`ignoreSuggestion` 添加到集合、`resetIgnored` 清空集合、`close` 重置 editingSuggestionId
  **覆盖 AC**: AC-01, AC-02, AC-10
  **依赖**: T010

- [ ] **T012**: TanStack Query API Hooks + i18n 翻译
  **文件**: `apps/web/src/api/sidekick.ts`, `apps/web/src/locales/zh.json`, `apps/web/src/locales/en.json`
  **逻辑**:
  - `sidekickKeys` 工厂：`{ suggestions: (ctx) => ['sidekick', 'suggestions', ctx], all: () => ['sidekick'] }`
  - `useSidekickSuggestions(context: SidekickContext | null)` — `useQuery`，`enabled: !!context`，返回 `SuggestionsResponse`
  - `useApplySuggestion()` — `useMutation`，`onSuccess` 中 `invalidateQueries` 刷新 objectTypes/properties/linkTypes 缓存
  - `useGenerateContent()` — `useMutation`，返回 `GenerateContentResponse`
  - i18n 键（zh/en）：
    - `sidekick.title`: "AI 助手" / "AI Assistant"
    - `sidekick.refresh`: "刷新建议" / "Refresh"
    - `sidekick.accept`: "接受" / "Accept"
    - `sidekick.edit`: "编辑" / "Edit"
    - `sidekick.ignore`: "忽略" / "Ignore"
    - `sidekick.confirm`: "确认" / "Confirm"
    - `sidekick.cancel`: "取消" / "Cancel"
    - `sidekick.openWorkshop`: "打开本体工坊" / "Open Workshop"
    - `sidekick.emptyState`: "本体为空，建议使用本体工坊开始构建" / "Ontology is empty. Use the Workshop to start building."
    - `sidekick.noSuggestions`: "本体状态良好，暂无改进建议" / "Ontology looks good. No suggestions at this time."
    - `sidekick.llmUnavailable`: "配置 API Key 以获取更多 AI 建议" / "Configure API Key for more AI suggestions"
    - `sidekick.llmLoading`: "正在加载 AI 建议..." / "Loading AI suggestions..."
    - `sidekick.llmError`: "AI 建议暂时不可用" / "AI suggestions temporarily unavailable"
    - `sidekick.applySuccess`: "建议已应用" / "Suggestion applied"
    - `sidekick.applyError`: "应用失败，请重试" / "Failed to apply. Please retry."
    - `sidekick.confidence.high`: "高置信度" / "High confidence"
    - `sidekick.confidence.medium`: "中置信度" / "Medium confidence"
    - `sidekick.confidence.low`: "低置信度" / "Low confidence"
    - `sidekick.source.*`: 各来源标签的翻译
  **覆盖 AC**: AC-01, AC-11, AC-12, AC-16
  **依赖**: T010

### Phase 7: 前端组件

- [ ] **T013**: ConfidenceIndicator + SuggestionCard 组件 + 测试
  **文件**: `apps/web/src/components/sidekick/ConfidenceIndicator.tsx`, `apps/web/src/components/sidekick/SuggestionCard.tsx`, `apps/web/src/components/sidekick/__tests__/SuggestionCard.test.tsx`
  **逻辑**:
  - `ConfidenceIndicator`：接收 `confidence: number`, `confidenceLevel: 'high'|'medium'|'low'`；渲染彩色圆点 + 百分比文本（🟢≥0.8, 🟡0.5-0.8, 🔴<0.5）
  - `SuggestionCard`：接收 `suggestion: Suggestion`, `onAccept`, `onEdit`, `onIgnore`, `llmAvailable: boolean`：
    - 顶部：AI 角标 ✦ + 建议类型 Tag + ConfidenceIndicator
    - 中部：title + description
    - 折叠区：ReasoningCollapse（Ant Design Collapse），展示 reasoning + source 标签
    - 底部按钮：Accept（若 `requires_llm && !llmAvailable` 则隐藏）、Edit、Ignore
  - 测试：渲染验证、Accept/Edit/Ignore 按钮点击回调、requires_llm=true + llmAvailable=false 时 Accept 隐藏
  **覆盖 AC**: AC-10, AC-14, AC-15
  **依赖**: T012

- [ ] **T014**: SuggestionInlineEditor 组件
  **文件**: `apps/web/src/components/sidekick/SuggestionInlineEditor.tsx`
  **逻辑**:
  - 接收 `suggestion: Suggestion`, `onConfirm(payload)`, `onCancel()`
  - 根据 `suggestion_type` 渲染不同表单：
    - `missing_description` / `description_enhancement`：TextArea 输入框，预填 suggestion.description 或空
    - `missing_title_key` / `missing_primary_key`：属性下拉选择（需传入属性列表）
    - `cardinality_review`：基数选择器（one-to-one / one-to-many / many-to-many）
    - 其他：通用 TextArea
  - 确认按钮调用 `onConfirm(editedPayload)`，取消按钮调用 `onCancel()`
  **覆盖 AC**: AC-09
  **依赖**: T013

- [ ] **T015**: SidekickDrawer + SidekickTrigger 组件 + 测试
  **文件**: `apps/web/src/components/sidekick/SidekickDrawer.tsx`, `apps/web/src/components/sidekick/SidekickTrigger.tsx`, `apps/web/src/components/sidekick/__tests__/SidekickDrawer.test.tsx`
  **逻辑**:
  - `SidekickTrigger`：⚡ 按钮（Ant Design Button，icon=ThunderboltOutlined），点击调用 `useSidekickStore().toggle()`；使用 `useSidekickContext()` hook 判断当前路由是否支持 Sidekick，不支持时隐藏按钮
  - `useSidekickContext()` hook：基于 `useParams()` + `useLocation()` 推断 `SidekickContext`：
    - `/ontology/object-types/:rid/*` → `{ pageType: 'object_type_detail', entityRid: rid }`
    - `/ontology/link-types/:rid` → `{ pageType: 'link_type_detail', entityRid: rid }`
    - 其他 → `null`
    - `ontologyRid` 使用 DEFAULT_ONTOLOGY_RID 常量
  - `SidekickDrawer`：Ant Design Drawer（placement="right", width=400）
    - Header：标题 `t('sidekick.title')` + 刷新按钮（ReloadOutlined）+ 关闭按钮
    - Body：
      - 空本体：EmptyState + "打开本体工坊" 按钮 → AC-17
      - 有建议：SuggestionCard 列表（过滤 ignoredSuggestionIds）
      - 无建议：noSuggestions 提示 + "打开本体工坊"
      - LLM 加载中：Skeleton 占位 → AC-06
    - Footer：
      - "打开本体工坊" 按钮（Link to /workshop）→ AC-16
      - LLM 不可用时显示 llmUnavailable 提示 → AC-12
    - Accept 回调：调用 `useApplySuggestion().mutate()` → 成功后从列表移除 + message.success
    - Edit 回调：设置 `editingSuggestionId` → 展开 SuggestionInlineEditor → 确认后调用 apply
    - Ignore 回调：调用 `ignoreSuggestion(id)` → 从列表隐藏
    - 刷新回调：调用 `resetIgnored()` + `invalidateQueries(sidekickKeys.all())`
  - 测试：Drawer 渲染、打开/关闭交互、建议列表渲染、空状态渲染
  **覆盖 AC**: AC-01, AC-02, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-16, AC-17
  **依赖**: T013, T014

### Phase 8: 全局集成

- [ ] **T016**: AppShell + TopBar 集成
  **文件**: `apps/web/src/components/layout/AppShell.tsx`, `apps/web/src/components/layout/TopBar.tsx`
  **逻辑**:
  - `AppShell.tsx`：在 `<CreateLinkTypeWizard />` 下方添加 `<SidekickDrawer />`
  - `TopBar.tsx`：在右侧区域添加 `<SidekickTrigger />`（位于已有按钮之后）
  - 不修改任何其他 Layout 或 Page 组件
  **覆盖 AC**: AC-01, AC-02, AC-13
  **依赖**: T015

### Phase 9: openapi.json 最终生成

- [ ] **T017**: 最终 openapi.json 重新生成
  **文件**: `apps/server/openapi.json`, `apps/web/src/generated/api.ts`
  **逻辑**: 重新生成 openapi.json 并更新前端类型（T010 已做一次，此处确保前端组件开发期间的接口变更同步）
  **依赖**: T016

### Phase 10: 端到端验证

- [ ] **T018**: 手动端到端验证
  **逻辑**: 启动前后端，执行端到端验证流程：
  1. 导航到 OT 详情页（选择一个缺少 description 的 OT）
  2. 点击 ⚡ AI 按钮 → Sidekick Drawer 打开 → 显示建议卡片
  3. 查看 ConfidenceIndicator 和 AI 角标 ✦ 显示正确
  4. 点击 [忽略] → 建议卡片消失
  5. 点击 [刷新] → 重新加载建议
  6. 点击 [接受] missing_description → 描述自动填充（需 API Key）
  7. 导航到 LinkType 详情页 → Sidekick 上下文自动切换
  8. 导航到首页 → ⚡ 按钮隐藏
  9. 点击 [打开本体工坊] → 跳转到 /workshop
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-07, AC-10, AC-11, AC-13, AC-16
  **依赖**: T017

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- （待记录）
