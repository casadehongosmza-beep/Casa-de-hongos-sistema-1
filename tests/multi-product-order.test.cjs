const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const functions = html.match(/function guardarVenta\(\)\{[\s\S]*?(?=\nfunction del\()/)?.[0];
const stockFunctions = html.match(/function stockImpactFor\(m\)\{[\s\S]*?(?=\nconst usados)/)?.[0];

function runOrder(lines, stock = 20, credit = 0) {
  assert.ok(functions, 'guardarVenta is present');
  const products = [
    { n: 'Gírgola 250 g', u: 'Gírgolas', p: 1000, c: 300, s: stock, kg: 0.25 },
    { n: 'Burger x6', u: 'Burger', p: 2400, c: 1000, s: stock, un: 6 },
    { n: 'Burger (unidad)', u: 'Burger', p: 500, c: 150, s: stock },
    { n: 'Combo', u: 'Combos', p: 3000, c: 1300, s: 0, combo: [{ n: 'Gírgola 250 g', q: 1 }, { n: 'Burger x6', q: 1 }] },
  ];
  const input = {
    venta_f: { value: '2026-10-15' }, venta_cli: { value: 'Cliente' }, venta_tel: { value: '123' },
    venta_dir: { value: 'Calle 1' }, venta_zona: { value: 'Maipú' }, venta_envR: { value: '900' },
    venta_pago: { value: 'Efectivo' }, venta_cobrado: { value: 'Sí' }, venta_cred: { value: credit ? 'Sí' : 'No' },
  };
  const document = {
    querySelectorAll: () => lines.map((line, i) => ({ dataset: { line: String(i) } })),
  };
  lines.forEach((line, i) => {
    input[`venta_prod_${i}`] = { value: line.p };
    input[`venta_qty_${i}`] = { value: String(line.q) };
    input[`venta_price_${i}`] = { value: String(line.pr || '') };
  });
  const context = vm.createContext({
    D: { prods: products, zonas: { Maipú: 400 }, gratis: 5, rec: { cred: credit }, clientes: [], movs: [] },
    FD: { venta: [['f'], ['p'], ['q'], ['pr'], ['cli'], ['tel'], ['dir'], ['zona'], ['envR', '', 'number'], ['pago'], ['cobrado', '', 'yn'], ['cred', '', 'yn']] },
    document, $: id => input[id.slice(1)] || null,
    P: n => products.find(p => p.n === n) || {}, precio: p => p.p, promoOn: () => false,
    desc: (p, q) => p.kg ? [[products[0], q * p.kg]] : p.un ? [[products[2], q * p.un]] : [[p, q]],
    recalc() {}, save() {}, render() {}, toast: s => { context.lastToast = s }, hoy: () => '2026-10-15',
    Math, Date,
  });
  vm.runInContext(`${functions}\nguardarVenta()`, context);
  return context;
}

test('saves multiple selectable products as one order with shared delivery and accurate stock', () => {
  const c = runOrder([{ p: 'Gírgola 250 g', q: 4 }, { p: 'Burger x6', q: 1 }]);
  assert.equal(c.D.movs.length, 2);
  assert.equal(c.D.movs[0].pedido_id, c.D.movs[1].pedido_id);
  assert.equal(c.D.movs.reduce((a, m) => a + m.env, 0), 0, 'shipping is waived using the order quantity');
  assert.equal(c.D.movs.reduce((a, m) => a + m.envR, 0), 900, 'delivery cost is only recorded once');
  assert.equal(c.D.prods[0].s, 19, 'gírgola stock is reduced by the requested weight');
  assert.equal(c.D.prods[2].s, 14, 'burger x6 is reduced by six individual burgers');
  assert.match(c.lastToast, /2 producto/);
});

test('applies a delivery fee once when the order is below the free shipping threshold', () => {
  const c = runOrder([{ p: 'Gírgola 250 g', q: 1 }, { p: 'Burger (unidad)', q: 1 }]);
  assert.equal(c.D.movs.reduce((a, m) => a + m.env, 0), 400);
  assert.equal(c.D.movs.reduce((a, m) => a + m.envR, 0), 900);
});

test('rejects an incomplete order without saving any product', () => {
  const c = runOrder([{ p: 'Gírgola 250 g', q: 1 }, { p: 'Burger x6', q: 0 }]);
  assert.equal(c.D.movs.length, 0);
  assert.equal(c.D.prods[0].s, 20);
  assert.match(c.lastToast, /cantidad válida/);
});

test('applies visit credit once across the complete order', () => {
  const c = runOrder([{ p: 'Gírgola 250 g', q: 1 }, { p: 'Burger x6', q: 1 }], 20, 1200);
  assert.equal(c.D.movs[0].p * c.D.movs[0].q + c.D.movs[1].p * c.D.movs[1].q, 2200);
  assert.equal(c.D.movs.reduce((a, m) => a + m.credAmt, 0), 1200);
  assert.equal(c.D.movs.filter(m => m.cred).length, 1, 'the order has one control to remove the credit');
});

function runDelete(movements, products, recipe = { kg: 2.5, burgers: 40 }) {
  assert.ok(stockFunctions, 'stockImpactFor and del are present');
  const context = vm.createContext({
    D: { movs: movements, prods: products, rec: recipe },
    P: n => products.find(p => p.n === n) || {}, sure: () => true,
    save() {}, render() {}, toast: message => { context.lastToast = message },
    Math, Number,
  });
  vm.runInContext(`${stockFunctions}\ndel(${movements[0].id})`, context);
  return context;
}

test('deleting one item from a multi-product order restores stock for the whole order', () => {
  const products = [
    { n: 'Gírgola 250 g', kg: 0.25, s: 19.5 },
    { n: 'Gírgola por kg', s: 9.5 },
    { n: 'Burger (unidad)', s: 4 },
    { n: 'Burger x6', un: 6, s: 0 },
  ];
  const c = runDelete([
    { t: 'venta', id: 1, pedido_id: 'pedido', prod: 'Gírgola 250 g', q: 2, stockImpact: [{ product: 'Gírgola por kg', delta: -0.5 }] },
    { t: 'venta', id: 2, pedido_id: 'pedido', prod: 'Burger x6', q: 1 },
  ], products);
  assert.equal(c.D.movs.length, 0);
  assert.equal(c.D.prods.find(p => p.n === 'Gírgola por kg').s, 10);
  assert.equal(c.D.prods.find(p => p.n === 'Burger (unidad)').s, 10);
  assert.match(c.lastToast, /stock\/costo actualizado/);
});

test('deleting production and harvest reverses their stock effects, using saved impacts when present', () => {
  const products = [
    { n: 'Gírgola por kg', s: 4.875 },
    { n: 'Burger (unidad)', u: 'Burger', s: 5 },
  ];
  const c = runDelete([
    { t: 'prod', id: 3, p: 'Burger (unidad)', q: 2, merma: 1,
      stockImpact: [{ product: 'Burger (unidad)', delta: 1 }, { product: 'Gírgola por kg', delta: -0.125 }] },
  ], products);
  assert.equal(c.D.prods.find(p => p.n === 'Burger (unidad)').s, 4);
  assert.equal(c.D.prods.find(p => p.n === 'Gírgola por kg').s, 5);

  products[0].s = 19;
  const harvest = runDelete([{ t: 'prod', id: 4, p: 'Gírgola por kg', q: 10, merma: 1 }], products);
  assert.equal(harvest.D.prods[0].s, 10, 'legacy harvests without a saved impact use net kg');
});

test('deleting a band reverses both the mushroom input and packed-product stock', () => {
  const products = [
    { n: 'Gírgola por kg', s: 4.5 },
    { n: 'Bandeja 250 g', kg: 0.25, s: 2 },
  ];
  const c = runDelete([{ t: 'band', id: 5, p: 'Bandeja 250 g', q: 2 }], products);
  assert.equal(c.D.prods[0].s, 5);
  assert.equal(c.D.prods[1].s, 0);
});

test('deleting a costed extract production restores the previous unit cost', () => {
  const products = [{ n: 'Extracto', u: 'Otros', c: 200, s: 8 }];
  const c = runDelete([
    { t: 'prod', id: 6, p: 'Extracto', q: 2, productCost: 200, previousProductCost: 150 },
    { t: 'prod', id: 7, p: 'Extracto', q: 2, productCost: 150, previousProductCost: 100 },
  ], products);
  assert.equal(c.D.prods[0].c, 150, 'the remaining production becomes the active unit cost');
});

test('deleting an expense movement removes it without changing product stock', () => {
  const products = [{ n: 'Extracto', u: 'Otros', c: 100, s: 8 }];
  const c = runDelete([{ t: 'gasto', id: 8, det: 'Envío', monto: 3000 }], products);
  assert.equal(c.D.movs.length, 0);
  assert.equal(c.D.prods[0].s, 8);
});

