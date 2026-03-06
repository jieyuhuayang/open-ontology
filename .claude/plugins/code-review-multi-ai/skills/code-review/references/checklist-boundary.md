# Boundary Conditions Checklist

Review the changed code for the following boundary condition issues:

1. **Null/Undefined handling** - Are null, undefined, None, or empty string inputs handled? Could any variable be unexpectedly null at runtime?
2. **Empty collections** - Are empty arrays, lists, dicts, or querysets handled? Will `.map()`, `for...of`, or list comprehensions fail on empty input?
3. **Numeric boundaries** - Are there potential integer overflow, division by zero, negative index, or off-by-one errors?
4. **String boundaries** - Are empty strings, very long strings (>10KB), or strings with special characters (unicode, null bytes, newlines) handled?
5. **Pagination/Limit** - For paginated APIs: is page 0 vs page 1 correct? What happens at offset beyond total count? Is there a max limit enforced?
6. **Time/Date edge cases** - Are timezone conversions correct? Are midnight, DST transitions, or epoch 0 handled? Are date comparisons inclusive/exclusive as intended?
7. **Resource limits** - Could the change cause unbounded memory growth, infinite loops, or queries without LIMIT? Are file sizes or batch sizes capped?
8. **Type coercion** - Are there implicit type conversions that could cause unexpected behavior (e.g., string "0" as falsy, int/float mixing)?
