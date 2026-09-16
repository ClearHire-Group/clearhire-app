/** Os três módulos OPCIONAIS de funil que o recrutador escolhe/reordena — "Nova Campanha" (step 3)
 * e "Fases do funil" (Configurações da Campanha) compartilham exatamente esta lista/labels/ícones.
 * Recebidos e Selecionados são fixos em toda campanha e não aparecem aqui. */
export type ModuleKey = 'fit' | 'tecnica' | 'entrevista';

export interface ModuleInfo {
  key: ModuleKey;
  label: string;
  desc: string;
}

export const MODULES: ModuleInfo[] = [
  { key: 'fit', label: 'Fit Cultural', desc: 'Avalia alinhamento com valores e cultura da empresa através de questionário estruturado.' },
  { key: 'tecnica', label: 'Triagem Técnica', desc: 'Testes e desafios técnicos automatizados, analisados e ranqueados pela IA.' },
  { key: 'entrevista', label: 'Entrevista Estruturada', desc: 'Roteiro de entrevista padronizado com apoio de IA na consolidação dos pareceres.' },
];
