export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toCamelCase(str: string): string {
  const parts = str.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (
    parts[0]!.toLowerCase() +
    parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
}

export function sanitizePropertyId(raw: string): string {
  const kebab = toKebabCase(raw);
  if (!kebab) return 'property';
  if (/^\d/.test(kebab)) return `p-${kebab}`;
  return kebab;
}

export function sanitizePropertyApiName(raw: string): string {
  const camel = toCamelCase(raw);
  if (!camel) return 'property';
  if (/^\d/.test(camel)) return `p${camel.charAt(0).toUpperCase() + camel.slice(1)}`;
  return camel;
}
