/*
 * Ligação ao Supabase (partilha em tempo real entre a família).
 * A chave "publishable" é pública por natureza: a segurança está nas regras
 * (RLS) da base de dados — cada família só vê e altera os seus próprios dados.
 * Deixar os campos vazios faz o portal funcionar só neste dispositivo.
 */
window.PORTAL_CONFIG = {
  supabaseUrl: 'https://gymxmrgptzqygfupadvw.supabase.co',
  supabaseKey: 'sb_publishable_P6mxAH4izo9UZERgSQ9eDA_42Ch0Lkp',
};
