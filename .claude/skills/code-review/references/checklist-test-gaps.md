# Test Coverage Gaps Checklist

Review the changed code for the following test coverage issues:

1. **New service function without unit test** - Does every new/modified service function in `app/services/` have a corresponding test in `tests/unit/`?
2. **New API route without integration test** - Does every new/modified route in `app/routers/` have integration tests covering happy path + main error paths?
3. **New Zustand store without test** - Does every new/modified store in `stores/` have tests for core state transitions?
4. **New component without render test** - Does every new reusable component have at least a render test with Testing Library?
5. **Error path coverage** - Are error/exception paths tested (e.g., 404, 409, validation errors)? Not just the happy path?
6. **Boundary value tests** - Are edge cases (empty input, max values, special characters) covered in tests?
7. **Mock quality** - Are mocks realistic? Do they match actual API/DB response shapes? Are there over-broad mocks that hide real bugs?
8. **Assertion quality** - Do tests assert meaningful outcomes (not just "no error thrown")? Are response bodies, status codes, and side effects verified?
