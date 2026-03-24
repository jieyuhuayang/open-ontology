---
name: parse-document
description: 解析非结构化文档（PDF/Markdown/Word/纯文本），提取文本内容供 LLM 实体识别
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file_path | string | 是 | 文档文件的本地路径 |

## 约束

- PDF: 使用 pymupdf 提取文本；纯扫描件（无文本）标记失败
- DOCX: 使用 python-docx 提取段落文本
- MD/TXT: 直接读取
- 输出纯文本内容，实体/关系识别由 Agent LLM 自行完成

## CLI 命令

`oo material parse <file> --parser document`

## 使用场景

When the Agent receives a non-structured document (business process PDF, requirement spec, etc.). The parser extracts raw text, which the Agent then feeds to the LLM for entity and relationship extraction. Produces medium/low confidence suggestions.

## 示例

```bash
oo material parse business-process.pdf --parser document
# Output: extracted text content, character count
```
