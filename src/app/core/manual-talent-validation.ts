import { charCount, validateName } from './application-validation';

/**
 * Regras do formulário de cadastro manual de talento — hoje usado tanto no Banco de Talentos
 * (`talent-bank.component.ts`) quanto no "Cadastrar no Banco de Talentos" de um prospect de
 * Sourcing (`campaign-sourcing.component.ts`). Extraído pra um lugar só pra as duas telas não
 * divergirem de regra com o tempo (mesmo raciocínio de `application-validation.ts` pro form
 * público, só que aqui é paridade frontend/frontend, não frontend/backend).
 */

export type ManualTalentField = 'name' | 'rawProfileText' | 'contextNote';

export const MANUAL_TALENT_LIMITS = { rawText: 14000, note: 2000 } as const;

export function validateManualTalentInput(
  name: string,
  rawProfileText: string,
  contextNote: string,
): Partial<Record<ManualTalentField, string>> {
  const errors: Partial<Record<ManualTalentField, string>> = {};

  const nameCheck = validateName(name);
  if (nameCheck.error) errors.name = nameCheck.error;

  const rawCount = charCount(rawProfileText.trim());
  if (rawCount > MANUAL_TALENT_LIMITS.rawText) {
    errors.rawProfileText = `O perfil pode ter no máximo ${MANUAL_TALENT_LIMITS.rawText} caracteres (você usou ${rawCount}).`;
  }

  const noteCount = charCount(contextNote.trim());
  if (noteCount > MANUAL_TALENT_LIMITS.note) {
    errors.contextNote = `A nota pode ter no máximo ${MANUAL_TALENT_LIMITS.note} caracteres (você usou ${noteCount}).`;
  }

  return errors;
}
