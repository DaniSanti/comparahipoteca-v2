# Actualizaciones de dependencias

Dependabot revisa npm en `/` semanalmente y agrupa las actualizaciones de
versión patch/minor en una PR `non-major`, con un límite de cinco PRs de versión
abiertas. La allowlist `allow.update-types` permite únicamente
`version-update:semver-patch` y `version-update:semver-minor`, excluyendo majors
de las actualizaciones de versión normales.
El filtro semver no impide actualizaciones de seguridad, incluso si requieren
un major. El grupo se aplica solo a `version-updates`; las actualizaciones de
seguridad pueden abrir PRs independientes y no cuentan para ese límite.

El workflow `dependabot-auto-merge.yml` comprueba que el autor real sea
`dependabot[bot]`, que la base sea `main` y que la rama pertenezca al mismo
repositorio sin ser un fork. Una rama de usuario llamada `dependabot/...` no
cumple esa comprobación. `dependabot/fetch-metadata@v3` mantiene activas sus
verificaciones de autor y commits firmados, y obtiene el tipo de actualización
oficial (el mayor cambio semver en PRs agrupadas), sin interpretar el título.
Solo npm patch/minor en `/` puede activar auto-merge; majors y tipos desconocidos
quedan fuera. Las actualizaciones de seguridad major requieren revisión manual.

El workflow usa `pull_request_target` exclusivamente para metadata y GitHub CLI,
con permisos `contents: write` y `pull-requests: write` solo en ese job. No hace
checkout, no instala dependencias y no ejecuta código de la PR. La orden
`gh pr merge --auto --squash` incluye `--match-head-commit` para evitar actuar
sobre un commit distinto del evento validado. GitHub espera al check obligatorio
`CI` del ruleset de `main`; si falla, la PR permanece abierta. CI sigue ejecutando
tests, typecheck, lint y build por separado, con permisos de lectura, sin exigir
un check específico de Vercel. GitHub elimina la rama tras el merge mediante la
configuración existente del repositorio.

Referencia: [opciones oficiales de Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#update-types-allow).
