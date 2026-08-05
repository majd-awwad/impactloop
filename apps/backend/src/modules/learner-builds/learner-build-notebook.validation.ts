import { z } from 'zod';

export const NOTEBOOK_SCHEMA_VERSION = 1;
export const NOTEBOOK_MAX_PAGES = 20;
export const NOTEBOOK_MIN_PAGES = 1;
export const NOTEBOOK_MAX_PAGE_TITLE_LENGTH = 100;
export const NOTEBOOK_MAX_PAGE_TEXT_LENGTH = 10_000;
export const NOTEBOOK_MAX_STROKES_PER_PAGE = 1_000;
export const NOTEBOOK_MAX_POINTS_PER_STROKE = 2_000;
export const NOTEBOOK_MIN_STROKE_WIDTH = 1;
export const NOTEBOOK_MAX_STROKE_WIDTH = 8;

export const NOTEBOOK_SUPPORTED_COLORS = [
  '#1F2937',
  '#22C55E',
  '#EF4444',
  '#3B82F6',
] as const;

const normalizedCoordinateSchema = z
  .number()
  .finite()
  .min(0)
  .max(1);

const notebookPointSchema = z.object({
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});

const notebookStrokeSchema = z.object({
  id: z.string().min(1).max(128),
  color: z.enum(NOTEBOOK_SUPPORTED_COLORS),
  width: z
    .number()
    .finite()
    .min(NOTEBOOK_MIN_STROKE_WIDTH)
    .max(NOTEBOOK_MAX_STROKE_WIDTH),
  points: z
    .array(notebookPointSchema)
    .min(1)
    .max(NOTEBOOK_MAX_POINTS_PER_STROKE),
});

const notebookPageSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(NOTEBOOK_MAX_PAGE_TITLE_LENGTH),
  text: z.string().max(NOTEBOOK_MAX_PAGE_TEXT_LENGTH),
  strokes: z.array(notebookStrokeSchema).max(NOTEBOOK_MAX_STROKES_PER_PAGE),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const notebookDocumentSchema = z
  .object({
    schemaVersion: z.literal(NOTEBOOK_SCHEMA_VERSION),
    pages: z
      .array(notebookPageSchema)
      .min(NOTEBOOK_MIN_PAGES)
      .max(NOTEBOOK_MAX_PAGES),
  })
  .superRefine((value, ctx) => {
    const pageIds = new Set<string>();
    for (const page of value.pages) {
      if (pageIds.has(page.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate page IDs are not allowed.',
          path: ['pages'],
        });
        return;
      }
      pageIds.add(page.id);

      const strokeIds = new Set<string>();
      for (const stroke of page.strokes) {
        if (strokeIds.has(stroke.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Duplicate stroke IDs are not allowed.',
            path: ['pages'],
          });
          return;
        }
        strokeIds.add(stroke.id);
      }
    }
  });

export const updateProjectBuildNotebookSchema = z.object({
  content: notebookDocumentSchema,
});

export type NotebookDocument = z.infer<typeof notebookDocumentSchema>;
export type UpdateProjectBuildNotebookInput = z.infer<
  typeof updateProjectBuildNotebookSchema
>;
