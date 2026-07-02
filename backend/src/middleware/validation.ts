/**
 * Server-side input validation (D1 §9.5, FSR9).
 * Allowlist-based schema validation with zod; reject bad type/format/length.
 * All validation is server-side — client checks are UX only.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Validate a request part against a zod schema. On success, replaces the raw
 * input with the parsed (and coerced/trimmed) value so handlers get clean data.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid input.',
        details: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
}
