# Permission & Authorization Checklist

Review the changed code for the following permission/authorization issues:

1. **Endpoint authentication** - Do new/modified API endpoints require authentication? Is the auth middleware/dependency applied?
2. **IDOR (Insecure Direct Object Reference)** - Can a user access/modify resources belonging to another user by manipulating IDs in the request?
3. **Batch operation permissions** - For bulk endpoints, is authorization checked per-item or only on the collection? Could a batch request sneak in unauthorized items?
4. **Path traversal** - Could user-supplied file paths or identifiers escape intended directories (e.g., `../../etc/passwd`)?
5. **Parameter tampering** - Can request body fields that should be server-determined (e.g., `owner_id`, `role`, `is_admin`) be set by the client?
6. **Privilege escalation** - Could a regular user invoke admin-only operations through the changed code paths?
7. **SQL/NoSQL injection** - Are user inputs properly parameterized in database queries? Are any raw SQL strings constructed with f-strings or concatenation?
8. **XSS/Script injection** - For frontend changes, is user-generated content properly escaped before rendering? Are `dangerouslySetInnerHTML` or equivalent used safely?
