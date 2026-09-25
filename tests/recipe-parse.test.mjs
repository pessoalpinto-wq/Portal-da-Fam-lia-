import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRecipe, isoMinutes, decodeEntities } from '../supabase/functions/_shared/recipe-parse.js';

const page = (json) => `<html><head><title>x</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Site"}</script>
  <script type="application/ld+json">${JSON.stringify(json)}</script></head><body>…</body></html>`;

test('receita simples com passos HowToStep', () => {
  const r = extractRecipe(page({
    '@type': 'Recipe', name: 'Arroz de Pato &amp; Chouriço', image: ['/img/pato.jpg'],
    recipeIngredient: ['4 pernas de pato', '400 g de arroz', ' 1 chouriço '],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Cozer o pato.' }, { '@type': 'HowToStep', text: 'Juntar o arroz.' }],
    recipeYield: '4 pessoas', totalTime: 'PT1H30M', recipeCategory: 'Prato principal',
  }), 'https://exemplo.pt/receitas/arroz-de-pato');
  assert.equal(r.title, 'Arroz de Pato & Chouriço');
  assert.deepEqual(r.ingredients, ['4 pernas de pato', '400 g de arroz', '1 chouriço']);
  assert.deepEqual(r.steps, ['Cozer o pato.', 'Juntar o arroz.']);
  assert.equal(r.image, 'https://exemplo.pt/img/pato.jpg');
  assert.equal(r.servings, 4);
  assert.equal(r.minutes, 90);
  assert.equal(r.category, 'Prato principal');
});

test('receita dentro de @graph, com secções e texto HTML', () => {
  const r = extractRecipe(page({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'X' },
      {
        '@type': ['Recipe', 'NewsArticle'], name: 'Bolo',
        recipeIngredient: ['3 ovos', '200 g de a&ccedil;&uacute;car'],
        recipeInstructions: [{ '@type': 'HowToSection', name: 'Massa', itemListElement: [{ '@type': 'HowToStep', text: '<p>Bater os ovos.</p>' }] }],
        prepTime: 'PT15M', cookTime: 'PT40M', image: { '@type': 'ImageObject', url: 'https://cdn.x/bolo.jpg' },
      },
    ],
  }), 'https://x.pt/bolo');
  assert.equal(r.title, 'Bolo');
  assert.deepEqual(r.steps, ['Bater os ovos.']);
  assert.equal(r.minutes, 55);
  assert.equal(r.image, 'https://cdn.x/bolo.jpg');
});

test('instruções como texto corrido numerado', () => {
  const r = extractRecipe(page({ '@type': 'Recipe', name: 'Sopa', recipeIngredient: ['2 batatas'], recipeInstructions: '1. Cozer. 2. Triturar.<br>3. Servir.' }), 'https://a.pt');
  assert.deepEqual(r.steps, ['Cozer.', 'Triturar.', 'Servir.']);
});

test('páginas sem receita ou com JSON partido', () => {
  assert.equal(extractRecipe('<html><body>Olá</body></html>', 'https://a.pt'), null);
  assert.equal(extractRecipe(page({ '@type': 'Article', name: 'Notícia' }), 'https://a.pt'), null);
  const broken = '<script type="application/ld+json">{"@type":"Recipe","name":"Tosta","recipeIngredient":["pão","queijo",],}</script>';
  assert.equal(extractRecipe(broken, 'https://a.pt').title, 'Tosta');
});

test('auxiliares', () => {
  assert.equal(isoMinutes('PT45M'), 45);
  assert.equal(isoMinutes('P0DT2H'), 120);
  assert.equal(decodeEntities('Caf&eacute; &#233; &#xE9; a&ccedil;&uacute;car &Atilde;'), 'Café é é açúcar Ã');
});
