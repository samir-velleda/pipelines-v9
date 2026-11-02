/**
 * Merx Studio — browser-only domain model.
 * Configuration helpers, concept content and illustrative source generation.
 * No networking, neural inference, publication or device access occurs here.
 */

const MODEL_ID = 'object-detector-v1';
const LOCAL_NOTICE = 'Validação local não executa modelo neural nem homologa aceleração Merx.';
const MODES = ['presence', 'dwell', 'line_crossing'];
const DIRECTIONS = ['both', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'];
const CONFIGURATION_KEYS = ['mode', 'model', 'confidence', 'zone', 'line', 'classNames', 'minDurationSeconds', 'cooldownSeconds', 'minFrames', 'targetFps', 'direction', 'backendPolicy', 'targetVariant'];
const CLASSES = ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 'backpack', 'handbag', 'suitcase'];
const CLASS_LABELS = {
  person: 'pessoas', car: 'carros', truck: 'caminhões', bus: 'ônibus',
  motorcycle: 'motos', bicycle: 'bicicletas', dog: 'cachorros', cat: 'gatos',
  backpack: 'mochilas', handbag: 'bolsas', suitcase: 'malas',
};
export const DEVICE_FPS_MIN = 1;
export const DEVICE_FPS_MAX = 10;
export function clampTargetFps(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEVICE_FPS_MAX;
  return Math.min(DEVICE_FPS_MAX, Math.max(DEVICE_FPS_MIN, Math.round(n)));
}
const DEFAULTS = {
  confidence: 0.65,
  zone: { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
  line: { start: { x: 0.5, y: 0.15 }, end: { x: 0.5, y: 0.85 } },
  classNames: ['person'],
  minDurationSeconds: 10,
  cooldownSeconds: 30,
  minFrames: 3,
  targetFps: DEVICE_FPS_MAX,
  direction: 'both',
  backendPolicy: 'accelerated',
  targetVariant: 'merx-standard',
};

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  return value;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function normalized(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function point(value) {
  if (Array.isArray(value) && value.length === 2) return { x: value[0], y: value[1] };
  if (plainObject(value)) return { x: value.x, y: value.y };
  return { x: NaN, y: NaN };
}
function finiteRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function normalizedPoint(value) {
  if (Array.isArray(value) ? value.length !== 2 : !plainObject(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'x') || !Object.hasOwn(value, 'y')) return false;
  const p = point(value);
  return finiteRange(p.x, 0, 1) && finiteRange(p.y, 0, 1);
}
function polygon(zone) {
  if (Array.isArray(zone)) return zone.map(point);
  if (!plainObject(zone)) return [];
  const { x, y, width, height } = zone;
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}
function cross(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
function onSegment(p, a, b) {
  return Math.abs(cross(a, b, p)) < 1e-9 && p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 && p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9;
}
function segmentsIntersect(a, b, c, d) {
  const c1 = cross(a, b, c), c2 = cross(a, b, d), c3 = cross(c, d, a), c4 = cross(c, d, b);
  return (c1 * c2 < 0 && c3 * c4 < 0) || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}
function zoneProblem(zone) {
  if (!Array.isArray(zone)) {
    if (!plainObject(zone)) return 'Defina um retângulo ou um polígono para a zona.';
    if (Object.keys(zone).length !== 4 || !['x', 'y', 'width', 'height'].every(key => Object.hasOwn(zone, key))) return 'O retângulo deve conter somente x, y, width e height.';
    if (!finiteRange(zone.x, 0, 1) || !finiteRange(zone.y, 0, 1) || !finiteRange(zone.width, 0.001, 1) || !finiteRange(zone.height, 0.001, 1)) return 'A zona exige x e y entre 0 e 1, com largura e altura positivas.';
    if (zone.x + zone.width > 1 + 1e-9 || zone.y + zone.height > 1 + 1e-9) return 'A zona ultrapassa os limites da imagem.';
  }
  if (Array.isArray(zone) && !zone.every(normalizedPoint)) return 'Use pontos com somente x e y, ou pares [x, y], entre 0 e 1.';
  const pts = polygon(zone);
  if (pts.length < 3 || pts.length > 16 || !pts.every(normalizedPoint)) return 'Use de 3 a 16 pontos, com coordenadas entre 0 e 1.';
  const area = pts.reduce((sum, p, i) => { const q = pts[(i + 1) % pts.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
  if (Math.abs(area) < 1e-6) return 'A zona deve possuir uma área maior que zero.';
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) return 'Remova pontos repetidos da zona.';
    for (let j = i + 1; j < pts.length; j += 1) {
      if (j === i + 1 || (i === 0 && j === pts.length - 1)) continue;
      if (segmentsIntersect(a, b, pts[j], pts[(j + 1) % pts.length])) return 'Os lados do polígono não podem se cruzar.';
    }
  }
  return null;
}

export const TEMPLATES = freeze([
  {
    id: 'presence-zone', title: 'Presença em uma zona', mode: 'presence', model: MODEL_ID,
    description: 'Defina quem observar, desenhe uma área e configure quando emitir um evento de presença.',
    ruleParameters: clone(DEFAULTS),
  },
  {
    id: 'dwell-time', title: 'Tempo de permanência', mode: 'dwell', model: MODEL_ID,
    description: 'Proponha um alerta quando a mesma pessoa ou objeto permanecer na área pelo tempo definido. Requer rastreamento homologado.',
    ruleParameters: { ...clone(DEFAULTS), minDurationSeconds: 30, cooldownSeconds: 60 },
  },
  {
    id: 'line-crossing', title: 'Cruzamento de linha', mode: 'line_crossing', model: MODEL_ID,
    description: 'Configure uma linha e a direção de passagem. O teste real dependerá de rastreamento e uma taxa de frames adequada.',
    ruleParameters: { ...clone(DEFAULTS), minFrames: 2, cooldownSeconds: 5, targetFps: 10 },
  },
]);

export const CATALOG = freeze([
  {
    id: 'presence-zone', title: 'Presença em área definida', category: 'Segurança', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'scan', coverClass: 'cover-violet',
    description: 'Observe pessoas dentro de uma zona e ajuste a confirmação antes do alerta.',
    longDescription: 'Uma base para áreas de acesso controlado, depósitos e espaços que precisam de acompanhamento. O analítico combina uma classe detectada, uma zona da imagem, um nível de confiança e uma sequência de confirmação. O conceito ainda precisa de execução e avaliação no equipamento.',
    model: 'Detector de objetos — a homologar',
    capabilities: ['Zona configurável', 'Filtro por classe e confiança', 'Confirmação temporal', 'Evento com evidência'],
    requirements: ['Câmera com imagem disponível', 'Modelo e runtime compatíveis', 'Perfil de execução homologado'],
    limitations: ['Presença não comprova intenção ou acesso indevido.', 'Oclusão, iluminação e distância afetam a detecção.', 'Este conceito não está disponível para compra ou instalação.'],
    tags: ['Pessoas', 'Zona', 'Presença'],
  },
  {
    id: 'dwell-time', title: 'Permanência prolongada', category: 'Operações', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'timer', coverClass: 'cover-amber',
    description: 'Acompanhe o tempo de uma pessoa na área e defina um limite para o evento.',
    longDescription: 'Uma proposta para entender permanência em áreas de atendimento, espera ou circulação. Exige associar a mesma trajetória ao longo do tempo, tratar interrupções e reiniciar a contagem quando necessário. A validação de configuração não comprova que o rastreamento está funcionando.',
    model: 'Detector e rastreador — a homologar',
    capabilities: ['Tempo mínimo configurável', 'Zona de observação', 'Intervalo entre eventos', 'Estado por trajetória'],
    requirements: ['Rastreamento homologado', 'Frames com timestamps', 'Regra de tratamento de oclusões'],
    limitations: ['Uma trajetória não identifica uma pessoa civilmente.', 'Trocas de identidade no tracking alteram o tempo medido.', 'Os limites de qualidade ainda serão medidos.'],
    tags: ['Permanência', 'Tempo', 'Tracking'],
  },
  {
    id: 'line-crossing', title: 'Passagens por uma linha', category: 'Operações', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'route', coverClass: 'cover-blue',
    description: 'Defina a linha, a classe e a direção que representam uma passagem.',
    longDescription: 'Um ponto de partida para contar passagens de pessoas ou veículos em um trecho da imagem. A regra precisa usar trajetória, direção e controle de duplicidade. Ela será avaliada com sequências anotadas antes de anunciar capacidade ou precisão.',
    model: 'Detector e rastreador — a homologar',
    capabilities: ['Linha editável', 'Direção de passagem', 'Filtro de classes', 'Controle de evento por trajetória'],
    requirements: ['Rastreamento consistente', 'Taxa de frames homologada', 'Posicionamento adequado da câmera'],
    limitations: ['Pessoas visíveis por frame não equivalem a visitantes únicos.', 'Frames perdidos podem ocultar uma passagem.', 'Não há quantidade de câmeras homologada nesta demonstração.'],
    tags: ['Contagem', 'Linha', 'Direção'],
  },
  {
    id: 'vehicle-zone', title: 'Veículos em área definida', category: 'Mobilidade', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'car', coverClass: 'cover-slate',
    description: 'Explore regras de presença para carros, motos, caminhões e ônibus.',
    longDescription: 'Uma ideia para áreas de carga, estacionamento e circulação. A classe e a zona são configuráveis; o modelo precisa distinguir os veículos relevantes na câmera real. Reconhecimento de placa e identificação individual exigem outros componentes.',
    model: 'Detector multiclasse — a homologar',
    capabilities: ['Seleção de classes de veículo', 'Zona de interesse', 'Confiança configurável', 'Evidência por evento'],
    requirements: ['Classes de veículo no modelo', 'Campo de visão adequado', 'Avaliação diurna e noturna'],
    limitations: ['Não faz leitura de placas.', 'Não determina autorização de estacionamento.', 'A execução de veículos ainda requer integração e homologação.'],
    tags: ['Veículos', 'Doca', 'Zona'],
  },
  {
    id: 'animal-zone', title: 'Animais em uma zona', category: 'Ambientes', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'paw-print', coverClass: 'cover-green',
    description: 'Configure uma proposta de detecção de cachorros ou gatos em áreas específicas.',
    longDescription: 'Um conceito para acompanhar a presença de classes de animais suportadas pelo detector. O laboratório deve avaliar porte, distância, oclusão e condições de imagem. A regra descreve presença e não interpreta comportamento ou risco.',
    model: 'Detector multiclasse — a homologar',
    capabilities: ['Classes cachorro e gato', 'Zona configurável', 'Confirmação por frames', 'Intervalo entre alertas'],
    requirements: ['Modelo com as classes desejadas', 'Imagem suficiente para distinguir o animal', 'Conjunto de teste representativo'],
    limitations: ['Não reconhece espécie fora das classes homologadas.', 'Não determina agressividade ou situação de perigo.', 'Este item é um conceito em preparação.'],
    tags: ['Animais', 'Ambientes', 'Presença'],
  },
  {
    id: 'abandoned-object', title: 'Objeto deixado em uma área', category: 'Segurança', author: 'Merx',
    status: 'concept', availability: 'Em preparação', icon: 'package', coverClass: 'cover-rose',
    description: 'Explore a combinação de objeto, tempo e contexto para propor um alerta.',
    longDescription: 'Um analítico de objeto deixado exige mais que detectar uma bolsa em um frame: é necessário acompanhar o objeto, distinguir o fundo, avaliar permanência e considerar o contexto. Este conceito documenta essas dependências para uma implementação futura.',
    model: 'Detecção, tracking e contexto — a desenvolver',
    capabilities: ['Zona de interesse', 'Tempo configurável', 'Estado temporal do objeto', 'Evidência contextual'],
    requirements: ['Classes de objeto apropriadas', 'Rastreamento e tratamento de fundo', 'Avaliação de falsos positivos'],
    limitations: ['Presença de bolsa ou mala não comprova abandono.', 'A regra completa ainda não está implementada.', 'Não determina conteúdo ou periculosidade de um objeto.'],
    tags: ['Objetos', 'Contexto', 'Tempo'],
  },
]);

export const DOCS = freeze([
  { id: 'getting-started', title: 'Seu primeiro analítico', eyebrow: 'Começar', sections: [
    { heading: 'Descreva o resultado esperado', body: 'Informe o que deve ser observado, em qual área e em que condição um evento deve surgir. Exemplo: pessoas que permaneçam mais de 30 segundos na metade direita da imagem.', code: 'Crie um analítico de permanência de pessoas por 30 segundos na metade direita. Use confiança de 75% e intervalo de 60 segundos entre alertas.' },
    { heading: 'Converse e confira a configuração', body: 'Com sua conta conectada e o serviço disponível, o assistente usa um modelo de linguagem para propor alterações. O modo local reconhece um conjunto limitado de instruções. Em ambos, o resultado é uma configuração validada e um exemplo de código: conversar não executa o analítico. Confira as alterações nas características, no fluxo e no código.' },
    { heading: 'Evolua com evidências', body: 'Uma configuração válida é o começo. A próxima etapa de um produto operacional será executar o candidato num equipamento autorizado, medir qualidade e recursos e reunir evidências para revisão humana.' },
  ] },
  { id: 'package', title: 'Como um pacote é organizado', eyebrow: 'Contrato', sections: [
    { heading: 'Conteúdo e instalação são separados', body: 'O pacote descreve regras, parâmetros, modelo e compatibilidade. A instalação vincula esse conteúdo a um cliente, dispositivo e câmera. Credenciais de câmera e chaves privadas não fazem parte do pacote.' },
    { heading: 'Manifesto em rascunho', body: 'O manifesto gerado aqui usa schema v1 e API de runtime 3 propostos. Seus hashes são placeholders e os perfis Merx estão marcadas como planejadas. Ele é uma especificação de rascunho, não um pacote instalável.' },
    { heading: 'Versão e integridade', body: 'Na implementação de distribuição, arquivos precisam de hashes reais, origem verificada e assinatura destacada do manifesto canônico. O conteúdo aprovado será imutável; alterações produzirão um novo candidato.' },
  ] },
  { id: 'execution', title: 'Execução e código Rust', eyebrow: 'Execução', sections: [
    { heading: 'O papel do processador principal', body: 'O host Rust coordena captura, preparação de imagem, filas, pós-processamento, regras e eventos. O modelo neural compilado é executado no perfil acelerado do Merx. Um programa Rust não passa a ser acelerado apenas por ser escrito em Rust.' },
    { heading: 'Perfis Merx', body: 'As metas iniciais são os perfis merx-standard e merx-pro. Compatibilidade exige modelo e runtime testados juntos no Merx. O perfil não determina sozinho o número de câmeras ou analíticos.' },
    { heading: 'Falhas explícitas', body: 'Uma regra configurada como accelerated deve ficar bloqueada quando a execução acelerada não estiver disponível. Um modo padrão exige artefato e perfil próprios aprovados. A demonstração não valida nenhum desses caminhos.', code: 'Padrão: captura → preparação → regra e eventos\nAcelerado: inferência do modelo compilado\nEstado atual do editor: configuração local, sem dispositivo conectado' },
  ] },
  { id: 'laboratory', title: 'O laboratório de testes', eyebrow: 'Validação', sections: [
    { heading: 'O que a simulação mostra', body: 'Pontos e trajetórias simulados ajudam a conferir zona, direção e parâmetros. Eles não são detecções de uma câmera, não medem precisão de um modelo e não demonstram desempenho no Merx.' },
    { heading: 'O teste no equipamento', body: 'A integração futura deverá vincular um test_run_id ao digest do candidato, à câmera e à unidade autorizada. O relatório deve registrar backend real, versão, timestamps, recursos, falhas e evidências.' },
    { heading: 'Critérios diferentes', body: 'Teste de configuração verifica formato e limites. Teste de regra verifica comportamento determinístico. Teste neural mede resultado do modelo. Homologação verifica qualidade, capacidade e confiabilidade do conjunto no Merx anunciado.' },
  ] },
  { id: 'review', title: 'Revisão antes de disponibilizar', eyebrow: 'Qualidade', sections: [
    { heading: 'Revisão humana', body: 'A submissão autenticada registra uma proposta imutável para avaliação humana. O parecer inicial considera a configuração, os direitos, a finalidade e as limitações. Aprovar essa proposta não publica um produto nem substitui a execução no equipamento e a homologação do modelo.' },
    { heading: 'Selamento do candidato', body: 'Congelar o manifesto e os arquivos, testar esse conteúdo e vincular o relatório ao seu digest. A revisão considera também o digest do relatório. Qualquer alteração posterior exige novo selamento.' },
    { heading: 'O que a Store deve informar', body: 'Uma versão homologada deve apresentar finalidade, perfil Merx testado, condições de funcionamento e limitações. Itens marcados como conceito não possuem aprovação, avaliações de clientes ou disponibilidade comercial.' },
  ] },
  { id: 'publication', title: 'Da revisão à Merx Store', eyebrow: 'Publicação', sections: [
    { heading: 'Um único conteúdo aprovado', body: 'O fluxo previsto conecta Studio, revisão, Store, App e equipamento por uma versão imutável. A autorização de distribuição deve apontar para o mesmo digest aprovado pelo revisor.' },
    { heading: 'Instalação confirmada', body: 'O App precisa distinguir solicitação recebida, pacote preparado e analítico executando. A confirmação final depende do dispositivo reportar revisão aplicada e processamento recente.' },
    { heading: 'O estado desta versão', body: 'O portal oferece autoria, rascunhos locais e, com autenticação e serviço disponível, assistência conectada, persistência de projetos e submissão para revisão. Compilação remota, publicação, compra, instalação no Merx e homologação aceleração Merx ainda dependem de integração. Os conceitos da Store não estão disponíveis comercialmente.' },
  ] },
]);

function projectConfiguration(project) {
  return plainObject(project?.configuration) ? project.configuration : {};
}
function templateFor(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
function modeLabel(mode) {
  return { presence: 'presença na zona', dwell: 'tempo de permanência', line_crossing: 'cruzamento de linha' }[mode] || 'regra a configurar';
}

export function createProject({ name, description, templateId } = {}) {
  const template = templateFor(templateId);
  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() || `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const project = {
    id,
    name: text(name, 120) || 'Novo analítico',
    description: text(description, 4000),
    templateId: template.id,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    configuration: { ...clone(template.ruleParameters), mode: template.mode, model: template.model },
    versions: [{ version: '0.1.0', status: 'draft' }],
  };
  project.source = generateRust(project);
  return project;
}

export function validateProject(project) {
  const checks = [];
  function check(id, label, passed, detail, failure) {
    checks.push({ id, label, status: passed ? 'passed' : 'failed', detail: passed ? detail : failure });
  }
  const c = projectConfiguration(project);
  check('identity', 'Nome do projeto', typeof project?.name === 'string' && project.name.trim().length >= 3 && project.name.trim().length <= 120 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(project.name), 'Nome com 3 a 120 caracteres.', 'Informe um nome de 3 a 120 caracteres, sem caracteres de controle.');
  const description = project?.description ?? '';
  check('description', 'Descrição do projeto', typeof description === 'string' && description.trim().length <= 4000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(description), 'Descrição com até 4000 caracteres.', 'Use uma descrição de até 4000 caracteres, sem caracteres de controle.');
  check('configuration', 'Estrutura da configuração', plainObject(project?.configuration) && Object.keys(c).length === CONFIGURATION_KEYS.length && CONFIGURATION_KEYS.every(key => Object.hasOwn(c, key)), 'Configuração local estruturada com os campos do schema.', 'A configuração deve conter exatamente os campos do schema do editor.');
  check('mode', 'Tipo de regra', MODES.includes(c.mode), `Regra de ${modeLabel(c.mode)}.`, 'Escolha presença, permanência ou cruzamento de linha.');
  check('model', 'Referência ao modelo', c.model === MODEL_ID, 'Referência de detector prevista no contrato.', 'O editor reconhece somente object-detector-v1; sua integração ainda está pendente.');
  check('confidence', 'Confiança', finiteRange(c.confidence, 0.1, 0.99), 'Confiança entre 10% e 99%.', 'Use confiança numérica entre 0,10 e 0,99.');
  const validClasses = Array.isArray(c.classNames) && c.classNames.length > 0 && c.classNames.length <= 8 && c.classNames.every(v => CLASSES.includes(v)) && new Set(c.classNames).size === c.classNames.length;
  check('classes', 'Classes desejadas', validClasses, 'Classes reconhecidas pelo editor; suporte neural ainda não homologado.', 'Escolha de 1 a 8 classes reconhecidas e sem repetição.');
  const zoneError = zoneProblem(c.zone);
  check('zone', 'Zona de interesse', !zoneError, 'Coordenadas normalizadas dentro da imagem.', zoneError);
  const line = c.line;
  const validLine = plainObject(line) && Object.keys(line).length === 2 && normalizedPoint(line.start) && normalizedPoint(line.end) && Math.hypot(point(line.start).x - point(line.end).x, point(line.start).y - point(line.end).y) >= 0.01;
  check('line', 'Linha de referência', validLine, 'Extremos válidos e distintos.', 'Defina dois extremos entre 0 e 1, separados por pelo menos 0,01.');
  check('duration', 'Tempo de permanência', finiteRange(c.minDurationSeconds, 1, 86400), 'Tempo entre 1 segundo e 24 horas.', 'Use um tempo numérico de 1 a 86400 segundos.');
  check('cooldown', 'Intervalo entre eventos', finiteRange(c.cooldownSeconds, 0, 86400), 'Intervalo entre 0 segundos e 24 horas.', 'Use intervalo numérico de 0 a 86400 segundos.');
  check('frames', 'Confirmação por frames', Number.isInteger(c.minFrames) && c.minFrames >= 1 && c.minFrames <= 60, 'Confirmação de 1 a 60 frames.', 'Use um número inteiro de 1 a 60 frames.');
  check('fps', 'Taxa solicitada', finiteRange(c.targetFps, DEVICE_FPS_MIN, DEVICE_FPS_MAX), `Solicitação entre ${DEVICE_FPS_MIN} e ${DEVICE_FPS_MAX} FPS, o máximo aceito pelo equipamento.`, `Use uma taxa de ${DEVICE_FPS_MIN} a ${DEVICE_FPS_MAX} FPS.`);
  check('direction', 'Direção', DIRECTIONS.includes(c.direction), 'Direção reconhecida pela regra.', 'Escolha uma direção válida de cruzamento.');
  check('backend', 'Política de execução', ['accelerated', 'accelerated_preferred', 'standard'].includes(c.backendPolicy), 'Política de backend declarada.', 'Escolha accelerated, accelerated_preferred ou standard.');
  check('variant', 'Variante desejada', ['merx-standard', 'merx-pro'].includes(c.targetVariant), 'Perfil Merx declarado; homologação pendente.', 'Escolha merx-standard ou merx-pro.');
  checks.push({ id: 'local-only', label: 'Escopo desta validação', status: 'warning', detail: LOCAL_NOTICE });
  checks.push({ id: 'model-integration', label: 'Modelo e perfil de execução', status: 'warning', detail: 'O modelo, o artefato artefato compilado, os recursos e o vínculo com uma câmera real ainda precisam ser testados e homologados.' });
  if (c.mode === 'dwell' || c.mode === 'line_crossing') checks.push({ id: 'tracking', label: 'Dependência de rastreamento', status: 'warning', detail: 'Esta regra exige trajetórias consistentes e tratamento de frames perdidos. Esta validação não executa nem homologa tracking.' });
  if (c.backendPolicy !== 'accelerated') checks.push({ id: 'standard-artifact', label: 'Artefato processamento padrão', status: 'warning', detail: 'Modo processamento padrão ou fallback exige modelo processamento padrão equivalente, limites medidos e autorização explícita. Não há fallback implementado nesta demonstração.' });
  const errors = checks.filter(item => item.status === 'failed').map(item => item.detail);
  return { valid: errors.length === 0, checks, errors };
}


// Canonical executable spec — same contract the Merx Bot sends to devices.
// Mirrors backend executable_spec(); preview, flow, code, manifest, review and Store derive from it.
export const COCO_IDS = { person: 0, bicycle: 1, car: 2, motorcycle: 3, bus: 5, truck: 7, cat: 15, dog: 16, backpack: 24, handbag: 26, suitcase: 28 };
const CATALOG_OF = { person: 'pessoas', bicycle: 'veiculos', car: 'veiculos', motorcycle: 'veiculos', bus: 'veiculos', truck: 'veiculos', cat: 'animais', dog: 'animais', backpack: 'objetos_esquecidos', handbag: 'objetos_esquecidos', suitcase: 'objetos_esquecidos' };
export function buildExecutableSpec(project) {
  const c = projectConfiguration(project), names = Array.isArray(c.classNames) ? c.classNames.filter(id => id in COCO_IDS) : [];
  const catalogs = [...new Set(names.map(id => CATALOG_OF[id]))].sort();
  const device = { catalogo: catalogs.length === 1 ? catalogs[0] : 'personalizado', regra: c.mode === 'line_crossing' ? 'contagem' : 'presenca',
    classes: [...new Set(names.map(id => COCO_IDS[id]))].sort((a, b) => a - b),
    conf: Math.round(Math.min(.9, Math.max(.1, Number(c.confidence) || .4)) * 100) / 100,
    min_frames: Math.min(5, Math.max(1, Math.round(Number(c.minFrames) || 1))), descricao: text(project?.name, 240) };
  if (catalogs.length > 1) device.catalogos = catalogs;
  Object.assign(device, deviceGeometry(c, device.regra));
  return { schema: 'merx-executable-spec/v1', name: text(project?.name, 120), device,
    rule: { mode: c.mode, classNames: names, zone: c.zone, line: c.line, direction: c.direction, minDurationSeconds: c.minDurationSeconds,
      cooldownSeconds: c.cooldownSeconds, targetFps: c.targetFps, profile: c.targetVariant, execution: c.backendPolicy },
    deviceSupport: { ...GEOMETRY_SUPPORT } };
}
// Spec v2 geometry (optional; older device agents ignore these keys). Mirrors backend device_geometry().
export const SPEC_DEVICE_VERSION = 2;
const GEOMETRY_SUPPORT = { zone: true, line: true, direction: true, targetFps: true, requiresDeviceSpec: SPEC_DEVICE_VERSION };
const DIR_VECTORS = { left_to_right: [1, 0], right_to_left: [-1, 0], top_to_bottom: [0, 1], bottom_to_top: [0, -1] };
const r4 = v => Math.round(Math.min(1, Math.max(0, Number(v))) * 1e4) / 1e4;
const devPt = p => Array.isArray(p) ? [r4(p[0]), r4(p[1])] : [r4(p?.x), r4(p?.y)];
export function deviceGeometry(c, regra) {
  const out = { spec_version: SPEC_DEVICE_VERSION }, z = c.zone;
  const pts = (Array.isArray(z) ? z : plainObject(z) ? [[z.x, z.y], [z.x + z.width, z.y], [z.x + z.width, z.y + z.height], [z.x, z.y + z.height]] : []).map(devPt);
  if (pts.length >= 3 && pts.length <= 16 && pts.flat().every(Number.isFinite)) out.zona = pts;
  const l = c.line;
  if (regra === 'contagem' && plainObject(l) && l.start && l.end) {
    const a = devPt(l.start), b = devPt(l.end);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) >= 0.01) {
      out.linha = [a, b]; const v = DIR_VECTORS[c.direction]; let sense = 'both';
      if (v) { const cross = (b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]; sense = cross > 1e-9 ? 'in' : cross < -1e-9 ? 'out' : 'both'; }
      out.sentido = sense;
    }
  }
  out.fps = clampTargetFps(c.targetFps);
  return out;
}
export function buildManifest(project) {
  const c = projectConfiguration(project);
  const validation = validateProject(project);
  const analyticId = normalized(project?.name || 'novo-analitico').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'novo-analitico';
  const version = text(project?.version, 64) || project?.versions?.at?.(-1)?.version || '0.1.0';
  return {
    schema: 'merx-analytic-package/v1',
    executable_spec: buildExecutableSpec(project),
    stage: 'draft',
    installable: false,
    analytic: { id: analyticId, version, name: text(project?.name, 120), description: text(project?.description), publisher_id: 'PENDING_PUBLISHER_ID' },
    runtime: { api: 3, status: 'proposed', implementation: 'declarative-v1', entrypoint: 'rules.json' },
    configuration_schema: 'config.schema.json',
    capabilities: ['detections.read', 'state.scoped', 'events.emit', 'evidence.request'],
    execution: { backend_policy: c.backendPolicy, requested_variant: c.targetVariant, operator: 'object-detection/v1', model: c.model, io_contract: 'contracts/detection.json' },
    rules: { mode: c.mode, classes: clone(c.classNames), confidence: c.confidence, zone: clone(c.zone), line: clone(c.line), direction: c.direction, min_duration_seconds: c.minDurationSeconds, cooldown_seconds: c.cooldownSeconds, min_frames: c.minFrames, requested_fps: c.targetFps },
    variants: ['merx-standard', 'merx-pro'].map(target => ({ id: target === 'merx-standard' ? 'std' : 'pro', target: target, model: `models/detector-${target}.bin`, qualification: 'planned', resource_profile: null, validated_platforms: [] })),
    files: Object.fromEntries(['rules.json', 'config.schema.json', 'contracts/detection.json', 'models/detector-standard.bin', 'models/detector-pro.bin'].map(path => [path, { sha256: 'PENDING_SHA256_64_HEX' }])),
    verification: { local_configuration_valid: validation.valid, neural_inference_executed: false, device_qualified: false, human_review: 'not_submitted', notice: LOCAL_NOTICE },
    signing: { status: 'pending', scheme: 'detached-canonical-manifest', signature_file: 'manifest.sig', note: 'Assinatura e relatório são externos ao conteúdo executável. Nenhum hash ou assinatura foi calculado nesta demonstração.' },
  };
}

function rustString(value) {
  const escapes = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
  return '"' + Array.from(String(value ?? ''), char => {
    if (Object.hasOwn(escapes, char)) return escapes[char];
    const code = char.codePointAt(0);
    if (code < 32 || code === 127) return `\\u{${code.toString(16)}}`;
    if (code >= 0xd800 && code <= 0xdfff) return '\uFFFD';
    return char;
  }).join('') + '"';
}
function rustNumber(value, fallback = 0) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Number.isInteger(n) ? `${n}.0` : String(n);
}

export function generateRust(project) {
  const c = { ...clone(DEFAULTS), mode: 'presence', model: MODEL_ID, ...clone(projectConfiguration(project)) };
  const pts = polygon(c.zone).filter(normalizedPoint);
  const classes = Array.isArray(c.classNames) ? c.classNames.filter(value => CLASSES.includes(value)) : [];
  const source = `// MERX STUDIO · EXEMPLO DE INTEGRAÇÃO · ${text(project?.name, 120).replace(/[\r\n]/g, ' ')}
// Rascunho local. Este arquivo não foi compilado ou executado pelo portal.
// Contrato ilustrativo para a API MNM 3, ainda não integrada.
// O host Rust executa no processamento padrão; somente um backend homologado executará o artefato compilado na aceleração Merx.
// Nenhuma câmera, inferência neural ou publicação é acionada por este exemplo.

#![forbid(unsafe_code)]

pub const ANALYTIC_NAME: &str = ${rustString(text(project?.name, 120))};
pub const MODEL_ID: &str = ${rustString(c.model)};
pub const RULE_MODE: &str = ${rustString(c.mode)};
pub const BACKEND_POLICY: &str = ${rustString(c.backendPolicy)};
pub const TARGET_VARIANT: &str = ${rustString(c.targetVariant)};
pub const CONFIDENCE: f32 = ${rustNumber(c.confidence, 0.65)};
pub const MIN_FRAMES: u32 = ${Number.isInteger(c.minFrames) && c.minFrames > 0 ? c.minFrames : 3};
pub const DWELL_SECONDS: f64 = ${rustNumber(c.minDurationSeconds, 10)};
pub const COOLDOWN_SECONDS: f64 = ${rustNumber(c.cooldownSeconds, 30)};
pub const REQUESTED_FPS: f32 = ${rustNumber(clampTargetFps(c.targetFps), DEVICE_FPS_MAX)};
pub const DIRECTION: &str = ${rustString(c.direction)};
pub const CLASSES: &[&str] = &[${classes.map(rustString).join(', ')}];
pub const ZONE: &[(f32, f32)] = &[${pts.map(p => `(${rustNumber(p.x)}, ${rustNumber(p.y)})`).join(', ')}];
pub const LINE: ((f32, f32), (f32, f32)) = (
    (${rustNumber(point(c.line?.start).x, 0.5)}, ${rustNumber(point(c.line?.start).y, 0.15)}),
    (${rustNumber(point(c.line?.end).x, 0.5)}, ${rustNumber(point(c.line?.end).y, 0.85)}),
);

pub struct Detection {
    pub class_name: String,
    pub confidence: f32,
    pub center: (f32, f32),
    pub track_id: Option<u64>,
}

pub struct FrameContext {
    pub installation_id: String,
    pub installation_revision: u64,
    pub camera_id: String,
    pub frame_id: u64,
    pub captured_at_ms: u64,
    pub package_digest: String,
}

pub struct FrameDetections {
    pub context: FrameContext,
    pub backend_used: String,
    pub detections: Vec<Detection>,
}

pub enum HostError {
    BackendUnavailable,
    IncompatibleModel,
    CameraUnavailable,
    CapacityExceeded,
    DeadlineExceeded,
}

// O SDK real deverá fornecer esta capacidade com câmera e recursos autorizados.
// Não há implementação deste trait neste rascunho: indisponibilidade é um erro.
pub trait VisionHost {
    fn next_detections(&mut self) -> Result<FrameDetections, HostError>;
}

// Filtro de processamento padrão ilustrativo; recebe detecções prontas, não processa uma imagem.
pub fn matches_class(detection: &Detection) -> bool {
    detection.confidence.is_finite()
        && detection.confidence >= CONFIDENCE
        && CLASSES.contains(&detection.class_name.as_str())
}

// Próxima integração da regra: ${modeLabel(c.mode)}.
// ${c.mode === 'dwell' ? 'Manter tempo por track_id e instalação; reiniciar após perda de trajetória.' : c.mode === 'line_crossing' ? 'Comparar posições anteriores por track_id; validar cruzamento do segmento e direção.' : 'Aplicar zona ao centro da detecção; exigir MIN_FRAMES antes do evento.'}
// Respeitar COOLDOWN_SECONDS e registrar instalação, versão, câmera e frame.
// Testar perda de frames, reinício, evidência, duplicação e limites de memória.
// A máquina de estados e a emissão dependem de implementação e testes do SDK.
`;
  return source;
}

export function generateFlow(project) {
  const c = projectConfiguration(project);
  const labels = (Array.isArray(c.classNames) ? c.classNames : []).map(id => CLASS_LABELS[id] || id).join(', ');
  const nodes = [
    { id: 'camera', title: 'Câmera', detail: 'Vínculo com dispositivo e captura ainda não conectados.', kind: 'input' },
    { id: 'prepare', title: 'Preparação no processamento padrão', detail: 'Captura, resize, pixels, timestamps e buffers limitados.', kind: 'std' },
    { id: 'inference', title: c.backendPolicy === 'standard' ? 'Modelo no processamento padrão' : 'Inferência na aceleração Merx', detail: `${c.model || MODEL_ID} · variante ${c.targetVariant || 'a definir'} · execução pendente.`, kind: 'model' },
    { id: 'filter', title: 'Classes e confiança', detail: `${labels || 'Classes a definir'} · ${finiteRange(c.confidence, 0, 1) ? Math.round(c.confidence * 100) + '%' : 'confiança a corrigir'}.`, kind: 'filter' },
    { id: 'rule', title: modeLabel(c.mode), detail: c.mode === 'dwell' ? `Permanência de ${c.minDurationSeconds} s; tracking necessário.` : c.mode === 'line_crossing' ? `Direção ${c.direction}; trajetória necessária.` : `Zona configurada e confirmação de ${c.minFrames} frames.`, kind: 'rule' },
    { id: 'event', title: 'Evento no App', detail: `Intervalo de ${c.cooldownSeconds} s. Entrega e evidência dependem de integração.`, kind: 'output' },
  ].map(node => ({ ...node, label: node.title }));
  return { nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })), summary: 'Fluxo proposto. O editor configura e ilustra estas etapas; não executa o pipeline.' };
}

/** Point-in-zone mathematics for a synthetic scene; never a neural detector. */
export function analyzeZone(inputPoint, polygonOrRect) {
  const p = point(inputPoint);
  if (!normalizedPoint(p) || zoneProblem(polygonOrRect)) return false;
  const pts = polygon(polygonOrRect);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const a = pts[j], b = pts[i];
    if (onSegment(p, a, b)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const CLASS_PATTERNS = [
  ['person', /\b(pessoa[s]?|person|persons|people|pedestre[s]?|persona[s]?|peaton(?:es)?)\b/],
  ['car', /\b(carro[s]?|automovel|automoveis|car[s]?|coche[s]?|auto[s]?)\b/],
  ['truck', /\b(caminhao|caminhoes|truck[s]?)\b/],
  ['bus', /\b(onibus|bus)\b/],
  ['motorcycle', /\b(moto[s]?|motocicleta[s]?|motorcycle[s]?)\b/],
  ['bicycle', /\b(bicicleta[s]?|bicycle[s]?|bike[s]?)\b/],
  ['dog', /\b(cachorro[s]?|cao|caes|dog[s]?)\b/],
  ['cat', /\b(gato[s]?|cat[s]?)\b/],
  ['backpack', /\b(mochila[s]?|backpack[s]?)\b/],
  ['handbag', /\b(bolsa[s]?|handbag[s]?)\b/],
  ['suitcase', /\b(mala[s]?|suitcase[s]?)\b/],
];
function numeric(value) { return Number(String(value).replace(',', '.')); }
function seconds(value, unit) {
  return numeric(value) * (/^min/.test(unit || '') ? 60 : /^h|^hora/.test(unit || '') ? 3600 : 1);
}

/**
 * Limited local instruction interpreter. It recognizes documented operations;
 * it is not an LLM and never performs deployment, model training or inference.
 */
const DEFAULT_NAMES = new Set(['novo analitico', 'new analytic', 'nuevo analitico', 'presenca inteligente', 'presencia inteligente', 'smart presence']);
function isDefaultName(name) { return !name || DEFAULT_NAMES.has(normalized(name)) || TEMPLATES.some(t => normalized(t.title || '') === normalized(name)); }
export function deriveName(c) {
  const classes = (Array.isArray(c.classNames) ? c.classNames : []).map(id => CLASS_LABELS[id] || id);
  if (!classes.length) return '';
  const list = classes.length > 1 ? `${classes.slice(0, -1).join(', ')} e ${classes[classes.length - 1]}` : classes[0];
  const prefix = { line_crossing: 'Contagem de', dwell: 'Permanência de', presence: 'Presença de' }[c.mode] || 'Detecção de';
  return text(`${prefix} ${list}`, 120);
}
export function interpretPrompt(project, prompt) {
  const original = plainObject(project) ? project : createProject();
  const next = clone(original);
  if (!plainObject(next.configuration)) next.configuration = { ...clone(DEFAULTS), mode: 'presence', model: MODEL_ID };
  const c = next.configuration;
  const input = text(prompt, 4000);
  const n = normalized(input);
  const changes = [];
  const clarifications = [];
  let geometryEdit = false;
  function set(key, value, label) {
    if (JSON.stringify(c[key]) !== JSON.stringify(value)) {
      c[key] = clone(value);
      changes.push(label);
      if (key === 'zone' || key === 'line') geometryEdit = true;
    }
  }
  if (!input) return { project: next, summary: 'Descreva o objeto, a área e a condição que devem gerar o evento.', changes, needsClarification: 'Exemplo: pessoas por 30 segundos na metade direita, com confiança de 75%.' };

  let requestedMode;
  if (/\b(permanencia|permanecer|permanecam|permaneca|dwell|ficar|fiquem)\b/.test(n) || /mais de\s+\d+\s*(seg|s\b|min)/.test(n)) requestedMode = 'dwell';
  else if (/cruz(?:ar|em|amento|e)|atravess|passa(?:gem|gens|r).*linha|line.crossing/.test(n)) requestedMode = 'line_crossing';
  else if (/\b(contar|conte|contem|contagem|contabilizar|contabilize|count|counting|contador|conteo)\b/.test(n)) requestedMode = 'line_crossing';
  else if (/\b(presenca|presente[s]?|presence|presencia)\b/.test(n)) requestedMode = 'presence';
  const counting = /\b(contar|conte|contem|contagem|contabilizar|contabilize|count|counting|contador|conteo)\b/.test(n);
  if (requestedMode) {
    set('mode', requestedMode, `Tipo de regra: ${modeLabel(requestedMode)}.`);
    next.templateId = TEMPLATES.find(t => t.mode === requestedMode).id;
  }

  const mentioned = CLASS_PATTERNS.filter(([, pattern]) => pattern.test(n)).map(([id]) => id);
  const removal = /(?:ignorar|ignore|remover|remova|nao detectar|desconsiderar|desconsidere)\s+([^.;]+)/.exec(n);
  if (removal) {
    const excluded = CLASS_PATTERNS.filter(([, pattern]) => pattern.test(removal[1])).map(([id]) => id);
    if (excluded.length) set('classNames', (Array.isArray(c.classNames) ? c.classNames : []).filter(id => !excluded.includes(id)), `Classes removidas: ${excluded.map(id => CLASS_LABELS[id]).join(', ')}.`);
  } else if (mentioned.length) {
    const selected = /\b(adicionar|adicione|incluir|inclua|tambem)\b/.test(n) ? [...new Set([...(c.classNames || []), ...mentioned])] : mentioned;
    set('classNames', selected, `Classes: ${selected.map(id => CLASS_LABELS[id]).join(', ')}.`);
  }
  if (/\b(veiculo[s]?)\b/.test(n) && !mentioned.some(id => ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(id))) set('classNames', ['car', 'truck', 'bus', 'motorcycle'], 'Classes: carros, caminhões, ônibus e motos.');
  if (/\b(animais|animal)\b/.test(n) && !mentioned.some(id => ['dog', 'cat'].includes(id))) {
    set('classNames', ['dog', 'cat'], 'Classes do exemplo: cachorros e gatos.');
    clarifications.push('Para outro animal, será necessário definir e homologar a classe no modelo.');
  }

  const confidence = /(?:confianca|confidence|limiar|threshold)\s*(?:(?:de|em|para)\s*)?[:=]?\s*(-?\d+(?:[.,]\d+)?)\s*(%)?/.exec(n);
  if (confidence) {
    let value = numeric(confidence[1]);
    if (confidence[2] || value > 1) value /= 100;
    set('confidence', value, `Confiança solicitada: ${Number((value * 100).toFixed(2))}%.`);
  }
  const cooldown = /(?:cooldown|intervalo(?:\s+entre\s+(?:os\s+)?(?:alertas|eventos))?|aguarde)\s*(?:(?:de|em|para)\s*)?[:=]?\s*(-?\d+(?:[.,]\d+)?)\s*(segundos?|segs?|s\b|minutos?|min\b|horas?|h\b)?/.exec(n);
  if (cooldown) set('cooldownSeconds', seconds(cooldown[1], cooldown[2]), `Intervalo entre eventos: ${seconds(cooldown[1], cooldown[2])} s.`);
  const duration = /(?:permanencia|permanecer|permanecam|permaneca|ficar|fiquem|durante|mais de|por|tempo)\s*(?:(?:de|em|por|para|mais de)\s*)?[:=]?\s*(-?\d+(?:[.,]\d+)?)\s*(segundos?|segs?|s\b|minutos?|min\b|horas?|h\b)/.exec(n);
  if (duration && (requestedMode === 'dwell' || c.mode === 'dwell')) set('minDurationSeconds', seconds(duration[1], duration[2]), `Permanência mínima: ${seconds(duration[1], duration[2])} s.`);
  const fps = /(-?\d+(?:[.,]\d+)?)\s*(?:fps|quadros por segundo|frames por segundo)\b/.exec(n);
  if (fps) {
    const requested = numeric(fps[1]);
    const applied = clampTargetFps(requested);
    set('targetFps', applied, applied === Math.round(requested) && requested >= DEVICE_FPS_MIN && requested <= DEVICE_FPS_MAX
      ? `Taxa solicitada: ${applied} FPS.`
      : `Taxa solicitada ajustada para ${applied} FPS (máximo do equipamento: ${DEVICE_FPS_MAX}).`);
  }
  const frames = /(?:confirm(?:acao|ar|e)\s*(?:por|com|em)?\s*|minimo de\s*)(\d+)\s*frames?\b/.exec(n);
  if (frames) set('minFrames', numeric(frames[1]), `Confirmação: ${numeric(frames[1])} frames.`);

  const rect = /zona\s*[:=]?\s*x\s*[:=]\s*(-?\d+(?:[.,]\d+)?)\s*[,;]?\s*y\s*[:=]\s*(-?\d+(?:[.,]\d+)?)\s*[,;]?\s*(?:largura|width|w)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)\s*[,;]?\s*(?:altura|height|h)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)/.exec(n);
  if (rect) set('zone', { x: numeric(rect[1]), y: numeric(rect[2]), width: numeric(rect[3]), height: numeric(rect[4]) }, 'Zona atualizada com as coordenadas informadas.');
  else if (/metade (?:da (?:tela|imagem) )?direita|lado direito/.test(n)) set('zone', { x: 0.5, y: 0, width: 0.5, height: 1 }, 'Zona: metade direita da imagem.');
  else if (/metade (?:da (?:tela|imagem) )?esquerda|lado esquerdo/.test(n)) set('zone', { x: 0, y: 0, width: 0.5, height: 1 }, 'Zona: metade esquerda da imagem.');
  else if (/metade superior|parte de cima/.test(n)) set('zone', { x: 0, y: 0, width: 1, height: 0.5 }, 'Zona: metade superior da imagem.');
  else if (/metade inferior|parte de baixo/.test(n)) set('zone', { x: 0, y: 0.5, width: 1, height: 0.5 }, 'Zona: metade inferior da imagem.');
  else if (/tela inteira|imagem inteira|quadro inteiro|toda a (?:imagem|tela)|zona completa/.test(n)) set('zone', { x: 0, y: 0, width: 1, height: 1 }, 'Zona: imagem inteira.');
  else if (/zona central|area central|no centro da (?:imagem|tela)/.test(n)) set('zone', { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 'Zona: área central da imagem.');

  const explicitLine = /linha\s*(?:de|:)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:ate|para|a|->)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(n);
  if (explicitLine) set('line', { start: { x: numeric(explicitLine[1]), y: numeric(explicitLine[2]) }, end: { x: numeric(explicitLine[3]), y: numeric(explicitLine[4]) } }, 'Linha atualizada com os dois extremos informados.');
  else if (/linha horizontal/.test(n)) set('line', { start: { x: 0.15, y: 0.5 }, end: { x: 0.85, y: 0.5 } }, 'Linha horizontal no centro da imagem.');
  else if (/linha vertical/.test(n)) set('line', { start: { x: 0.5, y: 0.15 }, end: { x: 0.5, y: 0.85 } }, 'Linha vertical no centro da imagem.');
  if (/esquerda (?:para|pra|a) (?:a )?direita/.test(n)) set('direction', 'left_to_right', 'Direção: da esquerda para a direita.');
  else if (/direita (?:para|pra|a) (?:a )?esquerda/.test(n)) set('direction', 'right_to_left', 'Direção: da direita para a esquerda.');
  else if (/cima (?:para|pra|a) (?:baixo|baixo da)/.test(n)) set('direction', 'top_to_bottom', 'Direção: de cima para baixo.');
  else if (/baixo (?:para|pra|a) cima/.test(n)) set('direction', 'bottom_to_top', 'Direção: de baixo para cima.');
  else if (/ambas (?:as )?direcoes|duas direcoes|ambos (?:os )?sentidos/.test(n)) set('direction', 'both', 'Direção: ambos os sentidos.');

  if (/\bmerx[- ]?pro\b/.test(n)) set('targetVariant', 'merx-pro', 'Perfil Merx definido, a homologar.');
  else if (/\bmerx[- ]?standard\b/.test(n)) set('targetVariant', 'merx-standard', 'Perfil Merx definido, a homologar.');
  if (/somente (?:na |no )?(?:processamento )?padrao|apenas (?:na |no )?(?:processamento )?padrao|modo (?:processamento )?padrao|standard.only/.test(n)) set('backendPolicy', 'standard', 'Política proposta: processamento padrão; artefato e perfil padrão pendentes.');
  else if (/fallback|preferir (?:a )?aceleracao|accelerated.preferred/.test(n)) set('backendPolicy', 'accelerated_preferred', 'Política proposta: preferir aceleração Merx; fallback exige artefato padrão homologado.');
  else if (/aceleracao obrigatoria|exigir (?:a )?aceleracao|accelerated(?!_)/.test(n)) set('backendPolicy', 'accelerated', 'Política: exigir aceleração Merx, com indisponibilidade explícita.');

  const newName = /(?:renomeie(?:\s+(?:o\s+)?(?:projeto|analitico))?\s+(?:para\s+)?|chame(?:\s+(?:o\s+)?(?:projeto|analitico))?\s+de\s+|nome\s*[:=]\s*)["“']?([^"”'\n.;]{3,120})/i.exec(input);
  if (newName) {
    const name = text(newName[1], 120);
    if (name !== next.name) { next.name = name; changes.push(`Nome: ${name}.`); }
  }
  if (/capacete|armas?\b|furto|roubo|agress|briga|placas?\b|facial|rosto|crianca|abandon|objeto esquecido/.test(n)) clarifications.push('Essa condição exige modelo ou lógica especializada que este editor ainda não oferece. Os parâmetros reconhecidos não implementam essa capacidade.');
  if (/\b(publicar|publique|instalar|instale|comprar|compre|treinar|treine|conectar|conecte)\b/.test(n)) clarifications.push('Esta demonstração não publica, instala, treina modelos nem conecta equipamentos. O resultado permanece como rascunho local.');
  if (counting && c.mode === 'line_crossing' && !/(esquerda|direita|cima|baixo|ambas|ambos|duas direcoes)/.test(n)) set('direction', 'both', 'Direção: ambos os sentidos (contagem por cruzamento).');
  if (!newName && changes.length && isDefaultName(next.name)) {
    const derived = deriveName(c);
    if (derived && derived !== next.name) { next.name = derived; changes.push(`Nome: ${derived}.`); }
  }

  if (!next.description && changes.length) next.description = input;
  if (changes.length) {
    next.updatedAt = new Date().toISOString();
    next.status = nextProjectStatus(next, { geometry: geometryEdit });
    next.source = generateRust(next);
  }
  const validation = validateProject(next);
  if (!validation.valid) clarifications.push(`A configuração ainda precisa de ajuste: ${validation.errors.join(' ')}`);
  const summary = changes.length
    ? `Atualizei o rascunho local: ${changes.join(' ')} O fluxo e o exemplo Rust acompanham a configuração. Nenhuma inferência neural foi executada.`
    : 'Não alterei o rascunho. Este assistente local reconhece presença, permanência, cruzamento de linha, classes, confiança, tempos, zona, direção e perfil Merx. Peça um desses ajustes ou confira se os valores já estão configurados.';
  return { project: next, summary, changes, ...(clarifications.length ? { needsClarification: clarifications.join(' ') } : {}) };
}

const REVIEW_STATUSES = new Set(['submitted', 'approved', 'rejected', 'changes_requested']);

export function displayStatus(project) {
  if (!project || typeof project !== 'object') return 'draft';
  const published = project.publicationStatus || project.submission?.publicationStatus;
  if (published === 'published') return 'published';
  const submissionStatus = project.submission?.status;
  if (REVIEW_STATUSES.has(submissionStatus)) return submissionStatus;
  if (project.status === 'published') return 'published';
  if (REVIEW_STATUSES.has(project.status)) return project.status;
  return 'draft';
}

export function statusTone(status) {
  if (status === 'approved' || status === 'published') return 'success';
  if (status === 'submitted') return 'blue';
  if (status === 'changes_requested') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'draft';
}

export function nextProjectStatus(project, { geometry = false } = {}) {
  const current = project?.status || 'draft';
  const pending = project?.submission?.status === 'submitted' || current === 'submitted';
  if (geometry && pending) return 'submitted';
  if (current === 'submitted') return 'draft';
  return current;
}

export function showDwellField(mode) {
  return mode !== 'line_crossing';
}

export function triggerKey(mode) {
  if (mode === 'line_crossing') return 'rule.whenLine';
  if (mode === 'dwell') return 'rule.whenDwell';
  return 'rule.whenPresence';
}

export function loginArrival({ licenseLoaded = false, licenseActive = false } = {}) {
  const known = Boolean(licenseLoaded);
  const active = Boolean(licenseActive);
  return {
    loadAccountProjects: true,
    showLicenseToast: known && !active,
    openLicense: known && !active,
  };
}

export function buildTestPayload(project, { deviceId = null, cameraId = null } = {}) {
  const configuration = clone(projectConfiguration(project));
  configuration.targetFps = clampTargetFps(configuration.targetFps);
  const spec = buildExecutableSpec({ ...project, configuration });
  return {
    deviceId,
    cameraId,
    fps: spec.device.fps,
    project: {
      id: project?.id,
      name: text(project?.name, 120),
      configuration,
    },
  };
}
