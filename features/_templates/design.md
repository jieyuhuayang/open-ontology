# 技术方案: <名称>

> **本文档只写契约和决策（Why + What），不写实现步骤（How）。**
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。

**关联规范**: [features/v0.1.0/NNN-name/spec.md]
**架构参考**: [docs/architecture/01-system-architecture.md §章节]

---

## 架构决策

描述本特性涉及的关键技术决策，以及选择该方案的理由。

- **决策 1**: <选项 A vs 选项 B> → 选择 A，因为 <理由>
- **决策 2**: ...

---

## 数据结构

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

## API 契约

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

### 错误码

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数不合法 | AC-0X |
| 404 | `NOT_FOUND` | 资源不存在 | AC-0X |
| 409 | `CONFLICT` | 唯一性冲突（如 API name 重复） | AC-0X |

---

## 前端组件

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

## 文件清单

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
