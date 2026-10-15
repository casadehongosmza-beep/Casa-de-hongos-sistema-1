const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('selecting a saved customer fills the sale phone and delivery address', () => {
  const fn = html.match(/function fillTel\(k\)\{[^\n]+/);
  assert.ok(fn, 'fillTel is present');
  const fields = { venta_cli: { value: 'Cliente A' }, venta_tel: { value: '' }, venta_dir: { value: '' } };
  const context = vm.createContext({
    D: { clientes: [{ n: 'Cliente A', tel: '261123', dir: 'Calle 123' }] },
    $: selector => fields[selector.slice(1)] || null,
    telDe: () => '261123', toast() {}, $$$: String, Object,
  });
  vm.runInContext(fn[0] + "\nfillTel('venta')", context);
  assert.equal(fields.venta_tel.value, '261123');
  assert.equal(fields.venta_dir.value, 'Calle 123');
});

test('statistics calculate monthly harvest, sales, costs, and order count from saved movements', () => {
  const fn = html.match(/function statsData\(ym\)\{[^\n]+/);
  assert.ok(fn, 'statsData is present');
  const context = vm.createContext({
    D: {
      movs: [
        { t: 'prod', p: 'Gírgola por kg', f: '2026-10-02', q: 5, merma: 1 },
        { t: 'venta', f: '2026-10-03', id: 1, pedido_id: 'a', p: 100, q: 2, env: 50, envR: 20, prod: 'Gírgola 250 g', stockImpact: [{ product: 'Gírgola por kg', delta: -0.5 }] },
        { t: 'venta', f: '2026-10-03', id: 2, pedido_id: 'a', p: 200, q: 1, env: 0, envR: 0, prod: 'Burger x6' },
        { t: 'gasto', f: '2026-10-04', monto: 30 },
        { t: 'venta', f: '2026-09-30', id: 3, p: 900, q: 1 },
      ],
      fijos: [{ u: 'General', m: 10 }], prods: [],
    },
    kgCos: () => 4,
    cst: m => m.p * m.q * 0.2,
    fijoGir: () => 0,
    costoKgMes: () => 0,
    stockImpactFor: m => m.stockImpact || [],
    Math, Set,
  });
  vm.runInContext(fn[0], context);
  const result = context.statsData('2026-10');
  assert.equal(result.sales, 400);
  assert.equal(result.harvest, 4);
  assert.equal(result.kgSold, 0.5);
  assert.equal(result.orders, 1);
  assert.equal(result.expenses, 30);
  assert.equal(result.profit, 310);
});

test('configuration confirmation waits for cloud persistence and reports its result', async () => {
  const fn = html.match(/async function guardarConfigConfirmado\(\)\{[^\n]+/);
  assert.ok(fn, 'guardarConfigConfirmado is present');
  const calls = [];
  const context = vm.createContext({
    save() { calls.push('local'); }, clearTimeout() {}, cloudTimer: null,
    sb: {}, cloudUser: { id: 'user' },
    async cloudSaveNow() { await Promise.resolve(); calls.push('cloud'); },
    toast: value => calls.push(value),
  });
  await vm.runInContext(fn[0] + '\n(async()=>guardarConfigConfirmado())()', context);
  assert.deepEqual(calls, ['local', 'cloud', '✔ Precios y costos guardados y sincronizados']);
});

test('production module combines mushroom harvest and burger production as selectable views', () => {
  const fn = html.match(/function pProduccion\(\)\{[\s\S]*?(?=\nfunction statsData)/);
  assert.ok(fn, 'pProduccion is present');
  const context = vm.createContext({
    D: { prods: [{ n: 'Gírgola por kg', s: 8 }, { n: 'Burger (unidad)', s: 12 }], movs: [] },
    prodTab: 'cosecha', P: n => ({ 'Gírgola por kg': { n, s: 8 }, 'Burger (unidad)': { n, s: 12 } }[n]),
    kgCos: () => 3, mes: () => '2026-10', stockImpactFor: () => [],
    frm: (name, title) => `<form data-type="${name}">${title}</form>`,
    Math,
  });
  vm.runInContext(fn[0], context);
  const harvest = context.pProduccion();
  assert.match(harvest, /Cosecha de gírgolas/);
  assert.match(harvest, /Registrar cosecha de gírgolas/);
  context.prodTab = 'burger';
  const burgers = context.pProduccion();
  assert.match(burgers, /Producción de burgers/);
  assert.match(burgers, /Registrar producción de burgers/);
});

