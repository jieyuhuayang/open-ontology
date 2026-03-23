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
| 1. 状态机与数据完整性 | 2 | 2 | 0 | 0/4 |
| 2. API 契约与边界验证 | 1 | 3 | 0 | 0/4 |
| 3. 级联操作与引用完整性 | 1 | 2 | 0 | 0/3 |
| 4. 并发与事务安全 | 1 | 2 | 0 | 0/3 |
| 5. 前端状态管理与缓存 | 0 | 2 | 1 | 0/3 |
| 6. 前端 UX 健壮性 | 0 | 2 | 2 | 0/4 |
| 7. 安全性 | 2 | 2 | 0 | 0/4 |
| 8. 性能 | 1 | 2 | 1 | 0/4 |
| 9. 测试覆盖缺口 | 1 | 3 | 1 | 0/5 |
| 10. 代码可维护性 | 0 | 3 | 1 | 0/4 |
| **合计** | **10** | **19** | **7** | **0/36** |

---

## 1. 状态机与数据完整性

- [ ] 🔴 **1.1 discard_single_change 孤儿变更问题**
  撤销 OT DELETE change 后，级联的 Property/LinkType DELETE changes 仍留在 WS 中，publish 时会删除仍在使用的子资源。
  `working_state_service.py:594-619`, `object_type_service.py:301-369`

- [ ] 🔴 **1.2 _validate_completeness 对 UPDATE 场景不完整**
  UPDATE 的 `after` 只含变更字段（非完整快照），校验可能误判 OT 为 incomplete。
  `working_state_service.py:265-303`

- [ ] 🟡 **1.3 Collapse 逻辑 DELETE→CREATE 重建路径缺失**
  对同一 RID 先 DELETE 再 CREATE，`_collapse_change` 未处理 `existing.change_type == DELETE` 分支。
  `working_state_service.py:108-147`

- [ ] 🟡 **1.4 publish 中 sync 失败的事务隔离确认**
  `_trigger_post_publish_sync` 中 sync 失败只 log 不 raise，需确认不影响 publish 事务完整性。
  `working_state_service.py:354-425`, `database.py:11-18`

---

## 2. API 契约与边界验证

- [ ] 🔴 **2.1 路由层 rid 参数无格式校验**
  恶意 RID（超长/特殊字符）直接传入 DB 查询，应统一校验 `ri.` 前缀格式。
  `routers/object_types.py`, `routers/link_types.py`, `routers/ontology.py`

- [ ] 🟡 **2.2 分页参数上限不一致**
  history 限 `page_size le=100`，OT/LT/Property list 是否有同样限制？
  `routers/ontology.py:55`, `routers/object_types.py`, `routers/properties.py`

- [ ] 🟡 **2.3 search types 参数无枚举校验**
  未知类型（如 `"actionType"`）静默忽略，掩盖前端拼写错误。
  `routers/search.py`, `search_service.py:23-45`

- [ ] 🟡 **2.4 skipGlobalError mutation 缺本地 onError**
  15 个设置 `skipGlobalError` 的 mutation 是否都有对应错误处理？
  `api/object-types.ts`, `api/link-types.ts`, `api/properties.ts`

---

## 3. 级联操作与引用完整性

- [ ] 🔴 **3.1 OT 删除级联遗漏 draft LinkTypes**
  `get_related_link_type_rids` 只查 DB 已发布 LinkType，WS 中 CREATE 的草稿 LinkType（引用该 OT）不会被级联删除。
  `object_type_service.py:342-354`, `object_type_storage.py`

- [ ] 🟡 **3.2 Dataset 删除对 WS 草稿 OT 引用的覆盖确认**
  `get_in_use_map()` 是否完整覆盖 CREATE 草稿 OT 的 `backingDatasource`。
  `dataset_service.py:234-249`

- [ ] 🟡 **3.3 Property 删除时 OT 的 PK/TK 引用清理**
  删除 `isPrimaryKey` 的 Property 时，OT 的 `primaryKeyPropertyId` 是否同步清空？
  `property_service.py` delete/batch_delete 方法

---

## 4. 并发与事务安全

- [ ] 🔴 **4.1 WorkingState read-modify-write 无乐观锁**
  并发 `add_change` 可能互相覆盖。应在 `working_states` 表增加版本号 + `WHERE version = N`。
  `working_state_service.py:149-153`, `working_state_storage.py`

- [ ] 🟡 **4.2 process-local singleton 多 worker 失效**
  `ImportTaskService` 和 `_preview_cache` 是内存 dict，多 worker 下前端轮询可能打到不同 worker。
  `import_task_service.py:41`, `file_import_service.py:27`

- [ ] 🟡 **4.3 publish 与并发 CRUD 的竞态**
  publish apply changes 过程中新 change 写入即将被清空的 WS。
  `working_state_service.py:354-419`, `database.py`

---

## 5. 前端状态管理与缓存

- [ ] 🟡 **5.1 staleTime 策略不一致**
  search 30s 缓存 vs OT 无 staleTime，修改 OT 后搜索结果可能延迟更新。
  `api/search.ts:20`, `api/working-state.ts:36`

- [ ] 🟡 **5.2 LT 删除缺少 properties 缓存失效**
  BO LinkType 删除可能级联清理属性，但 `propertyKeys` 未失效。
  `api/link-types.ts:116-117`

- [ ] 🟢 **5.3 useWorkingState 404→null 语义模糊**
  无法区分"无草稿"和"网络错误"，消费方处理是否正确。
  `api/working-state.ts:22-34`

---

## 6. 前端 UX 健壮性

- [ ] 🟡 **6.1 仅全局 ErrorBoundary，无页面级降级**
  任何页面渲染崩溃导致全站白屏，高复杂度页面应有独立 ErrorBoundary。
  `router.tsx:29`, `components/ErrorBoundary.tsx`

- [ ] 🟡 **6.2 代码分割不足**
  仅 demo 页 `lazy()`，11 个业务页同步 import，首屏加载过大。
  `router.tsx:7-19`

- [ ] 🟢 **6.3 无障碍属性缺失**
  整个 components 仅 3 处 `aria-` 属性，自定义组件缺 ARIA 标注。
  `components/` 全目录

- [ ] 🟢 **6.4 Publish/Discard 操作防误触机制确认**
  是否有 `Modal.confirm` 或类似二次确认。
  Save/Discard 相关组件

---

## 7. 安全性

- [ ] 🔴 **7.1 MySQL import SQL 注入风险**
  f-string 构造 SQL `f"SELECT {cols_sql} FROM \`{table}\`"`，table 名含反引号时可注入。
  `mysql_import_service.py:472-474`

- [ ] 🔴 **7.2 Live Dataset 预览 SQL 注入风险**
  `dataset_service._get_live_preview()` 中同样使用 f-string 构造 SQL。
  `dataset_service.py:186-191`

- [ ] 🟡 **7.3 ENCRYPTION_KEY 空值重启丢失**
  自动生成 key 进程重启后变化，已加密的 MySQL 连接密码无法解密。
  `crypto_service.py:12-44`, `config.py:8`

- [ ] 🟡 **7.4 文件上传临时目录无清理机制**
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

<!-- 示例：
### 1.1 discard_single_change 孤儿变更
- **结论**: 已修复
- **修复内容**: 在 discard_single_change 中添加级联撤销逻辑
- **影响文件**: working_state_service.py
- **日期**: 2026-03-25
-->
