# Log & Information Leakage Checklist

Review the changed code for the following information leakage issues:

1. **Sensitive data in logs** - Are passwords, tokens, API keys, or PII being logged? Check `logger.*`, `print()`, and `console.log()` calls.
2. **Stack trace exposure** - Could internal stack traces, file paths, or library versions leak to API responses in production?
3. **SQL echo mode** - Is SQLAlchemy `echo=True` or query logging enabled in non-debug configurations?
4. **Console.log in production** - Are there `console.log`, `console.debug`, or `console.warn` calls with sensitive data that will ship to production?
5. **Error response over-sharing** - Do error responses include internal details (database column names, internal IDs, query text) beyond the standard error format?
6. **Secrets in source** - Are there hardcoded credentials, API keys, connection strings, or secret tokens in the changed code?
7. **Debug endpoints** - Are there debug/test endpoints or feature flags that bypass security in the changed code?
8. **Verbose error messages** - Do validation error messages reveal system internals (e.g., "column 'x' does not exist" instead of a user-friendly message)?
