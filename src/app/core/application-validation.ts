/**
 * Regras de validação do formulário público de candidatura, campo a campo.
 *
 * ESPELHADAS em clearhire-server/internal/domain/candidate/application_validation.go: aqui elas dão
 * o feedback imediato, no campo certo, enquanto a pessoa preenche; lá elas protegem a API (o front
 * nunca é barreira). As duas implementações têm que concordar — uma regra só num lado vira ou um erro
 * genérico no fim do envio, ou dado ruim aceito. Ao mudar uma regra aqui, mude lá e os testes dos
 * dois lados (os casos de teste são os mesmos).
 *
 * Cada validador devolve o valor NORMALIZADO (é o que é enviado) e a mensagem de erro, vazia quando
 * o valor é válido. As chaves de campo são as mesmas do JSON da API e de `fields` na resposta de erro.
 */

export type ApplicationField =
  | 'name'
  | 'email'
  | 'phone'
  | 'linkedinUrl'
  | 'city'
  | 'state'
  | 'yearsExperience'
  | 'summary'
  | 'educationDegree'
  | 'educationInstitution'
  | 'educationPeriod'
  | 'skills'
  | 'resumeText'
  | 'file'
  | 'consent';

export type FieldErrors = Partial<Record<ApplicationField, string>>;

/** Resultado de um validador: valor normalizado + mensagem ('' = válido). */
export interface Checked<T = string> {
  value: T;
  error: string;
}

export const LIMITS = {
  nameChars: 200,
  emailChars: 254,
  cityChars: 100,
  summaryChars: 4000,
  educationChars: 200,
  periodChars: 100,
  skills: 40,
  skillChars: 100,
  yearsExperience: 60,
  resumeTextMin: 100,
  resumeTextMax: 14000,
  linkedInChars: 500,
  pdfBytes: 5 * 1024 * 1024,
  minPeriodYear: 1950,
  periodYearsAhead: 8,
} as const;

export const CONSENT_REQUIRED_MESSAGE = 'É preciso autorizar o uso dos seus dados para se candidatar.';

/** Conta caracteres como o backend (code points / runes), não unidades UTF-16 — um emoji é 1. */
export function charCount(s: string): number {
  return [...s].length;
}

function collapseSpaces(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).join(' ');
}

const hasLetter = (s: string): boolean => /\p{L}/u.test(s);
const hasLetterOrDigit = (s: string): boolean => /[\p{L}\p{N}]/u.test(s);

/** Nome de pessoa ou de cidade: letras (com acento), espaço, apóstrofo, hífen e ponto, começando por letra. */
const PERSON_LIKE = /^\p{L}[\p{L}\p{M}'’.\- ]*$/u;

export function validateName(raw: string): Checked {
  const value = collapseSpaces(raw);
  if (!value) return { value, error: 'Informe seu nome completo.' };
  if (charCount(value) > LIMITS.nameChars) return { value, error: `O nome pode ter no máximo ${LIMITS.nameChars} caracteres.` };
  if (!PERSON_LIKE.test(value)) return { value, error: 'Use apenas letras no nome, sem números ou símbolos.' };
  const words = value.split(' ').filter(hasLetter).length;
  if (words < 2) return { value, error: 'Informe nome e sobrenome.' };
  return { value, error: '' };
}

const EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$/;

/** Terminações que nenhum domínio real tem — erro certo de digitação de ".com". (.co, .cm e .om existem.) */
const TYPO_TLDS = new Set(['con', 'cmo', 'ocm', 'comm', 'coom', 'como', 'cpm', 'vom', 'xom', 'comn', 'coml', 'cim', 'clm', 'cok', 'ccom', 'conm', 'copm']);

/** Provedores que só existem com UM domínio no mundo todo. */
const SINGLE_DOMAIN_PROVIDERS: Record<string, string> = { gmail: 'gmail.com', icloud: 'icloud.com' };

/** Correção de um erro de digitação CERTO no domínio — bloqueia o envio (o backend faz o mesmo). */
export function emailTypoSuggestion(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const labels = domain.split('.');
  const canonical = SINGLE_DOMAIN_PROVIDERS[labels[0]];
  if (canonical && domain !== canonical) return `${local}@${canonical}`;
  if (labels.length >= 2 && TYPO_TLDS.has(labels[labels.length - 1])) {
    labels[labels.length - 1] = 'com';
    return `${local}@${labels.join('.')}`;
  }
  return '';
}

export function validateEmail(raw: string): Checked {
  const value = raw.trim().toLowerCase();
  if (!value) return { value, error: 'Informe seu e-mail.' };
  if (value.length > LIMITS.emailChars) return { value, error: `O e-mail pode ter no máximo ${LIMITS.emailChars} caracteres.` };
  if (!EMAIL.test(value) || value.indexOf('@') > 64) {
    return { value, error: 'E-mail inválido. Confira o formato, ex.: nome@provedor.com.' };
  }
  const suggestion = emailTypoSuggestion(value);
  if (suggestion) return { value, error: `Confira o e-mail: você quis dizer ${suggestion}?` };
  return { value, error: '' };
}

/** Domínios comuns, só para o AVISO de possível erro de digitação (não bloqueia — pode ser um domínio real). */
const KNOWN_EMAIL_DOMAINS = [
  'gmail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com', 'yahoo.com',
  'yahoo.com.br', 'icloud.com', 'me.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'msn.com',
  'globo.com', 'protonmail.com', 'proton.me', 'mail.com', 'email.com',
];

/** Distância de edição com transposição (Damerau restrita): "gmial" → "gmail" é 1, não 2. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Sugestão NÃO bloqueante para um domínio parecido com um provedor conhecido ("gmial.com"). Só um
 * aviso: pode ser um domínio real, então a pessoa decide.
 */
export function emailDomainWarning(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1 || validateEmail(email).error) return '';
  const domain = email.slice(at + 1);
  if (KNOWN_EMAIL_DOMAINS.includes(domain)) return '';
  let best = '';
  let bestDistance = Infinity;
  for (const known of KNOWN_EMAIL_DOMAINS) {
    const distance = editDistance(domain, known);
    if (distance < bestDistance) {
      best = known;
      bestDistance = distance;
    }
  }
  const tolerance = domain.length >= 8 ? 2 : 1;
  return bestDistance <= tolerance ? `${email.slice(0, at)}@${best}` : '';
}

const VALID_DDDS = new Set(
  `11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55
   61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99`.split(/\s+/),
);
const PHONE_FORMAT_HINT = 'Informe DDD + número, ex.: (61) 99999-9999.';

/**
 * Telefone brasileiro (com ou sem +55, com qualquer pontuação) ou internacional começando com + e o
 * código do país. Devolve o número formatado — é o que é enviado e gravado.
 */
export function validatePhone(raw: string): Checked {
  const phone = collapseSpaces(raw);
  if (!phone) return { value: '', error: '' };
  if (!/^[0-9()+\-. ]*$/.test(phone)) return { value: phone, error: 'Use apenas números no telefone, ex.: (61) 99999-9999.' };
  const plus = phone.startsWith('+');
  if ((phone.match(/\+/g) ?? []).length > 1 || (phone.includes('+') && !plus)) return { value: phone, error: PHONE_FORMAT_HINT };
  let digits = phone.replace(/\D/g, '');

  if (plus && !digits.startsWith('55')) {
    if (digits.length < 8 || digits.length > 15) {
      return { value: phone, error: 'Telefone internacional inválido: use + código do país e o número.' };
    }
    return { value: `+${digits}`, error: '' };
  }
  if (!plus) digits = digits.replace(/^0+/, ''); // prefixo de longa distância ("061 ...")
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return { value: phone, error: PHONE_FORMAT_HINT };

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!VALID_DDDS.has(ddd)) return { value: phone, error: `DDD ${ddd} não existe. ${PHONE_FORMAT_HINT}` };
  if (number.split('').every((c) => c === number[0])) return { value: phone, error: 'Número de telefone inválido.' };
  if (number.length === 9) {
    if (number[0] !== '9') return { value: phone, error: 'Celular com 9 dígitos deve começar com 9, ex.: (61) 99999-9999.' };
    return { value: `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`, error: '' };
  }
  if ('2345'.includes(number[0])) return { value: `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`, error: '' };
  if ('6789'.includes(number[0])) {
    return { value: phone, error: `Celular precisa do 9 na frente: (${ddd}) 9${number.slice(0, 4)}-${number.slice(4)}.` };
  }
  return { value: phone, error: 'Número de telefone inválido.' };
}

const LINKEDIN = /^(?:https?:\/\/)?(?:(?:www|[a-z]{2})\.)?linkedin\.com\/in\/([^/\s]+)$/i;
const LINKEDIN_SLUG = /^[\p{L}\p{N}_%-]{3,100}$/u;
const LINKEDIN_HINT = 'Use o link do seu perfil, ex.: linkedin.com/in/seu-nome.';

/** Aceita o link com ou sem https/www/subdomínio de país; devolve https://www.linkedin.com/in/<perfil>. */
export function validateLinkedIn(raw: string): Checked {
  const link = raw.trim();
  if (!link) return { value: '', error: '' };
  if (charCount(link) > LIMITS.linkedInChars) return { value: link, error: `Link muito longo. ${LINKEDIN_HINT}` };
  const cleaned = link.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const m = LINKEDIN.exec(cleaned);
  if (!m || !LINKEDIN_SLUG.test(m[1])) return { value: link, error: LINKEDIN_HINT };
  return { value: `https://www.linkedin.com/in/${m[1]}`, error: '' };
}

export function validateCity(raw: string): Checked {
  const value = collapseSpaces(raw);
  if (!value) return { value: '', error: '' };
  if (charCount(value) > LIMITS.cityChars) return { value, error: `A cidade pode ter no máximo ${LIMITS.cityChars} caracteres.` };
  if (charCount(value) < 2 || !PERSON_LIKE.test(value)) return { value, error: 'Cidade inválida: use apenas letras.' };
  return { value, error: '' };
}

export const BRAZILIAN_STATES: readonly { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' }, { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' }, { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' }, { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' }, { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' }, { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' }, { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' }, { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' }, { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];
const UFS = new Set(BRAZILIAN_STATES.map((s) => s.uf));

export function validateState(raw: string): Checked {
  const value = raw.trim().toUpperCase();
  if (!value) return { value: '', error: '' };
  if (!UFS.has(value)) return { value, error: 'Selecione um estado da lista.' };
  return { value, error: '' };
}

/** Anos de experiência chegam como texto do input: vazio = não informado; senão inteiro de 0 a 60. */
export function validateYearsExperience(raw: string): Checked<number | null> {
  const value = raw.trim();
  if (!value) return { value: null, error: '' };
  const message = `Informe um número inteiro de 0 a ${LIMITS.yearsExperience}.`;
  if (!/^\d{1,3}$/.test(value)) return { value: null, error: message };
  const years = Number(value);
  if (years > LIMITS.yearsExperience) return { value: null, error: message };
  return { value: years, error: '' };
}

export function validateSummary(raw: string): Checked {
  const value = raw.trim();
  const n = charCount(value);
  if (n > LIMITS.summaryChars) {
    return { value, error: `O resumo pode ter no máximo ${LIMITS.summaryChars} caracteres (você usou ${n}).` };
  }
  return { value, error: '' };
}

export function validateEducationText(raw: string, label: 'Formação' | 'Instituição'): Checked {
  const value = collapseSpaces(raw);
  if (!value) return { value: '', error: '' };
  if (charCount(value) > LIMITS.educationChars) return { value, error: `${label} pode ter no máximo ${LIMITS.educationChars} caracteres.` };
  if (!hasLetter(value)) return { value, error: `${label} inválida.` };
  return { value, error: '' };
}

export function validateEducationPeriod(raw: string, now: Date = new Date()): Checked {
  const value = collapseSpaces(raw);
  if (!value) return { value: '', error: '' };
  if (charCount(value) > LIMITS.periodChars) return { value, error: `O período pode ter no máximo ${LIMITS.periodChars} caracteres.` };
  const years = (value.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number);
  if (years.length === 0) return { value, error: 'Informe o período com anos, ex.: 2015 – 2019 ou 2021 – atual.' };
  const maxYear = now.getFullYear() + LIMITS.periodYearsAhead;
  if (years.some((y) => y < LIMITS.minPeriodYear || y > maxYear)) {
    return { value, error: `Ano fora do intervalo aceito (${LIMITS.minPeriodYear} a ${maxYear}).` };
  }
  if (years.length >= 2 && years[0] > years[1]) return { value, error: 'O ano de início não pode ser depois do ano de conclusão.' };
  return { value, error: '' };
}

/** Separa o texto do campo de skills (vírgula, ponto e vírgula ou quebra de linha). */
export function splitSkills(text: string): string[] {
  return text.split(/[,;\n]/);
}

/** Limpa (espaços, vazios, itens sem letra nem número, repetidos sem distinguir caixa) e só então aplica os tetos. */
export function validateSkills(raw: string[]): Checked<string[]> {
  const seen = new Set<string>();
  const value: string[] = [];
  for (const item of raw) {
    const skill = collapseSpaces(item);
    if (!hasLetterOrDigit(skill)) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    value.push(skill);
  }
  if (value.some((s) => charCount(s) > LIMITS.skillChars)) {
    return { value, error: `Cada skill pode ter no máximo ${LIMITS.skillChars} caracteres — separe as skills por vírgula.` };
  }
  if (value.length > LIMITS.skills) {
    return { value, error: `Informe no máximo ${LIMITS.skills} skills (você informou ${value.length}).` };
  }
  return { value, error: '' };
}

export function validateResumeText(raw: string): Checked {
  const value = raw.trim();
  const n = charCount(value);
  if (n === 0) return { value, error: 'Cole o texto do seu currículo.' };
  if (n < LIMITS.resumeTextMin) {
    return { value, error: `O texto parece curto demais para um currículo (mínimo de ${LIMITS.resumeTextMin} caracteres).` };
  }
  if (n > LIMITS.resumeTextMax) {
    return {
      value,
      error: `O currículo pode ter no máximo ${LIMITS.resumeTextMax} caracteres (você usou ${n}). Resuma o texto ou use o formulário manual.`,
    };
  }
  return { value, error: '' };
}

/**
 * Validação do arquivo pelo CONTEÚDO, como o backend: nome e tipo informados pelo navegador não
 * bastam (um arquivo qualquer renomeado para .pdf passaria). O limite de páginas só o servidor checa.
 */
export async function validatePdfFile(file: File): Promise<string> {
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > LIMITS.pdfBytes) return 'O arquivo passa de 5 MB. Envie um PDF menor.';
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const text = String.fromCharCode(...head);
    if (!text.includes('%PDF-')) return 'O arquivo não é um PDF válido.';
  } catch {
    return 'Não foi possível ler o arquivo. Tente selecioná-lo de novo.';
  }
  return '';
}

export type ApplicationMode = 'manual' | 'resume';
export type ResumeSubMode = 'text' | 'file';

export interface ApplicationFormValues {
  mode: ApplicationMode;
  resumeSubMode: ResumeSubMode;
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  city: string;
  state: string;
  yearsExperience: string;
  summary: string;
  educationDegree: string;
  educationInstitution: string;
  educationPeriod: string;
  skillsText: string;
  resumeText: string;
  hasFile: boolean;
  consent: boolean;
}

export interface NormalizedApplication {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  city: string;
  state: string;
  yearsExperience: number | null;
  summary: string;
  educationDegree: string;
  educationInstitution: string;
  educationPeriod: string;
  skills: string[];
  resumeText: string;
}

/**
 * Valida o formulário inteiro no modo escolhido. Campos do outro modo são ignorados — a pessoa pode
 * ter trocado de aba e deixado algo lá, e isso não pode bloquear o envio.
 */
export function validateApplicationForm(v: ApplicationFormValues): { errors: FieldErrors; normalized: NormalizedApplication } {
  const errors: FieldErrors = {};
  const add = (field: ApplicationField, error: string): void => {
    if (error && !errors[field]) errors[field] = error;
  };

  const name = validateName(v.name);
  const email = validateEmail(v.email);
  add('name', name.error);
  add('email', email.error);
  if (!v.consent) add('consent', CONSENT_REQUIRED_MESSAGE);

  const normalized: NormalizedApplication = {
    name: name.value, email: email.value, phone: '', linkedinUrl: '', city: '', state: '', yearsExperience: null,
    summary: '', educationDegree: '', educationInstitution: '', educationPeriod: '', skills: [], resumeText: '',
  };

  if (v.mode === 'manual') {
    const phone = validatePhone(v.phone);
    const linkedin = validateLinkedIn(v.linkedinUrl);
    const city = validateCity(v.city);
    const state = validateState(v.state);
    const years = validateYearsExperience(v.yearsExperience);
    const summary = validateSummary(v.summary);
    const degree = validateEducationText(v.educationDegree, 'Formação');
    const institution = validateEducationText(v.educationInstitution, 'Instituição');
    const period = validateEducationPeriod(v.educationPeriod);
    const skills = validateSkills(splitSkills(v.skillsText));

    add('phone', phone.error);
    add('linkedinUrl', linkedin.error);
    add('city', city.error);
    add('state', state.error);
    add('yearsExperience', years.error);
    add('summary', summary.error);
    add('educationDegree', degree.error);
    add('educationInstitution', institution.error);
    add('educationPeriod', period.error);
    if (!degree.value && (institution.value || period.value)) add('educationDegree', 'Informe o curso ou formação.');
    add('skills', skills.error);

    Object.assign(normalized, {
      phone: phone.value, linkedinUrl: linkedin.value, city: city.value, state: state.value, yearsExperience: years.value,
      summary: summary.value, educationDegree: degree.value, educationInstitution: institution.value,
      educationPeriod: period.value, skills: skills.value,
    });
  } else if (v.resumeSubMode === 'text') {
    const resume = validateResumeText(v.resumeText);
    add('resumeText', resume.error);
    normalized.resumeText = resume.value;
  } else if (!v.hasFile) {
    add('file', 'Selecione o arquivo do currículo em PDF.');
  }

  return { errors, normalized };
}
