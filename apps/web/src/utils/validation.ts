const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const API_NAME_PATTERN = /^[A-Z][a-zA-Z0-9_]*$/;
const RESERVED_API_NAMES = [
  'ontology',
  'object',
  'property',
  'link',
  'relation',
  'rid',
  'primarykey',
  'typeid',
  'ontologyobject',
];

export function validateObjectTypeId(value: string): string | null {
  if (!value) return null;
  if (!ID_PATTERN.test(value)) {
    return 'validation.idFormat';
  }
  return null;
}

export function validateApiName(value: string): string | null {
  if (!value) return null;
  if (!API_NAME_PATTERN.test(value)) {
    return 'validation.apiNameFormat';
  }
  if (RESERVED_API_NAMES.includes(value.toLowerCase())) {
    return 'validation.apiNameReserved';
  }
  return null;
}
