import { Talent } from './models';
import { findSimilarInPool, searchTalentPool } from './talent-matching';

function talent(id: string, skills: string[], extra: Partial<Talent> = {}): Talent {
  return {
    id, name: `Pessoa ${id}`, initials: 'PP', avatarColorIndex: 0, location: 'Brasília, DF', modality: 'Remoto',
    seniority: 'Pleno', yearsExperience: 3, sectors: [], skills: skills.map((term) => ({ term })), languages: [],
    salaryRangeLabel: 'A confirmar', availabilityLabel: 'A confirmar', origin: 'reprovacao_qualificada',
    legalBasis: 'consentimento', consentState: 'consentido', updatedAt: new Date().toISOString(), summary: '',
    experience: [], education: { degree: '', institution: '', period: '' }, history: [], ...extra,
  };
}

describe('talent-matching (busca do Banco de Talentos)', () => {
  it('skill é casada como palavra inteira: "Skill 12" não é "Skill 1", "Google" não é "Go"', () => {
    const pool = [talent('a', ['Skill 1']), talent('b', ['Skill 12']), talent('c', ['Go'])];

    const skill12 = searchTalentPool('Skill 12', pool);
    expect(skill12[0].talent.id).toBe('b');
    expect(skill12[0].breakdown.map((l) => l.label)).not.toContain('Skill 1');

    const google = searchTalentPool('experiência com Google Cloud', pool);
    expect(google.every((m) => !m.breakdown.some((l) => l.label === 'Go'))).toBeTrue();
  });

  it('C não casa com C++, mas C++ casa; termo com símbolo inicial (.NET) casa dentro de ASP.NET', () => {
    const pool = [talent('c', ['C']), talent('cpp', ['C++']), talent('net', ['.NET'])];
    expect(searchTalentPool('dev C++ sênior', pool)[0].talent.id).toBe('cpp');
    expect(searchTalentPool('dev C++ sênior', pool).some((m) => m.breakdown.some((l) => l.label === 'C'))).toBeFalse();
    expect(searchTalentPool('ASP.NET', pool)[0].talent.id).toBe('net');
  });

  it('quem pediu exclusão nunca aparece em busca nem em parecidos', () => {
    const pool = [talent('a', ['Python']), talent('b', ['Python'], { consentState: 'oposicao_exclusao' })];
    expect(searchTalentPool('Python', pool).map((m) => m.talent.id)).toEqual(['a']);
    expect(findSimilarInPool('a', pool)).toEqual([]);
  });

  it('resultados vêm do maior match para o menor', () => {
    const pool = [talent('a', ['SQL']), talent('b', ['Python', 'SQL']), talent('c', ['Python'])];
    const pcts = searchTalentPool('Python SQL', pool).map((m) => m.matchPct);
    expect(pcts).toEqual([...pcts].sort((x, y) => y - x));
    expect(searchTalentPool('Python SQL', pool)[0].talent.id).toBe('b');
  });
});
