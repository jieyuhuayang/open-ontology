# Feature: <名称>

> **⚠️ 写 spec 前，必须完整准确理解 PRD（不可遗漏任何功能点）。**
> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。
> 如有跨 feature 依赖，必须在"依赖与约束"节中声明，并对照 release-contract.md。

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §章节名]
**架构参考**: [docs/architecture/01-system-architecture.md §章节]
**优先级**: P0 / P1 / P2
**所属版本**: v0.1.0

---

## 1. 概述与用户故事

作为 **<角色>**（如：本体管理员、业务分析师、LLM Agent），
我希望 **<目标>**，
以便 **<价值>**。

---

## 2. 验收标准

> AC-ID 在本特性内唯一，格式 `AC-NN`。tasks.md 中的测试任务必须通过 `覆盖 AC: AC-NN` 追溯到此表。

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | <角色> | <执行什么操作> | <系统返回/显示什么，含 HTTP 状态码或错误码> |
| AC-02 | <角色> | <执行什么操作> | <系统返回/显示什么，含 HTTP 状态码或错误码> |
| AC-03 | <角色> | <边界/错误场景操作> | <错误码，如 `DATASET_IN_USE`，HTTP 4XX> |

---

## 3. 边界情况

- 当 <异常场景> 时，系统应 <预期行为>
- 当 <并发场景> 时，系统应 <预期行为>
- **不支持**：<明确排除的功能>（延后到 vX.X.X）

---

## 4. 架构决策

描述本特性涉及的关键技术决策，以及选择该方案的理由。

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | <决策主题> | A: ... / B: ... | 选 A | <理由> |

---

## 5. 数据库 & Domain 模型

### PostgreSQL 表定义

```sql
CREATE TABLE <table_name> (
    rid         TEXT PRIMARY KEY,  -- 格式: ri.<namespace>.<type>.<uuid4>
    -- 字段定义
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Pydantic Schema（后端）

```python
class <ModelName>Base(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    # 共享字段

class <ModelName>Create(<ModelName>Base):
    # 创建时必填字段

class <ModelName>Response(<ModelName>Base):
    rid: str
    created_at: datetime
    # 响应字段
```

---

## 6. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/<resource>` | 列表查询 |
| POST | `/api/v1/<resource>` | 创建 |
| GET | `/api/v1/<resource>/{rid}` | 详情 |
| PUT | `/api/v1/<resource>/{rid}` | 更新 |
| DELETE | `/api/v1/<resource>/{rid}` | 删除 |

### 请求/响应示例

```json
// POST /api/v1/<resource>
// Request
{
  "field": "value"
}

// Response 201
{
  "rid": "ri.namespace.type.uuid",
  "field": "value",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | AC-0X |
| 404 | `NOT_FOUND` | 资源不存在 | AC-0X |
| 409 | `CONFLICT` | 唯一性冲突（如 API name 重复） | AC-0X |

---

## 7. Service / Router 层逻辑

> 描述核心业务逻辑的流程和职责划分，不写具体实现代码。

- **<ServiceName>**: <职责概述>
- **<RouterName>**: <HTTP 解析 + 委托逻辑>

---

## 8. 前端组件设计（如适用）

### 页面结构

```
<PageName>
├── <HeaderComponent>         # 标题 + 操作按钮
├── <ListComponent>           # 列表/表格
│   └── <ListItemComponent>   # 单行
└── <FormDrawer>              # 创建/编辑抽屉
    └── <FormComponent>       # 表单字段
```

### 路由

```
/ontology/<resource>           # 列表页
/ontology/<resource>/:rid      # 详情页（如需）
```

---

## 9. 文件清单

列出本特性将新建或修改的所有文件：

```
apps/server/
├── alembic/versions/NNN_<migration>.py    # 新建
├── app/domain/models/<model>.py           # 新建
├── app/routers/<resource>.py              # 新建
├── app/services/<resource>_service.py     # 新建
└── app/storage/<resource>_storage.py      # 新建

apps/web/
├── src/pages/<ResourcePage>/
│   ├── index.tsx                          # 新建
│   └── components/
│       ├── <Resource>List.tsx             # 新建
│       └── <Resource>Form.tsx             # 新建
└── src/api/<resource>.ts                  # 新建
```

---

## 非功能要求

- **性能**: <响应时间、吞吐量等>
- **安全**: <权限控制、数据隔离等>
- **可用性**: <错误提示、加载状态等>

---

## 相关文档

- 架构参考: [docs/architecture/XX-name.md §章节]
- 领域术语: [docs/specs/terminology.md]
- 依赖特性: [features/v0.1.0/NNN-name]
- 版本契约: [features/vX.X.X/release-contract.md]（写 spec 前必须先阅读）
