import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/app-error.js";

type RequestSource = "body" | "query" | "params";

/**
 * Validates req.body, req.query, or req.params.
 * For query/params, prefer z.coerce.* in schemas because Express values are strings.
 */
export const validate =
  <T>(schema: ZodType<T>, source: RequestSource = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new AppError("Validation failed", 400, "VALIDATION_ERROR", {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
      return;
    }

    Object.defineProperty(req, source, {
      value: result.data,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    next();
  };
