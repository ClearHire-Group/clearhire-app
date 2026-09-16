/** The API stores these lists as text. Keep that format at the boundary so existing jobs
 * remain editable, while forms and the public page work with individual items. */
export const JOB_SECTION_MAX_LENGTH = 5000;

export function parseJobItems(value: string): string[] {
  return value.split(/\r\n|\r|\n/).map((item) => item.trim()).filter(Boolean);
}

export function serializeJobItems(items: readonly string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join('\n');
}

export function jobListsWithinLimit(...lists: readonly string[][]): boolean {
  return lists.every((items) => serializeJobItems(items).length <= JOB_SECTION_MAX_LENGTH);
}
