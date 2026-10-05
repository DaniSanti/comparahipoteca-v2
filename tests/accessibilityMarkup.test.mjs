import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MortgageSimulator } from "../src/features/simulator/MortgageSimulator.tsx";
import { ComparisonTable } from "../src/features/comparison/ComparisonTable.tsx";
import { calculateMortgage } from "../src/domain/mortgageCalculations.ts";
import { createMortgageSnapshot } from "../src/features/comparison/comparisonState.ts";

test("initial simulator exposes named form, labels, automatic result and no submit CTA", () => {
  const html = renderToStaticMarkup(createElement(MortgageSimulator));
  assert.match(html, /<main/);
  assert.match(html, /<form[^>]*aria-labelledby="form-title"/);
  assert.match(html, /La cuota se actualiza al cambiar los datos/);
  assert.doesNotMatch(html, /Calcular hipoteca|type="submit"|aria-invalid="true"/);
  for (const id of ["purchasePrice", "savings", "termYears", "fixedTin"]) {
    assert.match(html, new RegExp(`<label for="${id}">`));
    assert.match(html, new RegExp(`aria-describedby="${id}-unit${id === "termYears" ? "" : " decimal-format"}"`));
  }
  assert.match(html, /<fieldset><legend>Tipo de hipoteca<\/legend>/);
  assert.match(html, /Cuota mensual estimada/);
  assert.match(html, /role="status" aria-atomic="true"/);
});

test("comparison exposes a caption, scoped headers, named actions and share loading state", () => {
  const input = { purchasePrice: 250000, savings: 60000, termYears: 25, type: "fixed", fixedTin: 3.25 };
  const snapshots = ["one", "two"].map((id) => createMortgageSnapshot(input, calculateMortgage(input), id));
  const html = renderToStaticMarkup(createElement(ComparisonTable, {
    simulations: snapshots, onRemove: () => {}, onShare: () => {}, sharingId: "two",
  }));
  assert.match(html, /<caption id="comparison-caption">Comparación de 2 hipotecas/);
  assert.match(html, /role="region" aria-labelledby="comparison-caption"/);
  assert.match(html, /<th scope="col">Hipoteca 2<\/th>/);
  assert.match(html, /<th scope="row">Cuota mensual<\/th>/);
  assert.match(html, /aria-label="Compartir Hipoteca 1"/);
  assert.match(html, /aria-label="Compartir Hipoteca 2" aria-busy="true" aria-disabled="true"/);
  assert.match(html, /aria-label="Eliminar Hipoteca 2"/);
  assert.match(html, /Desliza horizontalmente para comparar/);
  // Identical scenarios keep all metric rows, with no recommendation labels.
  assert.equal((html.match(/scope="row"/g) ?? []).length, 12);
});
