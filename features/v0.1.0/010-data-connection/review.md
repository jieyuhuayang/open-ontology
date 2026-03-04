# 010 Data Connection 技术方案评审意见（2026-03-04）

## 评审范围

- PRD：`docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md` 第 2.1-2.4 节（重点：2.1.1.1 数据集选择交互）
- 需求规格：`features/v0.1.0/010-data-connection/spec.md`
- 技术方案：`features/v0.1.0/010-data-connection/design.md`

## 评审结论

当前结论：**有条件通过（需先修订）**。  
在进入 `tasks.md` 前，建议先完成 **2 个 Critical + 4 个 Major** 问题的文档修订并达成共识。

---

## 评审发现（按严重级别）

### Critical-1：INV-3（Dataset 1:1 绑定）缺少“强约束”落地，存在并发冲突风险

**证据**
- PRD 明确要求“同一个数据集只能用于底层一个对象类型”（PRD:342）并在保存时给出占用错误（PRD:521-523）。
- `spec.md` 将 INV-3 描述为“通过 in_use 状态标记实现”（spec:160）。
- `design.md` 的结构定义只看到 `object_types.backing_datasource` 字段（design:101-105），未定义唯一性约束与冲突错误契约。

**影响**
- 仅靠列表 `in_use` 标记无法防并发写入，可能出现同一 Dataset 被多个 ObjectType 绑定，违反 PRD 与 release-contract 不变量。

**建议**
- 在 Owner Feature（003-object-type-crud）侧增加数据库级唯一约束（建议对 `backing_datasource.datasetRid` 建唯一索引/等效约束）。
- 明确保存冲突错误码（与 PRD `DatasetAndBranchAlreadyRegistered` 对齐，或定义统一映射）。
- 010 的职责保留为“只读态 in_use 计算 + 占用者信息返回”，不承担最终写入唯一性保障。

### Critical-2：SQL 注入修复策略仍偏弱，正则校验不能替代安全 SQL 组装

**证据**
- `design.md` 将 C1 修复定义为表名正则白名单（design:36, 254-257），且二次白名单仅作为“额外方案”。
- 同文档明确当前存在 SQL 拼接表名问题（design:36）。

**影响**
- 若后续代码路径漏掉该正则，或 SQL 拼接位置新增未复用校验逻辑，风险会回归。

**建议**
- 将“连接内真实表名白名单校验 + 安全标识符引用/转义”升级为**必选方案**，不是“额外方案”。
- 在 design 的 API/服务契约中明确：任何含 `table` 输入的查询必须先完成白名单匹配。

### Major-1：无法完整支撑 PRD 2.1.1.1 的 `In use` Tooltip 文案要求

**证据**
- PRD 要求 Tooltip 显示“该数据集已被 `<ObjectTypeName>` 关联”（PRD:261）。
- `spec.md` 的 Dataset 列表仅要求 `in_use` 状态（spec:115, 128）。
- `design.md` API 只定义了端点，不含 Dataset 列表 response 字段契约（design:189）。

**影响**
- 003 前端在对象类型创建向导里无法直接展示占用者名称，需额外查询或降级 UX，导致与 PRD 细节不一致。

**建议**
- 补充 DatasetListItem 契约字段：`inUseByObjectTypeRid`、`inUseByObjectTypeName`（至少提供名称）。
- 在 010 的 spec/design 中明确该字段由哪个服务计算、何时可为空。

### Major-2：导入任务状态仅存内存（单 worker 假设）缺少发布约束声明

**证据**
- AD-3 指定 `ImportTaskService` 进程内存 + TTL 1h（design:27）。
- 规格要求任务状态可轮询（spec:95, 150）。

**影响**
- 多进程部署或服务重启时，任务状态可能丢失，轮询体验不稳定。

**建议**
- 方案二选一并写入 design：
  1. 明确 v0.1.0 运行约束：仅单 worker（并在部署文档固化）。
  2. 改为 DB 持久化 `import_tasks`（更稳妥，推荐）。

### Major-3：新增“10 万行导入上限”未在 spec/PRD 契约声明，属于行为漂移

**证据**
- `design.md` 新增 AD-11 与 `ROW_LIMIT_EXCEEDED`（design:40, 276-277）。
- `spec.md` 当前未声明该限制（spec:146-150）。

**影响**
- 会新增 422 失败路径，但不在验收标准内，测试与产品预期不一致。

**建议**
- 若保留上限：回写 `spec.md`（AC + 非功能 + 边界情况）并补充 UI 错误文案。
- 若不保留：移除 AD-11 与对应错误码。

### Major-4：MySQL 连接删除已进入 design，但 spec 缺少对应 AC

**证据**
- `design.md` 新增 `DELETE /api/v1/mysql-connections/{rid}`（design:194-198）。
- `spec.md` 虽写“仅支持新建和删除”（spec:142），但 AC-CM 无删除场景（spec:81-85）。

**影响**
- 实现与验收脱节，测试覆盖无法闭环。

**建议**
- 在 spec 增加连接删除 AC（成功删除、RID 不存在、被导入任务占用时行为等）。

---

## 建议回写清单（进入 tasks 前）

1. 回写 `spec.md`：补齐连接删除 AC、行数上限（若保留）、`inUseByObjectTypeName` 字段要求。  
2. 回写 `design.md`：把 INV-3 的强约束方案和跨 Feature 错误码映射写清楚。  
3. 与 003 feature 对齐：确认 Dataset 绑定冲突由谁在“保存 ObjectType”时最终兜底。  
4. 确认导入任务状态存储策略（单 worker 强约束 or DB 持久化）。

---

## 通过条件

满足以下条件后，建议进入 `tasks.md` 阶段：

- 已关闭全部 Critical 问题；
- Major 问题均有明确决议并回写到 spec/design；
- 003 与 010 的 INV-3 责任边界形成书面契约（避免实现期再返工）。
