import {
  ApplicationFormValues,
  Checked,
  LIMITS,
  emailDomainWarning,
  validateApplicationForm,
  validateCity,
  validateEducationPeriod,
  validateEmail,
  validateLinkedIn,
  validateName,
  validatePdfFile,
  validatePhone,
  validateResumeText,
  validateSkills,
  validateState,
  validateYearsExperience,
} from './application-validation';

// Os casos abaixo são os mesmos de clearhire-server/internal/domain/candidate/application_validation_test.go.
// Ao mudar uma regra, mude os dois — o front e o backend têm que concordar sobre o que é válido.

interface FieldCase {
  in: string;
  want?: string; // valor normalizado quando válido
  err?: string; // trecho da mensagem esperada
}

function runCases(fn: (raw: string) => Checked, cases: FieldCase[]): void {
  for (const c of cases) {
    const got = fn(c.in);
    if (c.err) {
      expect(got.error).withContext(`entrada ${JSON.stringify(c.in)}`).toContain(c.err);
    } else {
      expect(got.error).withContext(`entrada ${JSON.stringify(c.in)}`).toBe('');
      expect(got.value).withContext(`entrada ${JSON.stringify(c.in)}`).toBe(c.want ?? '');
    }
  }
}

describe('application-validation', () => {
  it('nome', () => {
    runCases(validateName, [
      { in: 'Pedro Henrique Santana', want: 'Pedro Henrique Santana' },
      { in: '  maria   da  silva ', want: 'maria da silva' },
      { in: "João D'Ávila-Souza", want: "João D'Ávila-Souza" },
      { in: 'Ana M. Costa', want: 'Ana M. Costa' },
      { in: '', err: 'Informe seu nome' },
      { in: '   ', err: 'Informe seu nome' },
      { in: 'Pedro', err: 'nome e sobrenome' },
      { in: 'Pedro -', err: 'nome e sobrenome' },
      { in: 'Pedro 123', err: 'apenas letras' },
      { in: 'Pedro @Silva', err: 'apenas letras' },
      { in: '-Pedro Silva', err: 'apenas letras' },
      { in: 'a'.repeat(150) + ' ' + 'b'.repeat(60), err: 'no máximo 200' },
    ]);
  });

  it('e-mail', () => {
    runCases(validateEmail, [
      { in: 'Pedro.H@Gmail.com ', want: 'pedro.h@gmail.com' },
      { in: 'nome+vaga@empresa.com.br', want: 'nome+vaga@empresa.com.br' },
      { in: 'a@b.io', want: 'a@b.io' },
      { in: 'fulano@hotmail.fr', want: 'fulano@hotmail.fr' },
      { in: 'fulano@yahoo.co.uk', want: 'fulano@yahoo.co.uk' },
      { in: '', err: 'Informe seu e-mail' },
      { in: 'pedro', err: 'E-mail inválido' },
      { in: 'pedro@', err: 'E-mail inválido' },
      { in: 'pedro@gmail', err: 'E-mail inválido' },
      { in: 'pedro@@gmail.com', err: 'E-mail inválido' },
      { in: 'pedro..h@gmail.com', err: 'E-mail inválido' },
      { in: '.pedro@gmail.com', err: 'E-mail inválido' },
      { in: 'pedro silva@gmail.com', err: 'E-mail inválido' },
      { in: 'pedro@gmail.c', err: 'E-mail inválido' },
      { in: 'pedró@gmail.com', err: 'E-mail inválido' },
      { in: 'pedro@gmail.como', err: 'pedro@gmail.com?' },
      { in: 'pedro@gmail.com.br', err: 'pedro@gmail.com?' },
      { in: 'pedro@icloud.co', err: 'pedro@icloud.com?' },
      { in: 'pedro@hotmail.con', err: 'pedro@hotmail.com?' },
      { in: 'pedro@empresa.cmo', err: 'pedro@empresa.com?' },
      { in: 'a'.repeat(65) + '@gmail.com', err: 'E-mail inválido' },
    ]);
  });

  it('aviso de domínio parecido é só sugestão, e não aparece para domínio conhecido', () => {
    expect(emailDomainWarning('pedro@gmial.com')).toBe('pedro@gmail.com');
    expect(emailDomainWarning('pedro@hotmial.com')).toBe('pedro@hotmail.com');
    expect(emailDomainWarning('pedro@outlok.com.br')).toBe('pedro@outlook.com.br');
    expect(emailDomainWarning('pedro@gmail.com')).toBe('');
    expect(emailDomainWarning('pedro@uol.com.br')).toBe('');
    expect(emailDomainWarning('pedro@mail.com')).toBe('');
    expect(emailDomainWarning('pedro@minhaempresa.com.br')).toBe('');
    expect(emailDomainWarning('pedro@gmx.com')).toBe('');
    expect(emailDomainWarning('invalido')).toBe('');
  });

  it('telefone', () => {
    runCases(validatePhone, [
      { in: '', want: '' },
      { in: '61999023060', want: '(61) 99902-3060' },
      { in: '(61) 99902-3060', want: '(61) 99902-3060' },
      { in: '61 9 9902 3060', want: '(61) 99902-3060' },
      { in: '+55 61 99902-3060', want: '(61) 99902-3060' },
      { in: '5561999023060', want: '(61) 99902-3060' },
      { in: '061 99902-3060', want: '(61) 99902-3060' },
      { in: '(11) 3333-4444', want: '(11) 3333-4444' },
      { in: '+1 415 555 2671', want: '+14155552671' },
      { in: '+351 912 345 678', want: '+351912345678' },
      { in: 'abc', err: 'apenas números' },
      { in: '61 99902-3060 ramal 2', err: 'apenas números' },
      { in: '12345', err: 'DDD + número' },
      { in: '619990230601', err: 'DDD + número' },
      { in: '(20) 99902-3060', err: 'DDD 20 não existe' },
      { in: '(61) 89902-3060', err: 'deve começar com 9' },
      { in: '(61) 9902-3060', err: 'precisa do 9' },
      { in: '(61) 0902-3060', err: 'inválido' },
      { in: '(61) 99999-9999', err: 'inválido' },
      { in: '61+999023060', err: 'DDD + número' },
      { in: '+1 234', err: 'internacional' },
    ]);
  });

  it('LinkedIn', () => {
    const canonical = 'https://www.linkedin.com/in/pedro-oliveira';
    runCases(validateLinkedIn, [
      { in: '', want: '' },
      { in: 'linkedin.com/in/pedro-oliveira', want: canonical },
      { in: 'https://www.linkedin.com/in/pedro-oliveira/', want: canonical },
      { in: 'http://br.linkedin.com/in/pedro-oliveira?originalSubdomain=br', want: canonical },
      { in: 'www.LinkedIn.com/in/pedro-oliveira#top', want: canonical },
      { in: 'linkedin.com/in/joão-silva-12ab', want: 'https://www.linkedin.com/in/joão-silva-12ab' },
      { in: 'linkedin.com/PedroDiOliveira', err: 'linkedin.com/in/seu-nome' },
      { in: 'aaa', err: 'linkedin.com/in/seu-nome' },
      { in: 'https://evil.example/in/pedro', err: 'linkedin.com/in/seu-nome' },
      { in: 'https://linkedin.com.evil.example/in/pedro', err: 'linkedin.com/in/seu-nome' },
      { in: 'linkedin.com/in/ab', err: 'linkedin.com/in/seu-nome' },
      { in: 'linkedin.com/in/pedro/detalhes', err: 'linkedin.com/in/seu-nome' },
      { in: 'linkedin.com/company/acme', err: 'linkedin.com/in/seu-nome' },
    ]);
  });

  it('cidade e estado', () => {
    runCases(validateCity, [
      { in: '', want: '' },
      { in: '  Brasília ', want: 'Brasília' },
      { in: 'São José dos Campos', want: 'São José dos Campos' },
      { in: 'Embu-Guaçu', want: 'Embu-Guaçu' },
      { in: "Santa Bárbara d'Oeste", want: "Santa Bárbara d'Oeste" },
      { in: 'X', err: 'Cidade inválida' },
      { in: 'Brasília 2', err: 'Cidade inválida' },
      { in: '@@@', err: 'Cidade inválida' },
    ]);
    runCases(validateState, [
      { in: '', want: '' },
      { in: 'df', want: 'DF' },
      { in: ' SP ', want: 'SP' },
      { in: 'haha', err: 'Selecione um estado' },
      { in: 'Distrito Federal', err: 'Selecione um estado' },
      { in: 'XX', err: 'Selecione um estado' },
    ]);
  });

  it('anos de experiência', () => {
    expect(validateYearsExperience('')).toEqual({ value: null, error: '' });
    expect(validateYearsExperience('0')).toEqual({ value: 0, error: '' });
    expect(validateYearsExperience('60')).toEqual({ value: 60, error: '' });
    for (const bad of ['-1', '61', '4.5', '4,5', 'abc', '1e2']) {
      expect(validateYearsExperience(bad).error).withContext(bad).toContain('0 a 60');
    }
  });

  it('período da formação', () => {
    const now = new Date();
    const future = now.getFullYear() + LIMITS.periodYearsAhead;
    runCases((raw) => validateEducationPeriod(raw, now), [
      { in: '', want: '' },
      { in: '2015 - 2019', want: '2015 - 2019' },
      { in: '2021 – atual', want: '2021 – atual' },
      { in: '03/2015 a 12/2019', want: '03/2015 a 12/2019' },
      { in: `2024 - ${future}`, want: `2024 - ${future}` },
      { in: 'cursando', err: 'com anos' },
      { in: 'quatro anos', err: 'com anos' },
      { in: '2019 - 2015', err: 'início não pode ser depois' },
      { in: '1900 - 1904', err: 'fora do intervalo' },
      { in: `2020 - ${future + 1}`, err: 'fora do intervalo' },
    ]);
  });

  it('skills', () => {
    expect(validateSkills([' Python ', 'SQL', 'python', '', '--', 'Power  BI'])).toEqual({ value: ['Python', 'SQL', 'Power BI'], error: '' });

    const many = Array.from({ length: 41 }, (_, i) => `skill ${i}`);
    const tooMany = validateSkills(many);
    expect(tooMany.error).toContain('no máximo 40');
    expect(tooMany.error).toContain('41');

    const withDupes = [...many.slice(0, 40), 'SKILL 1', 'skill 2', 'Skill 3', 'skill 4', 'skill 5'];
    expect(validateSkills(withDupes).error).toBe('');
    expect(validateSkills(['x'.repeat(101)]).error).toContain('no máximo 100');
  });

  it('texto do currículo', () => {
    const ok = 'a'.repeat(LIMITS.resumeTextMin);
    runCases(validateResumeText, [
      { in: `  ${ok}  `, want: ok },
      { in: '', err: 'Cole o texto' },
      { in: 'Pedro, dev Python', err: 'curto demais' },
      { in: 'a'.repeat(LIMITS.resumeTextMax + 1), err: 'no máximo 14000' },
    ]);
  });

  it('arquivo PDF é validado pelo conteúdo', async () => {
    const pdf = new File(['%PDF-1.4\nconteúdo'], 'cv.pdf', { type: 'application/pdf' });
    const renamed = new File(['isto é texto'], 'cv.pdf', { type: 'application/pdf' });
    const empty = new File([], 'cv.pdf', { type: 'application/pdf' });

    expect(await validatePdfFile(pdf)).toBe('');
    expect(await validatePdfFile(renamed)).toContain('não é um PDF válido');
    expect(await validatePdfFile(empty)).toContain('vazio');
  });

  describe('formulário inteiro', () => {
    const base: ApplicationFormValues = {
      mode: 'manual', resumeSubMode: 'text', name: 'Pedro Santana', email: 'pedro@example.com', phone: '', linkedinUrl: '',
      city: '', state: '', yearsExperience: '', summary: '', educationDegree: '', educationInstitution: '', educationPeriod: '',
      skillsText: '', resumeText: '', hasFile: false, consent: true,
    };

    it('devolve o erro de cada campo de uma vez', () => {
      const { errors } = validateApplicationForm({
        ...base, name: 'Pedro', email: 'pedro@gmail.como', phone: 'abc', linkedinUrl: 'aaa', city: 'hahah2', state: 'haha',
        yearsExperience: '99', educationInstitution: 'UnB', educationPeriod: '2019 - 2015', consent: false,
      });
      for (const field of ['name', 'email', 'phone', 'linkedinUrl', 'city', 'state', 'yearsExperience', 'educationDegree', 'educationPeriod', 'consent'] as const) {
        expect(errors[field]).withContext(field).toBeTruthy();
      }
      expect(errors.educationDegree).toBe('Informe o curso ou formação.');
    });

    it('normaliza um formulário válido', () => {
      const { errors, normalized } = validateApplicationForm({
        ...base, name: ' pedro  henrique ', email: ' Pedro@Gmail.com', phone: '61999023060', linkedinUrl: 'linkedin.com/in/pedro-oliveira/',
        city: ' Brasília', state: 'df', yearsExperience: '4', educationDegree: 'Ciência da Computação', educationInstitution: 'UnB',
        educationPeriod: '2015 - 2019', skillsText: 'Go, go; SQL\nPower BI',
      });
      expect(errors).toEqual({});
      expect(normalized).toEqual(jasmine.objectContaining({
        name: 'pedro henrique', email: 'pedro@gmail.com', phone: '(61) 99902-3060',
        linkedinUrl: 'https://www.linkedin.com/in/pedro-oliveira', city: 'Brasília', state: 'DF', yearsExperience: 4,
        skills: ['Go', 'SQL', 'Power BI'],
      }));
    });

    it('ignora os campos do modo que não está em uso', () => {
      const resume = validateApplicationForm({ ...base, mode: 'resume', resumeText: 'currículo '.repeat(20), phone: 'abc', state: 'haha' });
      expect(resume.errors).toEqual({});

      const manual = validateApplicationForm({ ...base, resumeText: 'x' });
      expect(manual.errors).toEqual({});
    });

    it('exige o arquivo no envio de PDF', () => {
      const { errors } = validateApplicationForm({ ...base, mode: 'resume', resumeSubMode: 'file', hasFile: false });
      expect(errors.file).toContain('Selecione o arquivo');
    });
  });
});
