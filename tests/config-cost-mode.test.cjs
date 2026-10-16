const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('manual product costs survive recalculation while automatic costs still recalculate', () => {
  const derived = html.match(/const costoDerivado=[^\\n]+/);
  const cost = html.match(/function costoDe\\(p,ym\\)\\{[^\\n]+/);
  const recalc = html.match(/function recalc\\(\\)\\{[^\\n]+/);
  assert.ok(derived && cost && recalc);
  const context = vm.createContext({
    D: { prods: [
      { n: 'Burger (unidad)', un: 1, c: 1234, cMode: 'manual' },
      { n: 'Burger (unidad)', un: 1, c: 0, cMode: 'auto' },
    ] },
    P: () => ({}), costoKgMes: () => 250, burgerU: () => 100,
    kgCos: () => 0, mes: () => '2026-10', fijoGir: () => 0,
  });
  vm.runInContext(`${derived[0]}\\n${cost[0]}\\n${recalc[0]}`, context);
  context.recalc();
  assert.equal(context.D.prods[0].c, 1234);
  assert.equal(context.D.prods[1].c, 100);
  assert.equal(context.costoDe(context.D.prods[0], '2026-10'), 1234);
});

test('configuration allows choosing manual cost mode for calculated products', () => {
  const cfg = html.match(/function pCfg\\(\\)[\\s\\S]*?(?=\\nfunction |\\ninitCloud\\()/);
  assert.ok(cfg);
  assert.match(cfg[0], /Modo de costo/);
  assert.match(cfg[0], /value="manual"/);
  assert.match(cfg[0], /Costo manual/);
  assert.match(cfg[0], /Elegí Manual para editar este costo/);
});
