// VATCO (nov-2026): quienes no autorizaron no aparecían en el informe.
const { buildCoverageText, buildDefaultOrgTexts } = require('../utils/report-templates');

describe('buildCoverageText', () => {
  test('caso VATCO: convocados, evaluados, no autorizaron y sin completar', () => {
    expect(buildCoverageText({ convocados: 543, evaluados: 437, noAutorizaron: 4 })).toBe(
      'Cobertura de la medición: de las 543 personas convocadas, 437 conforman la población evaluada y analizada en este informe; 4 personas no autorizaron su participación en el consentimiento informado y, por lo tanto, no fueron evaluadas, y 102 personas no completaron la batería. Los resultados corresponden únicamente a la población evaluada.');
  });
  test('singular', () => {
    const t = buildCoverageText({ convocados: 10, evaluados: 9, noAutorizaron: 1 });
    expect(t).toContain('1 persona no autorizó su participación');
    expect(t).toContain('no fue evaluada');
    expect(t).not.toContain('no completaron');
  });
  test('todos evaluados: no hay nada que aclarar', () => {
    expect(buildCoverageText({ convocados: 80, evaluados: 80, noAutorizaron: 0 })).toBeNull();
  });
  test('sin rechazos pero con pendientes', () => {
    expect(buildCoverageText({ convocados: 39, evaluados: 23, noAutorizaron: 0 }))
      .toContain('16 personas no completaron la batería');
  });
});

test('el procedimiento ya no afirma que todos autorizaron', () => {
  const p = buildDefaultOrgTexts({ companyName: 'X' }).procedimiento[0];
  expect(p).toContain('solo se evaluó a quienes la autorizaron');
  expect(p).not.toContain('donde los colaboradores autorizaron su participación');
});
