---
name: ontology-create
description: 在本体中创建对象类型、属性或链接类型。TRIGGER when: 用户要求创建本体资源（对象类型、属性、链接类型），或使用 /ontology-create 命令。DO NOT TRIGGER when: 用户要求搜索、验证或管理蓝图。
---

使用 `oo` CLI 命令创建本体资源。参数约束详见 deepagents Skill 定义（`apps/server/app/agent/skills/`）。

## 创建对象类型

```bash
cd apps/server && PYTHONPATH=. uv run oo object-type create --name "Customer" [--api-name "Customer"] [--description "客户实体"]
```

## 创建属性

```bash
cd apps/server && PYTHONPATH=. uv run oo property create --object-type <OT_RID> --name "客户名称" --api-name "customerName" --type string [--description "客户的全名"]
```

## 创建链接类型

```bash
cd apps/server && PYTHONPATH=. uv run oo link-type create --id "customer-orders" --side-a-object <OT_A_RID> --side-a-name "Orders" --side-a-api-name "orders" --side-b-object <OT_B_RID> --side-b-name "Customer" --side-b-api-name "customer" --cardinality many-to-one
```

执行前确保后端运行中（`docker compose up -d db`）且数据库迁移已完成。
