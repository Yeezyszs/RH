// Shared constants used across modules and index.html

export const CHART_COLORS = {
  phthalo:       '#123E6B',
  phthaloLight:  '#2E7AB8',
  phthaloBright: '#4A9FD6',
  muted:         '#8A98A8',
  grid:          '#E3EBF3',
  text:          '#5A6B7C',
  // Paleta de cores vibrantes para gráficos de donut/pizza
  vibrant: [
    '#2E7AB8', // Azul
    '#E74C3C', // Vermelho
    '#27AE60', // Verde
    '#F39C12', // Laranja
    '#9B59B6', // Roxo
    '#1ABC9C', // Turquesa
    '#E67E22', // Laranja escuro
    '#16A085', // Verde escuro
  ],
};

export const STATUS_LABEL = {
  ativo:    { t: 'Ativo',    cls: 'ok'      },
  ferias:   { t: 'Férias',   cls: 'info'    },
  afastado: { t: 'Afastado', cls: 'warn'    },
  inativo:  { t: 'Inativo',  cls: 'neutral' },
};

export const VENC_CAT_BADGE = {
  'ASO':         { cls: 'info',    t: 'ASO' },
  'Documento':   { cls: 'neutral', t: 'Documento' },
  'Treinamento': { cls: 'ok',      t: 'Treinamento' },
};

export const ADV_TIPO_BADGE = {
  verbal:    { cls: 'warn',   t: 'Verbal' },
  escrita:   { cls: 'danger', t: 'Escrita' },
  suspensao: { cls: 'danger', t: 'Suspensão' },
};

export const ADV_STATUS_BADGE = {
  pendente: `<span class="badge warn">Pendente</span>`,
  assinada: `<span class="badge ok">Assinada</span>`,
  recusada: `<span class="badge danger">Recusada</span>`,
};

export const SETOR_ICON = {
  'Produção':       '⚙',
  'Administrativo': '📋',
  'Área Externa':   '🌾',
};
