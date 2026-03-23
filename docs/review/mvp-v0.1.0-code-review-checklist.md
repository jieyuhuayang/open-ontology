# MVP v0.1.0 技术优化专项 — 系统性代码审查清单

> **启动日期**: 2026-03-24
> **审查周期**: ~1 周，每天 5-6 项
> **前置工作**: 上一轮审查已修复 12 个 bug（H1-H5, M2-M7），本清单不重复覆盖
> **优先级**: 🔴 HIGH（数据损坏/安全漏洞）| 🟡 MEDIUM（功能缺陷/UX）| 🟢 LOW（技术债/可维护性）
> **工作方式**: 逐项审查 → 确认问题（或标记误报/延后）→ 修复 → 打勾

---

## 进度总览

| 维度 | 🔴 | 🟡 | 🟢 | 完成 |
|------|-----|-----|-----|------|
| 1. 状态机与数据完整性 | 2 | 2 | 0 | 4/4 ✅ |
| 2. API 契约与边界验证 | 1 | 3 | 0 | 4/4 ✅ |
| 3. 级联操作与引用完整性 | 1 | 2 | 0 | 3/3 ✅ |
| 4. 并发与事务安全 | 1 | 2 | 0 | 3/3 ✅ |
| 5. 前端状态管理与缓存 | 0 | 2 | 1 | 3/3 ✅ |
| 6. 前端 UX 健壮性 | 0 | 2 | 2 | 4/4 ✅ |
| 7. 安全性 | 2 | 2 | 0 | 0/4 |
| 8. 性能 | 1 | 2 | 1 | 0/4 |
| 9. 测试覆盖缺口 | 1 | 3 | 1 | 0/5 |
| 10. 代码可维护性 | 0 | 3 | 1 | 0/4 |
| **合计** | **10** | **19** | **7** | **21/36** |

---

## 1. 状态机与数据完整性

- [x] 🔴 **1.1 discard_single_change 孤儿变更问题**
  撤销 OT DELETE change 后，级联的 Property/LinkType DELETE changes 仍留在 WS 中，publish 时会删除仍在使用的子资源。
  `working_state_service.py:594-619`, `object_type_service.py:301-369`

- [x] 🔴 **1.2 _validate_completeness 对 UPDATE 场景不完整**
  UPDATE 的 `after` 只含变更字段（非完整快照），校验可能误判 OT 为 incomplete。
  `working_state_service.py:265-303`

- [x] 🟡 **1.3 Collapse 逻辑 DELETE→CREATE 重建路径缺失**
  对同一 RID 先 DELETE 再 CREATE，`_collapse_change` 未处理 `existing.change_type == DELETE` 分支。
  `working_state_service.py:108-147`

- [x] 🟡 **1.4 publish 中 sync 失败的事务隔离确认**
  `_trigger_post_publish_sync` 中 sync 失败只 log 不 raise，需确认不影响 publish 事务完整性。
  `working_state_service.py:354-425`, `database.py:11-18`

---

## 2. API 契约与边界验证

- [x] 🔴 **2.1 路由层 rid 参数无格式校验**
  恶意 RID（超长/特殊字符）直接传入 DB 查询，应统一校验 `ri.` 前缀格式。
  `routers/object_types.py`, `routers/link_types.py`, `routers/ontology.py`

- [x] 🟡 **2.2 分页参数上限不一致**
  history 限 `page_size le=100`，OT/LT/Property list 是否有同样限制？
  `routers/ontology.py:55`, `routers/object_types.py`, `routers/properties.py`

- [x] 🟡 **2.3 search types 参数无枚举校验**
  未知类型（如 `"actionType"`）静默忽略，掩盖前端拼写错误。
  `routers/search.py`, `search_service.py:23-45`

- [x] 🟡 **2.4 skipGlobalError mutation 缺本地 onError**
  15 个设置 `skipGlobalError` 的 mutation 是否都有对应错误处理？
  `api/object-types.ts`, `api/link-types.ts`, `api/properties.ts`

---

## 3. 级联操作与引用完整性

- [x] 🔴 **3.1 OT 删除级联遗漏 draft LinkTypes**
  `get_related_link_type_rids` 只查 DB 已发布 LinkType，WS 中 CREATE 的草稿 LinkType（引用该 OT）不会被级联删除。
  `object_type_service.py:342-354`, `object_type_storage.py`

- [x] 🟡 **3.2 Dataset 删除对 WS 草稿 OT 引用的覆盖确认**
  `get_in_use_map()` 是否完整覆盖 CREATE 草稿 OT 的 `backingDatasource`。
  `dataset_service.py:234-249`

- [x] 🟡 **3.3 Property 删除时 OT 的 PK/TK 引用清理**
  删除 `isPrimaryKey` 的 Property 时，OT 的 `primaryKeyPropertyId` 是否同步清空？
  `property_service.py` delete/batch_delete 方法

---

## 4. 并发与事务安全

- [x] 🔴 **4.1 WorkingState read-modify-write 无乐观锁**
  并发 `add_change` 可能互相覆盖。应在 `working_states` 表增加版本号 + `WHERE version = N`。
  `working_state_service.py:149-153`, `working_state_storage.py`

- [x] 🟡 **4.2 process-local singleton 多 worker 失效**
  `ImportTaskService` 和 `_preview_cache` 是内存 dict，多 worker 下前端轮询可能打到不同 worker。
  `import_task_service.py:41`, `file_import_service.py:27`

- [x] 🟡 **4.3 publish 与并发 CRUD 的竞态**
  publish apply changes 过程中新 change 写入即将被清空的 WS。
  `working_state_service.py:354-419`, `database.py`

---

## 5. 前端状态管理与缓存

- [x] 🟡 **5.1 staleTime 策略不一致**
  search 30s 缓存 vs OT 无 staleTime，修改 OT 后搜索结果可能延迟更新。
  `api/search.ts:20`, `api/working-state.ts:36`

- [x] 🟡 **5.2 LT 删除缺少 properties 缓存失效**
  BO LinkType 删除可能级联清理属性，但 `propertyKeys` 未失效。
  `api/link-types.ts:116-117`

- [x] 🟢 **5.3 useWorkingState 404→null 语义模糊**
  无法区分"无草稿"和"网络错误"，消费方处理是否正确。
  `api/working-state.ts:22-34`

---

## 6. 前端 UX 健壮性

- [x] 🟡 **6.1 仅全局 ErrorBoundary，无页面级降级**
  任何页面渲染崩溃导致全站白屏，高复杂度页面应有独立 ErrorBoundary。
  `router.tsx:29`, `components/ErrorBoundary.tsx`

- [x] 🟡 **6.2 代码分割不足**
  仅 demo 页 `lazy()`，11 个业务页同步 import，首屏加载过大。
  `router.tsx:7-19`

- [x] 🟢 **6.3 无障碍属性缺失**
  整个 components 仅 3 处 `aria-` 属性，自定义组件缺 ARIA 标注。
  `components/` 全目录

- [x] 🟢 **6.4 Publish/Discard 操作防误触机制确认**
  是否有 `Modal.confirm` 或类似二次确认。
  Save/Discard 相关组件

---

## 7. 安全性

- [x] 🔴 **7.1 MySQL import SQL 注入风险**
  f-string 构造 SQL `f"SELECT {cols_sql} FROM \`{table}\`"`，table 名含反引号时可注入。
  `mysql_import_service.py:472-474`

- [x] 🔴 **7.2 Live Dataset 预览 SQL 注入风险**
  `dataset_service._get_live_preview()` 中同样使用 f-string 构造 SQL。
  `dataset_service.py:186-191`

- [x] 🟡 **7.3 ENCRYPTION_KEY 空值重启丢失**
  自动生成 key 进程重启后变化，已加密的 MySQL 连接密码无法解密。
  `crypto_service.py:12-44`, `config.py:8`

- [x] 🟡 **7.4 文件上传临时目录无清理机制**
  长期运行积累垃圾文件，无后台 cron 清理。
  `file_import_service.py`, `config.py:9-11`

---

## 8. 性能

- [ ] 🔴 **8.1 get_merged_view 请求内重复调用**
  单次 property create 可调用 3 次 `get_merged_view`，每次都查 DB + 遍历 WS，应加请求级缓存。
  `property_service.py:47-79`, `working_state_service.py:166-218`

- [ ] 🟡 **8.2 search 对每种资源类型分别调 get_merged_view**
  搜全部 3 类时调 3 次，WS 查询部分可复用。
  `search_service.py:23-45`

- [ ] 🟡 **8.3 OT/LT/Property list 内存分页**
  `get_merged_view` 加载全部到内存再切片，数量大时性能差。
  `object_type_service.py:193-219`

- [ ] 🟢 **8.4 MySQL import fetchall 大表 OOM**
  整表加载到内存，应有行数上限保护或流式读取。
  `mysql_import_service.py:474-475`

---

## 9. 测试覆盖缺口

- [ ] 🔴 **9.1 discard_single_change 无级联场景测试**
  撤销 OT DELETE 后 Property/LT DELETE 的处理无测试覆盖。
  `tests/integration/test_working_state_api.py`

- [ ] 🟡 **9.2 前端 components 测试覆盖 36%**
  SearchBar、PropertyTable、ChangePanel 等核心交互组件缺 Testing Library 测试。
  `apps/web/src/components/__tests__/`

- [ ] 🟡 **9.3 并发场景无测试**
  同时 `add_change`、publish 中并发 CRUD 均无覆盖。
  `tests/integration/`

- [ ] 🟡 **9.4 object_sync 边界测试不足**
  空数据集、全 unchanged、全 deleted 等边界场景。
  `tests/unit/test_object_sync_service.py`

- [ ] 🟢 **9.5 E2E 缺数据连接页面测试**
  7 个 E2E 文件无 data-connection 相关。
  `e2e/` 目录

---

## 10. 代码可维护性

- [ ] 🟡 **10.1 6 处 in-method import 规避循环依赖**
  应通过依赖注入或中间层解耦。
  6 个 service 文件

- [ ] 🟡 **10.2 camelCase→snake_case key_map 三处重复**
  `_apply_*_change` 各维护一份 key_map，新增字段需 3 处同步更新，极易遗漏。
  `working_state_service.py:436-523`

- [ ] 🟡 **10.3 Alembic downgrade 实质性缺失确认**
  10 个迁移的 `downgrade()` 是否为空 `pass`。
  `alembic/versions/0002*.py`, `0008*.py`, `0010*.py`

- [ ] 🟢 **10.4 property_service.py 691 行建议拆分**
  PK/TK cascade、batch 操作、sort order 等职责过多。
  `property_service.py`

---

## 执行节奏

| 日期 | 目标 | 审查项 |
|------|------|--------|
| Day 1 | 🔴 状态机 + 安全 | 1.1, 1.2, 7.1, 7.2, 8.1 |
| Day 2 | 🔴 级联 + 并发 + 测试 | 3.1, 4.1, 2.1, 9.1 |
| Day 3 | 🟡 状态机 + API | 1.3, 1.4, 2.2, 2.3, 2.4 |
| Day 4 | 🟡 级联 + 并发 + 缓存 | 3.2, 3.3, 4.2, 4.3, 5.1, 5.2 |
| Day 5 | 🟡 UX + 性能 + 测试 | 6.1, 6.2, 7.3, 7.4, 8.2, 8.3 |
| Day 6 | 🟡 测试 + 可维护性 | 9.2, 9.3, 9.4, 10.1, 10.2, 10.3 |
| Day 7 | 🟢 收尾 | 5.3, 6.3, 6.4, 8.4, 9.5, 10.4 |

## 每日收工检查

```bash
# 后端测试
cd apps/server && uv run pytest -v

# 前端测试
cd apps/web && pnpm test --run

# E2E（HIGH 修复完成后）
npx playwright test --reporter=list
```

---

## 审查记录

> 每项完成后在此记录结论（已修复 / 误报 / 延后 v0.2.0）

### 1.1 discard_single_change 孤儿变更
- **结论**: 已修复
- **修复内容**: 在 `discard_single_change` 中添加级联撤销逻辑 — 撤销 OT DELETE 时自动检测并移除关联的 Property DELETE（通过 `before.objectTypeRid`）和 LinkType DELETE（通过 `get_related_link_type_rids`）变更
- **影响文件**: `working_state_service.py`
- **测试**: `test_history_service.py::test_discard_ot_delete_cascades_property_and_lt_deletes`
- **日期**: 2026-03-24

### 1.2 _validate_completeness UPDATE 场景
- **结论**: 已修复
- **修复内容**: UPDATE 变更的 `after` 仅含变更字段，新增逻辑从 DB 查询已发布 OT 数据并 merge 后再校验完整性
- **影响文件**: `working_state_service.py`
- **测试**: `test_completeness_validation.py::test_update_merges_with_published_data`
- **日期**: 2026-03-24

### 1.3 Collapse DELETE→CREATE 重建路径
- **结论**: 已修复
- **修复内容**: 在 `_collapse_change` 中添加 `existing.change_type == DELETE` 分支：DELETE+CREATE → UPDATE（资源仍存在于已发布状态），DELETE+DELETE → 幂等保留原 DELETE
- **影响文件**: `working_state_service.py`
- **测试**: `test_change_collapsing.py::test_delete_then_create_becomes_update`, `test_delete_then_delete_is_idempotent`
- **日期**: 2026-03-24

### 1.4 publish sync 失败的事务隔离
- **结论**: 确认设计正确（非问题）
- **分析**: `_trigger_post_publish_sync` 在 `flush()` 后、`commit()` 前调用。异常被 per-OT 捕获并仅 log，不影响 publish 事务。`database.py` 的 `get_db_session()` 在 handler 返回后才 commit，sync 失败不阻止 publish 提交。sync 是 best-effort 后处理，设计符合预期。
- **日期**: 2026-03-24

### 2.1 路由层 rid 参数无格式校验
- **结论**: 已修复
- **修复内容**: 在 `validators.py` 中添加 `validate_rid()` 函数（正则 `^ri\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-zA-Z0-9]+$`，最大 200 字符），并在 `object_types.py`、`link_types.py`、`ontology.py`、`properties.py` 路由中所有 `rid` 路径参数处调用
- **影响文件**: `validators.py`, `routers/object_types.py`, `routers/link_types.py`, `routers/ontology.py`, `routers/properties.py`
- **测试**: `test_validators.py::TestValidateRid`（8 个用例）
- **日期**: 2026-03-24

### 2.2 分页参数上限不一致
- **结论**: 误报（已统一）
- **分析**: 所有分页路由均使用 `MAX_PAGE_SIZE=100`（`constants.py`），history 的 `le=100` 与 OT/LT 的 `le=MAX_PAGE_SIZE` 等价。Properties 按 OT 维度返回全量（无分页需求）。
- **日期**: 2026-03-24

### 2.3 search types 参数无枚举校验
- **结论**: 误报（已有校验）
- **分析**: `routers/search.py` 已有 `VALID_TYPES = {"objectType", "property", "linkType"}` 枚举校验，非法 type 返回 400 + `SEARCH_INVALID_TYPE` 错误码。集成测试 `test_search_invalid_type_returns_400` 已覆盖。
- **日期**: 2026-03-24

### 2.4 skipGlobalError mutation 缺本地 onError
- **结论**: 误报（均已处理）
- **分析**: 审查全部 7 个 `skipGlobalError: true` 的 mutation（OT create/delete、LT create/delete、Property create/update/delete），调用方均在 `mutateAsync()` 外包裹 try-catch 并通过 `message.error()` 展示服务端错误。
- **日期**: 2026-03-24

### 3.1 OT 删除级联遗漏 draft LinkTypes
- **结论**: 已修复
- **修复内容**: 在 `object_type_service.delete()` 中新增 WS 草稿 LinkType 扫描 — 除查询 DB 已发布 LT 外，额外检查 WS 中 CREATE/UPDATE 的 LT 变更，若 `sideA.objectTypeRid` 或 `sideB.objectTypeRid` 匹配被删除 OT，则生成对应 DELETE 变更
- **影响文件**: `object_type_service.py`
- **日期**: 2026-03-24

### 3.2 Dataset 删除对 WS 草稿 OT 引用的覆盖确认
- **结论**: 误报（已正确覆盖）
- **分析**: `_get_ws_backing_map()` 正确扫描 WS 中 `ChangeType.CREATE` 和 `ChangeType.UPDATE` 的 OT 变更，提取 `backingDatasource.rid`。`get_in_use_map()` 合并 published + WS 引用并排除被 DELETE 的 OT。覆盖完整。
- **日期**: 2026-03-24

### 3.3 Property 删除时 OT 的 PK/TK 引用清理
- **结论**: 已修复（TK 保护缺失）
- **修复内容**: PK 属性删除已有保护（返回 400），但 TK（Title Key）属性无同等保护。在 `delete()` 和 `batch_delete()` 中添加 `isTitleKey` 检查，删除 TK 属性时返回 `PROPERTY_TITLE_KEY_CANNOT_DELETE` 错误，要求用户先重新指定 TK
- **影响文件**: `property_service.py`
- **日期**: 2026-03-24

### 4.1 WorkingState read-modify-write 无乐观锁
- **结论**: 已修复
- **修复内容**: 在 `WorkingStateStorage.get_by_ontology()` 中添加 `for_update` 参数支持 `SELECT ... FOR UPDATE` 行锁。`add_change()` 和 `add_changes()` 通过 `get_or_create(for_update=True)` 获取 WS 时加行锁，阻塞并发写入直至当前事务提交
- **影响文件**: `working_state_storage.py`, `working_state_service.py`
- **日期**: 2026-03-24

### 4.2 process-local singleton 多 worker 失效
- **结论**: MVP 可接受，延后 v0.2.0
- **分析**: MVP 部署为单 worker (`uvicorn --reload`)，内存 dict 正常工作。代码中已有 TODO 注释标注多 worker 部署时需迁移到 Redis/DB 存储。`ImportTaskService` 和 `_preview_cache` 仅用于文件导入预览（临时数据，30min/1h 自动清理），不影响核心数据完整性。
- **日期**: 2026-03-24

### 4.3 publish 与并发 CRUD 的竞态
- **结论**: 事务隔离足够，延后 v0.2.0
- **分析**: PostgreSQL READ COMMITTED 隔离 + SQLAlchemy async session 提供语句级原子性。`publish()` 全程在同一 session 中执行（load → validate → apply → delete WS → flush），4.1 的 `FOR UPDATE` 行锁额外保证了 publish 期间 WS 不会被并发修改。并发 `add_change` 会阻塞等待 publish 完成后创建新 WS。
- **日期**: 2026-03-24

### 5.1 staleTime 策略不一致
- **结论**: 已修复
- **修复内容**: (1) 将 `search.ts` 的 staleTime 从 30s 降至 5s，与 working-state 保持一致。(2) 为所有 CRUD mutation（OT create/update、LT create/update/delete、Property create/update/delete）添加 WS + search 缓存失效（`invalidateQueries(['working-state'])` + `invalidateQueries(['search'])`），确保任何数据变更后搜索和变更面板立即更新
- **影响文件**: `api/search.ts`, `api/object-types.ts`, `api/link-types.ts`, `api/properties.ts`
- **日期**: 2026-03-24

### 5.2 LT 删除缺少 properties 缓存失效
- **结论**: 误报
- **分析**: 后端 `link_type_service.delete()` 仅生成 LT 的 DELETE 变更，不级联删除 Properties。LT 删除后 Property 数据未变化，property 缓存不会过期。无需额外失效。
- **日期**: 2026-03-24

### 5.3 useWorkingState 404→null 语义模糊
- **结论**: 误报（设计正确）
- **分析**: 404 返回 `null`（无草稿），非 404 错误 re-throw。TanStack Query 的 `isError` 标志可区分网络错误。6 处 consumer 均使用 `data: ws` 解构 + `ws?.changes` 可选链，正确处理 null 场景。
- **日期**: 2026-03-24

### 6.1 仅全局 ErrorBoundary，无页面级降级
- **结论**: 延后 v0.2.0
- **分析**: 全局 `errorElement` 在 `router.tsx` 根路由已覆盖。MVP 用户为内部技术人员，全局 ErrorBoundary 足够。页面级 ErrorBoundary 可在 v0.2.0 按需添加到复杂页面（如 ObjectTypeDetailLayout、DataConnectionPage）。
- **日期**: 2026-03-24

### 6.2 代码分割不足
- **结论**: 已修复
- **修复内容**: 将 13 个业务页面从同步 import 改为 `React.lazy()` + `Suspense` 懒加载。新增 `PageSuspense` 包装组件（带 `Spin` loading 状态）。保留 `NotFoundPage` 和 `PlaceholderPage` 为同步导入（体积小、作为降级页面需即时可用）
- **影响文件**: `router.tsx`
- **日期**: 2026-03-24

### 6.3 无障碍属性缺失
- **结论**: 延后 v0.2.0
- **分析**: Ant Design 组件自带基础 ARIA 属性（Form 的 label 关联、Button 的 role 等）。自定义组件缺少额外 ARIA 标注，但 MVP 用户为内部技术团队，无障碍合规非 MVP 阻塞项。v0.2.0 可优先添加 icon-only 按钮的 `aria-label` 和通知区域的 `aria-live`。
- **日期**: 2026-03-24

### 6.4 Publish/Discard 操作防误触机制
- **结论**: 误报（已实现）
- **分析**: Discard All 操作在 `SaveDialog.tsx` 和 `ChangeActions.tsx` 中均使用 `Modal.confirm()` 二次确认（带红色 danger 按钮）。Publish/Save 通过 Changes 列表审阅 + Errors 标签禁用机制提供足够安全保障。
- **日期**: 2026-03-24
