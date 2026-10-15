/** Assignment rubrics (pure). A rubric is a list of criteria, each with scored levels. */
import { z } from "zod";

const id = z.string().trim().min(1).max(40);

export const rubricSchema = z.object({
  criteria: z
    .array(
      z.object({
        id,
        title: z.string().trim().min(1, "Name each criterion").max(200),
        description: z.string().trim().max(1000).default(""),
        levels: z
          .array(
            z.object({
              id,
              label: z.string().trim().min(1, "Name each level").max(100),
              points: z.number().min(0).max(1000),
              description: z.string().trim().max(1000).default(""),
            }),
          )
          .min(1, "Add at least one level")
          .max(8),
      }),
    )
    .max(20),
});
export type Rubric = z.output<typeof rubricSchema>;

export function rubricMax(rubric: Rubric): number {
  return rubric.criteria.reduce((sum, c) => sum + Math.max(0, ...c.levels.map((l) => l.points)), 0);
}

/** Score for chosen levels ({ criterionId: levelId }). `complete` is false until every criterion has a level. */
export function rubricScore(rubric: Rubric, selections: Record<string, string>): { score: number; complete: boolean } {
  let score = 0;
  let complete = true;
  for (const c of rubric.criteria) {
    const level = c.levels.find((l) => l.id === selections[c.id]);
    if (level) score += level.points;
    else complete = false;
  }
  return { score: Math.round(score * 100) / 100, complete };
}
