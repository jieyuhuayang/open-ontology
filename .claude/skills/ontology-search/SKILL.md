---
name: ontology-search
description: 搜索本体资源（对象类型、属性、链接类型）。TRIGGER when: 用户要求搜索本体，或使用 /ontology-search 命令。
---

使用 `oo search` 命令进行全文搜索。

```bash
cd apps/server && PYTHONPATH=. uv run oo search "客户" [--type objectType] [--limit 20]
```

支持的 `--type` 值：`objectType`、`property`、`linkType`。不指定则搜索全部类型。
