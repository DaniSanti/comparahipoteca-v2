# Instrucciones para Codex

## Política de entrega

Para cada tarea que modifique el repositorio:

1. Codex parte siempre de `main`.
2. Nunca modifica `main` directamente.
3. Trabaja en una rama `codex/*`.
4. Antes de entregar, ejecuta:
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - `git diff --check`
5. Si alguna comprobación falla, debe corregirla antes de entregar.
6. Codex prepara una única Draft Pull Request hacia `main` mediante el mecanismo nativo de Codex/GitHub.
7. No crea una segunda Pull Request para correcciones de la misma tarea.
8. GitHub Actions se encarga de la validación final, del paso de Draft a Ready, de activar GitHub Auto-merge con squash y de la eliminación de la rama tras el merge. Codex nunca fusiona la PR manualmente.
9. Nunca hace force-push.
