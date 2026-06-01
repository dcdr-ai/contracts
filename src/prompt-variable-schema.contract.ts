import { PromptVariable, PromptVariableType } from "./prompts.contract";

export enum PromptVariableSchemaIssueCode {
  ROOT_OBJECT = "ROOT_OBJECT",
  KEY_NAME_INVALID = "KEY_NAME_INVALID",
  DEFINITION_SHAPE = "DEFINITION_SHAPE",
  TYPE_INVALID = "TYPE_INVALID",
  ENUM_REQUIRES_FULL = "ENUM_REQUIRES_FULL",
  REQUIRED_BOOL = "REQUIRED_BOOL",
  DESCRIPTION_STRING = "DESCRIPTION_STRING",
  DESCRIPTION_LEN = "DESCRIPTION_LEN",
  MINMAX_TYPE = "MINMAX_TYPE",
  MINMAX_NUMBER = "MINMAX_NUMBER",
  MINMAX_INTEGER = "MINMAX_INTEGER",
  MINMAX_STRING_INT = "MINMAX_STRING_INT",
  MINMAX_ARRAY_INT = "MINMAX_ARRAY_INT",
  MINMAX_ORDER = "MINMAX_ORDER",
  ENUM_VALUES_REQUIRED = "ENUM_VALUES_REQUIRED",
  ENUM_VALUES_STRING = "ENUM_VALUES_STRING",
  ENUM_VALUES_EMPTY = "ENUM_VALUES_EMPTY",
  ENUM_VALUES_LEN = "ENUM_VALUES_LEN",
  ENUM_VALUES_UNIQUE = "ENUM_VALUES_UNIQUE",
  ENUM_FIELDS_DISALLOWED = "ENUM_FIELDS_DISALLOWED",
  OBJECT_FIELDS_DISALLOWED = "OBJECT_FIELDS_DISALLOWED",
  OBJECT_PROPERTIES_OBJECT = "OBJECT_PROPERTIES_OBJECT",
  ARRAY_ITEMS_TYPE_REQUIRED = "ARRAY_ITEMS_TYPE_REQUIRED",
  ARRAY_ITEMS_TYPE_INVALID = "ARRAY_ITEMS_TYPE_INVALID",
  ARRAY_ITEMS_TYPE_NO_ARRAY = "ARRAY_ITEMS_TYPE_NO_ARRAY",
  ARRAY_FIELDS_DISALLOWED = "ARRAY_FIELDS_DISALLOWED",
  ARRAY_OBJECT_PROPERTIES_REQUIRED = "ARRAY_OBJECT_PROPERTIES_REQUIRED",
  OBJECT_REQUIRES_FULL = "OBJECT_REQUIRES_FULL",
}

export interface PromptVariableSchemaIssue {
  path: string;
  code: PromptVariableSchemaIssueCode;
  params?: Record<string, string | number | boolean>;
}

export interface PromptVariableSchemaValidationResult {
  valid: boolean;
  issues: PromptVariableSchemaIssue[];
}

export interface PromptVariableSchemaCanonicalizeResult {
  valid: boolean;
  issues: PromptVariableSchemaIssue[];
  schema?: Record<string, PromptVariable>;
}

export interface PromptVariableSchemaValidationOptions {
  /** Reject shorthand "array" definitions (require full object with itemsType). */
  strictShorthandArray?: boolean;
  /** Reject shorthand "object" definitions (require full object with properties or explicit object definition). */
  strictShorthandObject?: boolean;
}

interface CanonicalizeOptions extends PromptVariableSchemaValidationOptions {
  maxIssues?: number;
  /** If true, expands shorthand string defs like { field: "string" } into PromptVariable objects. */
  expandShorthand?: boolean;
}

interface PromptVariableDefinitionObject {
  type?: unknown;
  required?: unknown;
  description?: unknown;
  itemsType?: unknown;
  properties?: unknown;
  values?: unknown;
  min?: unknown;
  max?: unknown;
}

function asPromptVariableDefObject(
  def: Record<string, unknown>,
): PromptVariableDefinitionObject {
  return def as PromptVariableDefinitionObject;
}

const PROMPT_VARIABLE_TYPES: readonly PromptVariableType[] = [
  PromptVariableType.INTEGER,
  PromptVariableType.FLOAT,
  PromptVariableType.STRING,
  PromptVariableType.BOOLEAN,
  PromptVariableType.JSON,
  PromptVariableType.ANY,
  PromptVariableType.ARRAY,
  PromptVariableType.OBJECT,
  PromptVariableType.ENUM,
];

const PROMPT_VARIABLE_TYPES_SHORTHAND: readonly PromptVariableType[] = [
  PromptVariableType.INTEGER,
  PromptVariableType.FLOAT,
  PromptVariableType.STRING,
  PromptVariableType.BOOLEAN,
  PromptVariableType.JSON,
  PromptVariableType.ANY,
  PromptVariableType.ARRAY,
  PromptVariableType.OBJECT,
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return false;
  if (typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidVarName(key: unknown): key is string {
  return typeof key === "string" && /^[a-zA-Z0-9_]+$/.test(key);
}

function normalizePromptVariableType(
  raw: unknown,
): PromptVariableType | undefined {
  if (typeof raw !== "string") return undefined;

  const normalized = raw.trim().toLowerCase();
  for (const t of PROMPT_VARIABLE_TYPES) {
    if (t === normalized) return t;
  }

  // Accept enum key names as a convenience (e.g. "STRING").
  const upper = raw.trim().toUpperCase();
  for (const [k, v] of Object.entries(PromptVariableType)) {
    if (k.toUpperCase() === upper) return v as PromptVariableType;
  }

  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function explainEnumValues(
  values: unknown,
  valuesPath: string,
  push: (issue: PromptVariableSchemaIssue) => void,
): { valid: boolean; normalized?: string[] } {
  if (!Array.isArray(values) || values.length === 0) {
    push({
      path: valuesPath,
      code: PromptVariableSchemaIssueCode.ENUM_VALUES_REQUIRED,
    });
    return { valid: false };
  }

  const normalized: string[] = [];
  for (const v of values as unknown[]) {
    if (typeof v !== "string") {
      push({
        path: valuesPath,
        code: PromptVariableSchemaIssueCode.ENUM_VALUES_STRING,
      });
      return { valid: false };
    }

    const s = v.trim();
    if (!s) {
      push({
        path: valuesPath,
        code: PromptVariableSchemaIssueCode.ENUM_VALUES_EMPTY,
      });
      return { valid: false };
    }

    if (s.length > 256) {
      push({
        path: valuesPath,
        code: PromptVariableSchemaIssueCode.ENUM_VALUES_LEN,
      });
      return { valid: false };
    }

    normalized.push(s);
  }

  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    push({
      path: valuesPath,
      code: PromptVariableSchemaIssueCode.ENUM_VALUES_UNIQUE,
    });
    // Keep going; this is still canonicalizable.
  }

  return { valid: true, normalized };
}

/**
 * Validates a PromptVariable schema record.
 *
 * Notes
 * - Accepts both full object definitions and shorthand string definitions.
 * - Issue codes are stable and UI/backend can map them to messages/i18n.
 */
export function validatePromptVariableSchemaRecord(
  value: unknown,
  maxIssues: number = 25,
  options?: PromptVariableSchemaValidationOptions,
): PromptVariableSchemaValidationResult {
  const issues: PromptVariableSchemaIssue[] = [];
  const push = (issue: PromptVariableSchemaIssue): void => {
    if (issues.length >= maxIssues) return;
    issues.push(issue);
  };

  const explainDef = (def: unknown, path: string): void => {
    if (issues.length >= maxIssues) return;

    // Shorthand
    if (typeof def === "string") {
      const t = normalizePromptVariableType(def);
      if (!t) {
        push({
          path,
          code: PromptVariableSchemaIssueCode.TYPE_INVALID,
          params: { type: String(def) },
        });
        return;
      }

      if (t === PromptVariableType.ENUM) {
        push({ path, code: PromptVariableSchemaIssueCode.ENUM_REQUIRES_FULL });
        return;
      }

      if (t === PromptVariableType.ARRAY && options?.strictShorthandArray) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_REQUIRED,
        });
        return;
      }

      if (t === PromptVariableType.OBJECT && options?.strictShorthandObject) {
        push({
          path,
          code: PromptVariableSchemaIssueCode.OBJECT_REQUIRES_FULL,
        });
        return;
      }

      if (!PROMPT_VARIABLE_TYPES_SHORTHAND.includes(t)) {
        push({
          path,
          code: PromptVariableSchemaIssueCode.TYPE_INVALID,
          params: { type: String(def) },
        });
        return;
      }

      return;
    }

    if (!isObjectRecord(def)) {
      push({ path, code: PromptVariableSchemaIssueCode.DEFINITION_SHAPE });
      return;
    }

    const obj = asPromptVariableDefObject(def);

    const t = normalizePromptVariableType(obj.type);
    if (!t) {
      push({
        path: `${path}.type`,
        code: PromptVariableSchemaIssueCode.TYPE_INVALID,
        params: { type: String(obj.type ?? "") },
      });
      return;
    }

    const requiredRaw: unknown = obj.required;
    if (requiredRaw !== undefined && typeof requiredRaw !== "boolean") {
      push({
        path: `${path}.required`,
        code: PromptVariableSchemaIssueCode.REQUIRED_BOOL,
      });
    }

    const descriptionRaw: unknown = obj.description;
    if (descriptionRaw !== undefined && descriptionRaw !== null) {
      if (typeof descriptionRaw !== "string") {
        push({
          path: `${path}.description`,
          code: PromptVariableSchemaIssueCode.DESCRIPTION_STRING,
        });
      } else if (descriptionRaw.length > 1024) {
        push({
          path: `${path}.description`,
          code: PromptVariableSchemaIssueCode.DESCRIPTION_LEN,
        });
      }
    }

    const hasMin = obj.min !== undefined && obj.min !== null;
    const hasMax = obj.max !== undefined && obj.max !== null;

    if (hasMin || hasMax) {
      const allowMinMax =
        t === PromptVariableType.INTEGER ||
        t === PromptVariableType.FLOAT ||
        t === PromptVariableType.STRING ||
        t === PromptVariableType.ARRAY;
      if (!allowMinMax) {
        push({ path, code: PromptVariableSchemaIssueCode.MINMAX_TYPE });
      }

      if (hasMin && !isFiniteNumber(obj.min)) {
        push({
          path: `${path}.min`,
          code: PromptVariableSchemaIssueCode.MINMAX_NUMBER,
        });
      }
      if (hasMax && !isFiniteNumber(obj.max)) {
        push({
          path: `${path}.max`,
          code: PromptVariableSchemaIssueCode.MINMAX_NUMBER,
        });
      }

      if (t === PromptVariableType.INTEGER) {
        if (hasMin && isFiniteNumber(obj.min) && !Number.isInteger(obj.min)) {
          push({
            path: `${path}.min`,
            code: PromptVariableSchemaIssueCode.MINMAX_INTEGER,
          });
        }
        if (hasMax && isFiniteNumber(obj.max) && !Number.isInteger(obj.max)) {
          push({
            path: `${path}.max`,
            code: PromptVariableSchemaIssueCode.MINMAX_INTEGER,
          });
        }
      }

      if (t === PromptVariableType.STRING) {
        if (hasMin && (!Number.isInteger(obj.min) || (obj.min as number) < 0)) {
          push({
            path: `${path}.min`,
            code: PromptVariableSchemaIssueCode.MINMAX_STRING_INT,
          });
        }
        if (hasMax && (!Number.isInteger(obj.max) || (obj.max as number) < 0)) {
          push({
            path: `${path}.max`,
            code: PromptVariableSchemaIssueCode.MINMAX_STRING_INT,
          });
        }
      }

      if (t === PromptVariableType.ARRAY) {
        if (hasMin && (!Number.isInteger(obj.min) || (obj.min as number) < 0)) {
          push({
            path: `${path}.min`,
            code: PromptVariableSchemaIssueCode.MINMAX_ARRAY_INT,
          });
        }
        if (hasMax && (!Number.isInteger(obj.max) || (obj.max as number) < 0)) {
          push({
            path: `${path}.max`,
            code: PromptVariableSchemaIssueCode.MINMAX_ARRAY_INT,
          });
        }
      }

      if (
        hasMin &&
        hasMax &&
        isFiniteNumber(obj.min) &&
        isFiniteNumber(obj.max) &&
        obj.max < obj.min
      ) {
        push({ path, code: PromptVariableSchemaIssueCode.MINMAX_ORDER });
      }
    }

    // ENUM
    if (t === PromptVariableType.ENUM) {
      explainEnumValues(obj.values, `${path}.values`, push);

      if (obj.itemsType !== undefined && obj.itemsType !== null) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ENUM_FIELDS_DISALLOWED,
        });
      }
      if (obj.properties !== undefined && obj.properties !== null) {
        push({
          path: `${path}.properties`,
          code: PromptVariableSchemaIssueCode.ENUM_FIELDS_DISALLOWED,
        });
      }
      if (hasMin || hasMax) {
        push({
          path,
          code: PromptVariableSchemaIssueCode.ENUM_FIELDS_DISALLOWED,
        });
      }

      return;
    }

    // OBJECT
    if (t === PromptVariableType.OBJECT) {
      if (obj.itemsType !== undefined && obj.itemsType !== null) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.OBJECT_FIELDS_DISALLOWED,
        });
      }
      if (obj.values !== undefined && obj.values !== null) {
        push({
          path: `${path}.values`,
          code: PromptVariableSchemaIssueCode.OBJECT_FIELDS_DISALLOWED,
        });
      }

      const propsRaw = obj.properties;
      if (propsRaw !== undefined && propsRaw !== null) {
        if (!isPlainObject(propsRaw)) {
          push({
            path: `${path}.properties`,
            code: PromptVariableSchemaIssueCode.OBJECT_PROPERTIES_OBJECT,
          });
        } else {
          for (const [propName, propDef] of Object.entries(propsRaw)) {
            if (!isValidVarName(propName)) {
              push({
                path: `${path}.properties.${String(propName)}`,
                code: PromptVariableSchemaIssueCode.KEY_NAME_INVALID,
                params: { name: String(propName) },
              });
              if (issues.length >= maxIssues) return;
              continue;
            }
            explainDef(propDef, `${path}.properties.${propName}`);
            if (issues.length >= maxIssues) return;
          }
        }
      }

      if (hasMin || hasMax) {
        push({
          path,
          code: PromptVariableSchemaIssueCode.OBJECT_FIELDS_DISALLOWED,
        });
      }

      return;
    }

    // ARRAY
    if (t === PromptVariableType.ARRAY) {
      const itemsTypeRaw: unknown = obj.itemsType;
      const itemsType = normalizePromptVariableType(itemsTypeRaw);
      if (!itemsType) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_REQUIRED,
        });
        return;
      }
      if (itemsType === PromptVariableType.ARRAY) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_NO_ARRAY,
        });
        return;
      }

      // min/max on arrays are interpreted as minItems/maxItems and are allowed.

      if (itemsType === PromptVariableType.OBJECT) {
        const propsRaw = obj.properties;
        if (propsRaw === undefined || propsRaw === null) {
          push({
            path: `${path}.properties`,
            code: PromptVariableSchemaIssueCode.ARRAY_OBJECT_PROPERTIES_REQUIRED,
          });
          return;
        }
        if (!isPlainObject(propsRaw)) {
          push({
            path: `${path}.properties`,
            code: PromptVariableSchemaIssueCode.OBJECT_PROPERTIES_OBJECT,
          });
          return;
        }

        for (const [propName, propDef] of Object.entries(propsRaw)) {
          if (!isValidVarName(propName)) {
            push({
              path: `${path}.properties.${String(propName)}`,
              code: PromptVariableSchemaIssueCode.KEY_NAME_INVALID,
              params: { name: String(propName) },
            });
            if (issues.length >= maxIssues) return;
            continue;
          }
          explainDef(propDef, `${path}.properties.${propName}`);
          if (issues.length >= maxIssues) return;
        }

        if (obj.values !== undefined && obj.values !== null) {
          push({
            path: `${path}.values`,
            code: PromptVariableSchemaIssueCode.ARRAY_FIELDS_DISALLOWED,
          });
        }
      } else {
        if (obj.properties !== undefined && obj.properties !== null) {
          push({
            path: `${path}.properties`,
            code: PromptVariableSchemaIssueCode.ARRAY_FIELDS_DISALLOWED,
          });
        }
      }

      if (itemsType === PromptVariableType.ENUM) {
        explainEnumValues(obj.values, `${path}.values`, push);
      } else {
        if (obj.values !== undefined && obj.values !== null) {
          push({
            path: `${path}.values`,
            code: PromptVariableSchemaIssueCode.ARRAY_FIELDS_DISALLOWED,
          });
        }
      }

      return;
    }

    // For other types, we allow itemsType only if it is a valid type and not array (compat with UI).
    const maybeItemsType = obj.itemsType;
    if (maybeItemsType !== undefined && maybeItemsType !== null) {
      const it = normalizePromptVariableType(maybeItemsType);
      if (!it) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_INVALID,
        });
      }
      if (it === PromptVariableType.ARRAY) {
        push({
          path: `${path}.itemsType`,
          code: PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_NO_ARRAY,
        });
      }
    }
  };

  // Root allowed to be null/undefined.
  if (value === null || value === undefined) {
    return { valid: true, issues: [] };
  }

  if (!isPlainObject(value)) {
    push({ path: "", code: PromptVariableSchemaIssueCode.ROOT_OBJECT });
    return { valid: false, issues };
  }

  for (const [key, def] of Object.entries(value)) {
    if (!isValidVarName(key)) {
      push({
        path: String(key),
        code: PromptVariableSchemaIssueCode.KEY_NAME_INVALID,
        params: { name: String(key) },
      });
      if (issues.length >= maxIssues) break;
      continue;
    }
    explainDef(def, key);
    if (issues.length >= maxIssues) break;
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Canonicalizes a PromptVariable schema record.
 *
 * Output
 * - All `type/itemsType` are normalized to the canonical lowercase values from PromptVariableType.
 * - Shorthand string definitions may be expanded to full PromptVariable objects.
 * - Enum values are trimmed.
 */
export function canonicalizePromptVariableSchemaRecord(
  value: unknown,
  options?: CanonicalizeOptions,
): PromptVariableSchemaCanonicalizeResult {
  const maxIssues = options?.maxIssues ?? 25;
  const expandShorthand = options?.expandShorthand !== false;

  const validation = validatePromptVariableSchemaRecord(
    value,
    maxIssues,
    options,
  );
  if (!validation.valid) return { valid: false, issues: validation.issues };

  if (value === null || value === undefined) {
    return { valid: true, issues: [], schema: undefined };
  }

  const schema: Record<string, PromptVariable> = {};

  const toPromptVariable = (def: unknown): PromptVariable => {
    if (typeof def === "string") {
      const t = normalizePromptVariableType(def) as PromptVariableType;
      // Canonical form is always full PromptVariable objects.
      return expandShorthand
        ? new PromptVariable(t, false)
        : new PromptVariable(t, false);
    }

    if (!isObjectRecord(def)) {
      // Should never happen after validation, but keep canonicalization total.
      return new PromptVariable(PromptVariableType.ANY, false);
    }

    const obj = asPromptVariableDefObject(def);

    const type = normalizePromptVariableType(obj.type) as PromptVariableType;
    const required = obj.required === true;
    const description =
      typeof obj.description === "string" ? obj.description : undefined;
    const min = isFiniteNumber(obj.min) ? obj.min : undefined;
    const max = isFiniteNumber(obj.max) ? obj.max : undefined;

    if (type === PromptVariableType.ENUM) {
      const enumNorm = explainEnumValues(obj.values, "values", () => {
        /* already validated */
      });
      const values = enumNorm.normalized;
      return new PromptVariable(
        type,
        required,
        description,
        undefined,
        undefined,
        values,
        min,
        max,
      );
    }

    if (type === PromptVariableType.OBJECT) {
      const propsRaw = obj.properties;
      const props = isPlainObject(propsRaw)
        ? (Object.fromEntries(
            Object.entries(propsRaw).map(([k, v]) => [k, toPromptVariable(v)]),
          ) as Record<string, PromptVariable>)
        : undefined;
      return new PromptVariable(
        type,
        required,
        description,
        undefined,
        props,
        undefined,
        min,
        max,
      );
    }

    if (type === PromptVariableType.ARRAY) {
      const itemsType = normalizePromptVariableType(
        obj.itemsType,
      ) as PromptVariableType;
      const propsRaw = obj.properties;
      const props =
        itemsType === PromptVariableType.OBJECT && isPlainObject(propsRaw)
          ? (Object.fromEntries(
              Object.entries(propsRaw).map(([k, v]) => [
                k,
                toPromptVariable(v),
              ]),
            ) as Record<string, PromptVariable>)
          : undefined;

      const values =
        itemsType === PromptVariableType.ENUM && Array.isArray(obj.values)
          ? (obj.values as unknown[])
              .filter((v) => typeof v === "string")
              .map((v) => String(v).trim())
              .filter((v) => v.length > 0)
          : undefined;

      return new PromptVariable(
        type,
        required,
        description,
        itemsType,
        props,
        values,
        min,
        max,
      );
    }

    // For scalar/json/any
    const itemsType = normalizePromptVariableType(obj.itemsType);
    return new PromptVariable(
      type,
      required,
      description,
      itemsType,
      undefined,
      undefined,
      min,
      max,
    );
  };

  for (const [key, def] of Object.entries(value as Record<string, unknown>)) {
    schema[key] = toPromptVariable(def);
  }

  return { valid: true, issues: [], schema };
}
