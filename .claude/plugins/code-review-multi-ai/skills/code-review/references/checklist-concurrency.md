# Concurrency & Data Integrity Checklist

Review the changed code for the following concurrency issues:

1. **Race conditions** - Could concurrent requests to the same endpoint cause data corruption? Are read-modify-write sequences atomic?
2. **Transaction isolation** - Are database operations that must be atomic wrapped in a single transaction? Could partial failures leave inconsistent state?
3. **Optimistic locking** - For update operations, is there a version check or `updated_at` comparison to prevent lost updates from concurrent edits?
4. **Deadlock potential** - Are multiple locks or database rows acquired in a consistent order? Could two concurrent operations deadlock each other?
5. **Async safety** - Are shared mutable objects accessed from async code without proper synchronization? Are there blocking calls (I/O, sleep) in async functions?
6. **Idempotency** - Are write operations idempotent or protected against duplicate submissions (e.g., by unique constraints or idempotency keys)?
7. **Cache consistency** - If caching is used (TanStack Query, in-memory), is the cache properly invalidated after mutations? Could stale data be served?
8. **Connection pool exhaustion** - Could the change hold database connections longer than necessary or leak connections on error paths?
