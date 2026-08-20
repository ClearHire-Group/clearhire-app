import { ActivityItem, AiSuggestion, Campaign, Candidate, CandidateProfileData, CompanyProfile, DashboardMetrics, Phase } from './models';

const FUNNEL_PHASES = (recebidos: number, fit: number, tecnica: number, entrevista: number, selecionados: number): Phase[] => [
  { key: 'recebidos', num: 1, label: 'Recebidos', count: recebidos },
  { key: 'fit', num: 2, label: 'Fit Cultural', count: fit },
  { key: 'tecnica', num: 3, label: 'Triagem Técnica', count: tecnica },
  { key: 'entrevista', num: 4, label: 'Entrevista Estruturada', count: entrevista },
  { key: 'selecionados', num: 5, label: 'Selecionados', count: selecionados },
];

export const MOCK_COMPANY_PROFILE: CompanyProfile = {
  name: 'Aurora Tech',
  values: [
    'Transparência radical',
    'Autonomia com responsabilidade',
    'Cuidado com o cliente',
    'Comunicação direta',
    'Diversidade e pertencimento',
  ],
  tone: 'Direto, mas empático — evitamos jargão corporativo e valorizamos clareza em qualquer conversa, interna ou com candidatos.',
  importance: 'Times pequenos e autônomos, decisões descentralizadas, feedback contínuo e impacto mensurável — priorizamos resultado em vez de horas trabalhadas.',
};

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'eng-software-senior-backend',
    title: 'Engenheiro(a) de Software Sênior — Backend',
    status: 'ativa',
    location: 'São Paulo, SP · Híbrido · CLT',
    meta: 'Aberta há 24 dias',
    totalCandidates: 142,
    currentPhaseLabel: 'Entrevista Estruturada',
    currentPhaseKey: 'entrevista',
    funnelPercent: 80,
    phases: FUNNEL_PHASES(142, 86, 41, 14, 3),
  },
  {
    id: 'customer-success-pleno',
    title: 'Analista de Customer Success Pleno',
    status: 'ativa',
    location: 'Remoto · CLT',
    meta: 'Aberta há 11 dias',
    totalCandidates: 45,
    currentPhaseLabel: 'Triagem Técnica',
    currentPhaseKey: 'tecnica',
    funnelPercent: 60,
    phases: FUNNEL_PHASES(45, 26, 9, 0, 0),
  },
  {
    id: 'designer-produto-senior',
    title: 'Designer de Produto Sênior',
    status: 'pausada',
    location: 'São Paulo, SP · Híbrido',
    meta: 'Pausada há 6 dias',
    totalCandidates: 28,
    currentPhaseLabel: 'Fit Cultural',
    currentPhaseKey: 'fit',
    funnelPercent: 40,
    phases: FUNNEL_PHASES(28, 11, 0, 0, 0),
  },
  {
    id: 'gerente-operacoes',
    title: 'Gerente de Operações',
    status: 'encerrada',
    location: 'Belo Horizonte, MG · Presencial',
    meta: 'Encerrada em 15/07/2026 · 1 contratação',
    totalCandidates: 63,
    currentPhaseLabel: 'Selecionados',
    currentPhaseKey: 'selecionados',
    funnelPercent: 100,
    phases: FUNNEL_PHASES(63, 33, 15, 5, 1),
  },
];

export const MOCK_CANDIDATES_BY_CAMPAIGN: Record<string, Candidate[]> = {
  'eng-software-senior-backend': [
    { id: 'andre-cavalcanti', campaignId: 'eng-software-senior-backend', phase: 'recebidos', name: 'André Cavalcanti', email: 'andre.cavalcanti@gmail.com', experience: '6 anos de experiência', location: 'Salvador, BA', matchPct: null, status: 'Aguardando análise da IA', initials: 'AC', avatarColorIndex: 0 },
    { id: 'priscila-homem', campaignId: 'eng-software-senior-backend', phase: 'recebidos', name: 'Priscila Homem', email: 'priscila.homem@gmail.com', experience: '3 anos de experiência', location: 'Campinas, SP', matchPct: null, status: 'Aguardando análise da IA', initials: 'PH', avatarColorIndex: 1 },
    { id: 'camila-duarte', campaignId: 'eng-software-senior-backend', phase: 'fit', name: 'Camila Duarte', email: 'camila.duarte@hotmail.com', experience: '4 anos de experiência', location: 'Porto Alegre, RS', matchPct: 79, status: 'Em análise · Fit Cultural', initials: 'CD', avatarColorIndex: 0 },
    { id: 'juliana-faccin', campaignId: 'eng-software-senior-backend', phase: 'fit', name: 'Juliana Faccin', email: 'juliana.faccin@gmail.com', experience: '5 anos de experiência', location: 'Recife, PE', matchPct: 72, status: 'Em análise · Fit Cultural', initials: 'JF', avatarColorIndex: 1 },
    { id: 'lucas-peixoto', campaignId: 'eng-software-senior-backend', phase: 'tecnica', name: 'Lucas Peixoto', email: 'lucas.peixoto@gmail.com', experience: '9 anos de experiência', location: 'São Paulo, SP', matchPct: 76, status: 'Em análise · Triagem Técnica', initials: 'LP', avatarColorIndex: 0 },
    { id: 'thiago-monteiro', campaignId: 'eng-software-senior-backend', phase: 'tecnica', name: 'Thiago Monteiro', email: 'thiago.monteiro@gmail.com', experience: '7 anos de experiência', location: 'Belo Horizonte, MG', matchPct: 85, status: 'Em análise · Triagem Técnica', initials: 'TM', avatarColorIndex: 1 },
    { id: 'marina-albuquerque', campaignId: 'eng-software-senior-backend', phase: 'entrevista', name: 'Marina Albuquerque', email: 'marina.albuquerque@gmail.com', experience: '8 anos de experiência', location: 'São Paulo, SP', matchPct: 94, status: 'Aguardando decisão', initials: 'MA', avatarColorIndex: 0 },
    { id: 'rafael-tanaka', campaignId: 'eng-software-senior-backend', phase: 'entrevista', name: 'Rafael Tanaka', email: 'rafael.tanaka@outlook.com', experience: '6 anos de experiência', location: 'Curitiba, PR', matchPct: 91, status: 'Aguardando decisão', initials: 'RT', avatarColorIndex: 1 },
    { id: 'beatriz-nogueira', campaignId: 'eng-software-senior-backend', phase: 'entrevista', name: 'Beatriz Nogueira', email: 'bia.nogueira@gmail.com', experience: '5 anos de experiência', location: 'Florianópolis, SC', matchPct: 88, status: 'Aguardando decisão', initials: 'BN', avatarColorIndex: 2 },
    { id: 'diego-salgado', campaignId: 'eng-software-senior-backend', phase: 'selecionados', name: 'Diego Salgado', email: 'diego.salgado@gmail.com', experience: '10 anos de experiência', location: 'Rio de Janeiro, RJ', matchPct: 92, status: 'Proposta em elaboração', initials: 'DS', avatarColorIndex: 2 },
  ],
  'customer-success-pleno': [
    { id: 'fernanda-rocha', campaignId: 'customer-success-pleno', phase: 'fit', name: 'Fernanda Rocha', email: 'fernanda.rocha@gmail.com', experience: '3 anos de experiência', location: 'São Paulo, SP', matchPct: 81, status: 'Em análise · Fit Cultural', initials: 'FR', avatarColorIndex: 0 },
    { id: 'gabriel-souza', campaignId: 'customer-success-pleno', phase: 'fit', name: 'Gabriel Souza', email: 'gabriel.souza@gmail.com', experience: '4 anos de experiência', location: 'Recife, PE', matchPct: 68, status: 'Em análise · Fit Cultural', initials: 'GS', avatarColorIndex: 1 },
    { id: 'isabela-martins', campaignId: 'customer-success-pleno', phase: 'tecnica', name: 'Isabela Martins', email: 'isabela.martins@gmail.com', experience: '5 anos de experiência', location: 'Rio de Janeiro, RJ', matchPct: 88, status: 'Em análise · Triagem Técnica', initials: 'IM', avatarColorIndex: 0 },
    { id: 'joao-ribeiro', campaignId: 'customer-success-pleno', phase: 'tecnica', name: 'João Ribeiro', email: 'joao.ribeiro@outlook.com', experience: '2 anos de experiência', location: 'Curitiba, PR', matchPct: 74, status: 'Em análise · Triagem Técnica', initials: 'JR', avatarColorIndex: 1 },
  ],
  'designer-produto-senior': [
    { id: 'larissa-andrade', campaignId: 'designer-produto-senior', phase: 'fit', name: 'Larissa Andrade', email: 'larissa.andrade@gmail.com', experience: '6 anos de experiência', location: 'Belo Horizonte, MG', matchPct: 85, status: 'Em análise · Fit Cultural', initials: 'LA', avatarColorIndex: 0 },
    { id: 'pedro-lima', campaignId: 'designer-produto-senior', phase: 'fit', name: 'Pedro Lima', email: 'pedro.lima@gmail.com', experience: '4 anos de experiência', location: 'São Paulo, SP', matchPct: 70, status: 'Em análise · Fit Cultural', initials: 'PL', avatarColorIndex: 1 },
  ],
  'gerente-operacoes': [
    { id: 'renata-costa', campaignId: 'gerente-operacoes', phase: 'recebidos', name: 'Renata Costa', email: 'renata.costa@gmail.com', experience: '7 anos de experiência', location: 'Salvador, BA', matchPct: null, status: 'Aguardando análise da IA', initials: 'RC', avatarColorIndex: 0 },
    { id: 'vinicius-alves', campaignId: 'gerente-operacoes', phase: 'fit', name: 'Vinícius Alves', email: 'vinicius.alves@gmail.com', experience: '9 anos de experiência', location: 'Fortaleza, CE', matchPct: 77, status: 'Em análise · Fit Cultural', initials: 'VA', avatarColorIndex: 1 },
    { id: 'patricia-gomes', campaignId: 'gerente-operacoes', phase: 'tecnica', name: 'Patrícia Gomes', email: 'patricia.gomes@gmail.com', experience: '11 anos de experiência', location: 'Belo Horizonte, MG', matchPct: 82, status: 'Em análise · Triagem Técnica', initials: 'PG', avatarColorIndex: 0 },
    { id: 'eduardo-santos', campaignId: 'gerente-operacoes', phase: 'entrevista', name: 'Eduardo Santos', email: 'eduardo.santos@gmail.com', experience: '13 anos de experiência', location: 'São Paulo, SP', matchPct: 90, status: 'Entrevista concluída', initials: 'ES', avatarColorIndex: 1 },
    { id: 'camila-ferreira', campaignId: 'gerente-operacoes', phase: 'selecionados', name: 'Camila Ferreira', email: 'camila.ferreira@gmail.com', experience: '10 anos de experiência', location: 'Belo Horizonte, MG', matchPct: 95, status: 'Contratada', initials: 'CF', avatarColorIndex: 2 },
  ],
};

export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  activeCampaigns: 2,
  activeCampaignsTrendLabel: '+1 esta semana',
  candidatesInProcess: 187,
  candidatesInProcessContextLabel: '4 campanhas',
  hiresInPeriod: 4,
  hiresGoalLabel: 'meta: 12',
  avgFunnelDays: 19,
  avgFunnelDaysTrendLabel: '-3 dias',
};

export const MOCK_AI_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'marina-ready',
    message: 'Marina Albuquerque (94% match) está pronta para avançar de Triagem Técnica para Entrevista Estruturada em Eng. Software Sênior.',
    primaryActionLabel: 'Revisar candidata',
    primaryActionRoute: ['/campanhas', 'eng-software-senior-backend', 'candidatos', 'marina-albuquerque'],
    highlighted: true,
  },
  {
    id: 'cs-fit-cultural',
    message: '7 novos candidatos foram analisados em Fit Cultural para Customer Success Pleno e aguardam sua triagem.',
    primaryActionLabel: 'Ver candidatos',
    primaryActionRoute: ['/campanhas', 'customer-success-pleno'],
    highlighted: false,
  },
  {
    id: 'divergent-interviewers',
    message: '2 candidatos em Entrevista Estruturada têm pareceres divergentes entre entrevistadores — recomenda-se revisão manual.',
    primaryActionLabel: 'Ver detalhes',
    primaryActionRoute: ['/campanhas', 'eng-software-senior-backend'],
    highlighted: false,
  },
];

export const MOCK_ACTIVITY_FEED: ActivityItem[] = [
  { id: 'act-1', actor: 'ia', message: 'IA concluiu a análise de Marina Albuquerque em Entrevista Estruturada — 94% de match, maior nota da fase.', campaignId: 'eng-software-senior-backend', campaignTitle: 'Eng. Software Sênior — Backend', timestampLabel: 'há 12 minutos' },
  { id: 'act-2', actor: 'recrutador', message: 'Você aprovou 3 candidatos em Recebidos para avançar à Fit Cultural.', campaignId: 'customer-success-pleno', campaignTitle: 'Analista de Customer Success Pleno', timestampLabel: 'há 40 minutos' },
  { id: 'act-3', actor: 'ia', message: 'IA analisou Rafael Tanaka em Entrevista Estruturada — 91% de match.', campaignId: 'eng-software-senior-backend', campaignTitle: 'Eng. Software Sênior — Backend', timestampLabel: 'há 1 hora' },
  { id: 'act-4', actor: 'ia', message: 'IA sinalizou divergência entre pareceres de 2 entrevistadores em Fit Cultural — revisão manual recomendada.', campaignId: 'designer-produto-senior', campaignTitle: 'Designer de Produto Sênior', timestampLabel: 'há 2 horas' },
  { id: 'act-5', actor: 'recrutador', message: 'Você aprovou Diego Salgado e moveu para Selecionados — proposta em elaboração.', campaignId: 'eng-software-senior-backend', campaignTitle: 'Eng. Software Sênior — Backend', timestampLabel: 'há 3 horas' },
  { id: 'act-6', actor: 'ia', message: 'IA concluiu a triagem técnica de 7 candidatos — resultados disponíveis para revisão.', campaignId: 'customer-success-pleno', campaignTitle: 'Analista de Customer Success Pleno', timestampLabel: 'ontem às 17:20' },
  { id: 'act-7', actor: 'recrutador', message: 'Você pausou a campanha após revisão do funil de Fit Cultural.', campaignId: 'designer-produto-senior', campaignTitle: 'Designer de Produto Sênior', timestampLabel: 'ontem às 15:05' },
  { id: 'act-8', actor: 'ia', message: 'IA analisou Camila Duarte em Fit Cultural — 79% de match.', campaignId: 'eng-software-senior-backend', campaignTitle: 'Eng. Software Sênior — Backend', timestampLabel: 'ontem às 11:48' },
  { id: 'act-9', actor: 'recrutador', message: 'Você aprovou a contratação de 1 candidato e encerrou a campanha.', campaignId: 'gerente-operacoes', campaignTitle: 'Gerente de Operações', timestampLabel: 'há 2 dias' },
  { id: 'act-10', actor: 'ia', message: 'IA recebeu e organizou 18 novas candidaturas em Recebidos.', campaignId: 'eng-software-senior-backend', campaignTitle: 'Eng. Software Sênior — Backend', timestampLabel: 'há 2 dias' },
  { id: 'act-11', actor: 'recrutador', message: 'Você criou a campanha e ativou o funil: Fit Cultural → Triagem Técnica.', campaignId: 'customer-success-pleno', campaignTitle: 'Analista de Customer Success Pleno', timestampLabel: 'há 3 dias' },
];

export const MOCK_CANDIDATE_PROFILES: Record<string, CandidateProfileData> = {
  'marina-albuquerque': {
    candidateId: 'marina-albuquerque',
    name: 'Marina Albuquerque',
    initials: 'MA',
    location: 'São Paulo, SP',
    experienceLabel: '8 anos de experiência',
    phaseLabel: 'Entrevista Estruturada',
    accent: 'terracota',
    contact: { email: 'marina.albuquerque@gmail.com', phone: '+55 11 98765-4321', linkedin: 'linkedin.com/in/marinaalbuquerque' },
    summary: 'Engenheira de software com 8 anos de experiência em sistemas distribuídos e plataformas de pagamento, com foco em Go e Python. Já liderou squads de até 6 pessoas e trabalhou em ambientes de alta escala (+50M usuários).',
    experience: [
      { role: 'Engenheira de Software Sênior', company: 'Nubank', period: 'jan/2022 — atual', description: 'Liderança técnica do time de liquidação de pagamentos. Redesenhou pipeline de processamento reduzindo latência em 40%.' },
      { role: 'Engenheira de Software Pleno', company: 'iFood', period: 'mar/2019 — dez/2021', description: 'Desenvolvimento de serviços de logística em tempo real; migração de monólito para microsserviços.' },
      { role: 'Engenheira de Software', company: 'Locaweb', period: 'jul/2017 — fev/2019', description: 'Backend de plataforma de hospedagem; construção de APIs REST internas.' },
    ],
    education: { degree: 'Bacharelado em Ciência da Computação', institution: 'USP', period: '2013 — 2017' },
    skills: ['Go', 'Python', 'Kubernetes', 'PostgreSQL', 'Kafka', 'AWS', 'Liderança técnica'],
    ai: {
      matchPct: 94,
      matchLabel: 'Aderência muito alta',
      matchNote: 'Maior match entre os candidatos avaliados nesta fase da campanha.',
      strengths: [
        'Experiência sólida em sistemas de alta escala, compatível com os desafios técnicos da vaga.',
        'Histórico de liderança técnica alinhado ao valor "autonomia com responsabilidade" do perfil cultural da empresa.',
        'Respostas na Triagem Técnica demonstraram profundidade em design de sistemas distribuídos.',
      ],
      concerns: [
        'Pouca experiência com o stack de mensageria usado internamente (RabbitMQ) — utiliza principalmente Kafka.',
        'Não mencionou experiência prévia gerenciando orçamento de squad, apenas liderança técnica.',
      ],
      justification: 'Marina apresenta a maior aderência técnica entre os candidatos avaliados nesta fase. Seu histórico de liderança e a resposta estruturada durante a Triagem Técnica indicam maturidade compatível com o nível sênior da vaga. Recomenda-se avançar para a entrevista com o gestor, com atenção ao alinhamento sobre expectativas de gestão de time.',
    },
  },
  'camila-duarte': {
    candidateId: 'camila-duarte',
    name: 'Camila Duarte',
    initials: 'CD',
    location: 'Porto Alegre, RS',
    experienceLabel: '4 anos de experiência',
    phaseLabel: 'Fit Cultural',
    accent: 'sand',
    contact: { email: 'camila.duarte@hotmail.com', phone: '+55 51 99887-1234', linkedin: 'linkedin.com/in/camiladuarte' },
    summary: 'Engenheira de software pleno com 4 anos de experiência em back-end Python, atuando em produtos de e-commerce e fintech. Busca crescer para posições de maior responsabilidade técnica.',
    experience: [
      { role: 'Engenheira de Software Pleno', company: 'Zenvia', period: 'jun/2022 — atual', description: 'APIs de comunicação em Python/Django; integração com gateways de mensageria. Remoto.' },
      { role: 'Engenheira de Software Jr/Pleno', company: 'VTEX', period: 'jan/2020 — mai/2022', description: 'Desenvolvimento de módulos do checkout; escrita de testes automatizados.' },
      { role: 'Estágio em Desenvolvimento', company: 'Dell Technologies', period: '2019', description: 'Suporte a ferramentas internas em Python.' },
    ],
    education: { degree: 'Bacharelado em Engenharia de Software', institution: 'PUCRS', period: '2016 — 2020' },
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker', 'Testes automatizados'],
    ai: {
      matchPct: 79,
      matchLabel: 'Aderência moderada',
      matchNote: 'Dentro da faixa aprovável, com pontos que valem uma conversa antes de avançar.',
      strengths: [
        'Respostas no questionário de fit cultural demonstraram forte alinhamento com o valor "cuidado com o cliente".',
        'Boa comunicação escrita e clareza nas respostas dissertativas.',
        'Trajetória em empresas com cultura de squads autônomos, similar à da empresa.',
      ],
      concerns: [
        'Respostas sobre tomada de decisão em cenários ambíguos foram genéricas, sem exemplos concretos.',
        'Nenhuma menção a experiência sob metas agressivas de curto prazo, ponto valorizado no perfil cultural da vaga.',
        'Permanência média de ~2 anos nas últimas empresas, abaixo da média dos candidatos mais bem avaliados nesta campanha.',
      ],
      justification: 'Camila demonstra alinhamento cultural razoável, especialmente em comunicação e orientação ao cliente. As respostas sobre autonomia em cenários ambíguos, porém, foram menos aprofundadas que as de outros candidatos nesta fase. Recomenda-se avançar com cautela — vale aprofundar esse ponto em conversa inicial antes da Triagem Técnica.',
    },
  },
};
