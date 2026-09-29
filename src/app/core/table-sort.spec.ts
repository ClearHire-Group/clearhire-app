import { SortSpec, ariaSort, nextSort, parseSort, rankIn, searchKey, sortRows } from './table-sort';

interface Row {
  id: string;
  name: string;
  match: number | null;
  city: string;
  status: string;
}

const row = (id: string, name: string, match: number | null, city = '', status = ''): Row => ({ id, name, match, city, status });
const names = (rows: Row[]): string => rows.map((r) => r.name).join(',');

const byMatch: SortSpec<Row> = { label: 'Match', first: 'desc', value: (r) => r.match };
const byCity: SortSpec<Row> = { label: 'Cidade', first: 'asc', value: (r) => r.city };

describe('table-sort', () => {
  it('ordena número nos dois sentidos e deixa "sem informação" SEMPRE no fim', () => {
    const rows = [row('1', 'Ana', 40), row('2', 'Bia', null), row('3', 'Caio', 90), row('4', 'Duda', 10)];
    expect(names(sortRows(rows, byMatch, 'desc'))).toBe('Caio,Ana,Duda,Bia');
    expect(names(sortRows(rows, byMatch, 'asc'))).toBe('Duda,Ana,Caio,Bia');
  });

  it('não muta a lista original', () => {
    const rows = [row('1', 'B', 1), row('2', 'A', 2)];
    sortRows(rows, byMatch, 'desc');
    expect(names(rows)).toBe('B,A');
  });

  it('empate é desfeito pelo nome (ordem determinística)', () => {
    const rows = [row('1', 'Zeca', 50), row('2', 'Ana', 50), row('3', 'Maria', 50)];
    expect(names(sortRows(rows, byMatch, 'desc'))).toBe('Ana,Maria,Zeca');
  });

  it('texto livre: ignora acento e caixa, então grafias da mesma cidade ficam juntas', () => {
    const rows = [
      row('1', 'A', 0, 'Recife, PE'), row('2', 'B', 0, 'brasilia, DF'), row('3', 'C', 0, ''),
      row('4', 'D', 0, 'Brasília, DF'), row('5', 'E', 0, 'BRASILIA, DF'), row('6', 'F', 0, 'Curitiba, PR'),
    ];
    const sorted = sortRows(rows, byCity, 'asc').map((r) => r.city);
    expect(sorted.slice(0, 3).map((c) => searchKey(c))).toEqual(['brasilia, df', 'brasilia, df', 'brasilia, df']);
    expect(sorted.slice(3)).toEqual(['Curitiba, PR', 'Recife, PE', '']);
  });

  it('entende números dentro do texto ("Vaga 2" antes de "Vaga 10")', () => {
    const rows = [row('1', 'Vaga 10', 0), row('2', 'Vaga 2', 0)];
    const byName: SortSpec<Row> = { label: 'Nome', first: 'asc', value: (r) => r.name };
    expect(names(sortRows(rows, byName, 'asc'))).toBe('Vaga 2,Vaga 10');
  });

  it('categoria por ordem de negócio agrupa cada tipo em sequência', () => {
    const order = ['Aguardando decisão', 'Em análise', 'Reprovada'];
    const byStatus: SortSpec<Row> = { label: 'Status', first: 'asc', value: (r) => rankIn(order, r.status) };
    const rows = [
      row('1', 'A', 0, '', 'Reprovada'), row('2', 'B', 0, '', 'Aguardando decisão'), row('3', 'C', 0, '', 'Em análise'),
      row('4', 'D', 0, '', 'Reprovada'), row('5', 'E', 0, '', 'Aguardando decisão'), row('6', 'F', 0, '', 'Desconhecido'),
    ];
    expect(sortRows(rows, byStatus, 'asc').map((r) => r.status)).toEqual([
      'Aguardando decisão', 'Aguardando decisão', 'Em análise', 'Reprovada', 'Reprovada', 'Desconhecido',
    ]);
  });

  it('primeiro clique usa a direção da coluna; clicar de novo inverte', () => {
    const specs = { match: byMatch, cidade: byCity };
    const first = nextSort(null, 'match', specs);
    expect(first).toEqual({ key: 'match', dir: 'desc' });
    expect(nextSort(first, 'match', specs)).toEqual({ key: 'match', dir: 'asc' });
    expect(nextSort(first, 'cidade', specs)).toEqual({ key: 'cidade', dir: 'asc' });
  });

  it('parâmetro da URL fora da lista é ignorado', () => {
    const allowed = ['match', 'nome'] as const;
    expect(parseSort('match', 'asc', allowed)).toEqual({ key: 'match', dir: 'asc' });
    expect(parseSort('match', 'qualquer', allowed)).toEqual({ key: 'match', dir: 'desc' });
    expect(parseSort('password_hash', 'asc', allowed)).toBeNull();
    expect(parseSort('__proto__', 'asc', allowed)).toBeNull();
    expect(parseSort(null, null, allowed)).toBeNull();
  });

  it('aria-sort acompanha a coluna ativa', () => {
    expect(ariaSort({ key: 'match', dir: 'desc' }, 'match')).toBe('descending');
    expect(ariaSort({ key: 'match', dir: 'asc' }, 'match')).toBe('ascending');
    expect(ariaSort({ key: 'match', dir: 'asc' }, 'nome')).toBe('none');
  });

  it('3 mil linhas ordenam em poucos milissegundos', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => row(`id${i}`, `Pessoa ${i}`, i % 7 ? (i * 37) % 101 : null, ['Brasília, DF', 'Recife, PE', ''][i % 3]));
    const start = performance.now();
    sortRows(rows, byCity, 'asc');
    sortRows(rows, byMatch, 'desc');
    expect(performance.now() - start).toBeLessThan(100);
  });
});
