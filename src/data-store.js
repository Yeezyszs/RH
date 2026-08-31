// Data Store
// Arrays globais compartilhados entre index.html e src/app.js via window.*
// Preenchidos por inicializarSupabase() em supabase.js

/* eslint-disable no-var */

var COLABORADORES  = [];
var DEPENDENTES    = [];
var CONTATOS_EMERG = [];
var ADVERTENCIAS   = [];
var FERIAS         = [];
var DESLIGAMENTOS  = [];
var AFASTAMENTOS   = [];
var EVENTOS        = [];
var VENCIMENTOS    = [];
var EPI_CATALOGO   = [];
var EPI_ENTREGAS   = [];
var EPI_KITS       = {};
var VALE_COTAS     = {};
// Cota por mês: chave `${colaborador_id}|AAAA-MM` (VALE_COTAS guarda a mais recente).
var VALE_COTAS_MES = {};
var VALE_DESCONTOS = [];
// Consumo por mês: chave `${colaborador_id}|AAAA-MM`.
var VALE_USO_MES   = {};
// Saldo de abertura fixado manualmente por competência (mesma chave).
// A ausência da chave significa "calcular pelo acumulado dos meses anteriores".
var VALE_SALDO_INI = {};
// Configurações gerais (chave → valor), ex.: vale_combustivel_valor_padrao.
var CONFIG         = {};
var VA_BENEFICIOS  = {};
var SALARIOS       = {};
var FEEDBACK         = [];
var CLIMA            = [];
var POLITICAS        = [];
var PROCEDIMENTOS    = [];
var PROLABORE        = [];
var SAC              = [];
var PRESTADORES      = [];
var PC_CARGOS        = [];
var PC_PLANOS        = {};
var ROTATIVIDADE     = [];
var VALE_ALIMENTACAO = [];

var PARENTESCO_OPTS = ['Cônjuge','Mãe','Pai','Filho(a)','Irmã','Irmão','Avó','Avô','Tio(a)','Amigo(a)','Outro'];

var FAIXAS = [
  { min:      0, max:  2000, label: 'Até R$ 2k',      short: '≤2k'    },
  { min:   2000, max:  3500, label: 'R$ 2k – 3,5k',   short: '2-3,5k' },
  { min:   3500, max:  5000, label: 'R$ 3,5k – 5k',   short: '3,5-5k' },
  { min:   5000, max:  7500, label: 'R$ 5k – 7,5k',   short: '5-7,5k' },
  { min:   7500, max: 99999, label: 'Acima R$ 7,5k',  short: '>7,5k'  },
];

// Expõe para src/app.js (que lê via window.*)
window.COLABORADORES    = COLABORADORES;
window.DEPENDENTES      = DEPENDENTES;
window.CONTATOS_EMERG   = CONTATOS_EMERG;
window.ADVERTENCIAS     = ADVERTENCIAS;
window.FERIAS           = FERIAS;
window.DESLIGAMENTOS    = DESLIGAMENTOS;
window.AFASTAMENTOS     = AFASTAMENTOS;
window.EVENTOS          = EVENTOS;
window.VENCIMENTOS      = VENCIMENTOS;
window.EPI_CATALOGO     = EPI_CATALOGO;
window.EPI_ENTREGAS     = EPI_ENTREGAS;
window.EPI_KITS         = EPI_KITS;
window.VALE_COTAS       = VALE_COTAS;
window.VALE_COTAS_MES   = VALE_COTAS_MES;
window.VALE_DESCONTOS   = VALE_DESCONTOS;
window.VALE_USO_MES     = VALE_USO_MES;
window.VALE_SALDO_INI   = VALE_SALDO_INI;
window.CONFIG           = CONFIG;
window.VA_BENEFICIOS    = VA_BENEFICIOS;
window.SALARIOS         = SALARIOS;
window.FAIXAS           = FAIXAS;
window.FEEDBACK         = FEEDBACK;
window.CLIMA            = CLIMA;
window.POLITICAS        = POLITICAS;
window.PROCEDIMENTOS    = PROCEDIMENTOS;
window.PROLABORE        = PROLABORE;
window.SAC              = SAC;
window.PRESTADORES      = PRESTADORES;
window.PC_CARGOS        = PC_CARGOS;
window.PC_PLANOS        = PC_PLANOS;
window.ROTATIVIDADE     = ROTATIVIDADE;
window.VALE_ALIMENTACAO = VALE_ALIMENTACAO;
window.PARENTESCO_OPTS  = PARENTESCO_OPTS;
