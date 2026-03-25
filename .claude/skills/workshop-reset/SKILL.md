---
name: workshop-reset
description: >-
  重置 Workshop 全流程数据（Agent 会话、素材、蓝图、已应用的本体实体），用于本地开发反复测试。
  用法：/workshop-reset [A|B|C]
  TRIGGER when: 用户要求重置 workshop、清理测试数据、重新体验全流程、从头开始测试。
---

# Workshop Reset

重置 Workshop 相关数据，支持三种模式。通过 `docker exec psql` 直接执行 SQL，不走 Service 层（避免 status 检查阻断、working state 复杂性）。

## 模式说明

| 模式 | 范围 | 适用场景 |
|------|------|----------|
| **A** | 仅 Agent 数据（会话/消息/素材/蓝图） | 保留已创建的本体，只清 Agent 会话 |
| **B** | Agent 数据 + 蓝图 apply 创建的实体 | 撤销蓝图效果，回到 apply 前状态 |
| **C** | Agent 数据 + 清空整个 ontology 的所有实体 | 彻底回到空白本体 |

## 执行步骤

### Step 1: 数据预览（始终先执行）

运行以下查询展示当前数据量，让用户了解将被清理的内容：

```bash
docker exec -i openontology-db-1 psql -U ontology -d open_ontology -c "
SELECT 'agent_sessions' AS table_name, COUNT(*) AS count FROM agent_sessions
UNION ALL SELECT 'agent_messages', COUNT(*) FROM agent_messages
UNION ALL SELECT 'agent_materials', COUNT(*) FROM agent_materials
UNION ALL SELECT 'blueprints', COUNT(*) FROM blueprints
UNION ALL SELECT 'blueprint_items', COUNT(*) FROM blueprint_items
UNION ALL SELECT 'applied_entities', COUNT(*) FROM blueprint_items WHERE created_entity_rid IS NOT NULL
ORDER BY table_name;
"
```

如果有已应用实体（applied_entities > 0），还要查具体内容：

```bash
docker exec -i openontology-db-1 psql -U ontology -d open_ontology -c "
SELECT bi.item_type, bi.created_entity_rid,
       COALESCE(ot.display_name, lt.id, '(property)') AS entity_name
FROM blueprint_items bi
LEFT JOIN object_types ot ON bi.created_entity_rid = ot.rid AND bi.item_type = 'object_type'
LEFT JOIN link_types lt ON bi.created_entity_rid = lt.rid AND bi.item_type = 'link_type'
WHERE bi.created_entity_rid IS NOT NULL
ORDER BY bi.item_type;
"
```

检查磁盘素材文件：

```bash
du -sh apps/server/uploads/materials/ 2>/dev/null || echo "无素材文件目录"
```

### Step 2: 确认模式

向用户展示预览结果，并询问选择哪种模式（A/B/C）。如果用户在调用时已指定模式（如 `/workshop-reset C`），直接使用。

对于模式 C，额外警告："这将清空 ontology 下的**所有** Object Types、Properties、Link Types，包括非蓝图创建的实体。"

### Step 3: 执行删除

根据选择的模式执行。**所有 SQL 在一个事务中执行以确保原子性。**

#### 模式 A: 仅 Agent 数据

```bash
# 清理磁盘素材文件
rm -rf apps/server/uploads/materials/*/

# 删除 Agent 数据（CASCADE 处理子表）
docker exec -i openontology-db-1 psql -U ontology -d open_ontology -c "
BEGIN;
DELETE FROM agent_sessions;
COMMIT;
"
```

#### 模式 B: Agent 数据 + 已应用实体

```bash
# 清理磁盘素材文件
rm -rf apps/server/uploads/materials/*/

# 在一个事务中：先删实体，再删 Agent 数据
docker exec -i openontology-db-1 psql -U ontology -d open_ontology <<'SQL'
BEGIN;

-- 创建临时表收集要删除的实体 RID（必须在删 blueprint_items 之前！）
CREATE TEMP TABLE _bp_entities AS
SELECT created_entity_rid AS rid, item_type
FROM blueprint_items
WHERE created_entity_rid IS NOT NULL;

-- 阶段 1: 删除蓝图创建的本体实体（FK 安全顺序）
-- 1a. 删除蓝图创建的 LT 的端点
DELETE FROM link_type_endpoints
WHERE link_type_rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'link_type');

-- 1b. 删除蓝图创建的 OT 关联的端点（其他 LT 引用了这些 OT）
DELETE FROM link_type_endpoints
WHERE object_type_rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'object_type');

-- 1c. 删除蓝图创建的 Link Types
DELETE FROM link_types
WHERE rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'link_type');

-- 1d. 删除蓝图创建的 Properties
DELETE FROM properties
WHERE rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'property');

-- 1e. 删除蓝图创建的 OT 下的所有 Properties（可能有非蓝图单独创建的属性挂在蓝图OT下）
DELETE FROM properties
WHERE object_type_rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'object_type');

-- 1f. 删除蓝图创建的 OT 的对象实例和同步任务
DELETE FROM object_instances
WHERE object_type_rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'object_type');
DELETE FROM sync_jobs
WHERE object_type_rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'object_type');

-- 1g. 删除蓝图创建的 Object Types
DELETE FROM object_types
WHERE rid IN (SELECT rid FROM _bp_entities WHERE item_type = 'object_type');

-- 阶段 2: 清理 working_states（JSONB 中引用了已删实体）
DELETE FROM working_states;

-- 阶段 3: 删除 Agent 数据
DELETE FROM agent_sessions;

DROP TABLE _bp_entities;
COMMIT;
SQL
```

#### 模式 C: 完全重置

```bash
# 清理磁盘素材文件
rm -rf apps/server/uploads/materials/*/

# 清空所有本体实体 + Agent 数据
docker exec -i openontology-db-1 psql -U ontology -d open_ontology <<'SQL'
BEGIN;

-- 阶段 1: 清空所有本体实体（FK 安全顺序）
DELETE FROM link_type_endpoints;
DELETE FROM link_types;
DELETE FROM object_instances;
DELETE FROM sync_jobs;
DELETE FROM properties;
DELETE FROM object_types;
DELETE FROM change_records;
DELETE FROM working_states;

-- 重置 ontology 版本号
UPDATE ontologies SET version = 0;

-- 阶段 2: 删除 Agent 数据
DELETE FROM agent_sessions;

COMMIT;
SQL
```

### Step 4: 验证 + 摘要

执行验证查询确认清理结果：

```bash
docker exec -i openontology-db-1 psql -U ontology -d open_ontology -c "
SELECT 'agent_sessions' AS table_name, COUNT(*) AS remaining FROM agent_sessions
UNION ALL SELECT 'blueprints', COUNT(*) FROM blueprints
UNION ALL SELECT 'object_types', COUNT(*) FROM object_types
UNION ALL SELECT 'link_types', COUNT(*) FROM link_types
UNION ALL SELECT 'properties', COUNT(*) FROM properties
ORDER BY table_name;
"
```

输出清理摘要，包含删除的各类数据数量。

## 安全边界

以下数据**不会被任何模式删除**：
- `spaces` — 顶层容器
- `ontologies` — 本体容器（仅模式 C 重置 version=0）
- `datasets` — 数据集定义
- `mysql_connections` — MySQL 连接配置
- `agent_audit_logs` — 审计日志（session_rid 被 SET NULL 保留）

## 样本素材

重置后如需快速重新测试，可使用预置样本素材：

```
ops/workshop-samples/
├── cofco-grease-ddl.sql    # 大宗商品 DDL（6 张核心表，含业务 COMMENT）
├── soybean-balance.csv     # 美/巴/阿 大豆平衡表（30 行）
├── weather-data.csv        # 降水+温度数据（20 行）
└── trade-export.csv        # 出口明细+油粕价格（20 行）
```

在 Workshop 中将这些文件拖入 Chat Panel 的上传区即可。

## 故障处理

| 问题 | 解决 |
|------|------|
| `docker exec` 连接失败 | 运行 `docker compose up -d db` 启动 PostgreSQL |
| FK violation 错误 | 检查是否有非蓝图创建的 LT 引用了蓝图创建的 OT，考虑使用模式 C |
| 磁盘目录不存在 | 正常，`rm -rf` 对不存在的路径不报错 |
