const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const functions = html.match(/function guardarVenta\(\)\{[\s\S]*?(?=\nfunction del\()/)?.[0];

function runOrder(lines, stock = 20) {
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
    venta_pago: { value: 'Efectivo' }, venta_cobrado: { value: 'Sí' }, venta_cred: { value: 'No' },
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
    D: { prods: products, zonas: { Maipú: 400 }, gratis: 5, rec: { cred: 0 }, clientes: [], movs: [] },
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

