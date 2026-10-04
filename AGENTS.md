# Instrucciones para Codex

## Política de entrega

Cuando una tarea modifique código:

1. Codex trabaja partiendo de la rama seleccionada al crear la tarea.
2. Nunca modifica directamente `main` ni `rebuild-v2`.
3. Antes de entregar, ejecuta:
   - `npm test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
4. Si alguna comprobación falla, debe corregirla antes de entregar.
5. Codex prepara una única Pull Request mediante el mecanismo nativo de GitHub/Codex.
6. La base de la Pull Request debe ser exactamente la rama desde la que comenzó la tarea:
   - desde `rebuild-v2`, hacia `rebuild-v2`;
   - desde `main`, hacia `main`.
7. No crea una segunda Pull Request para correcciones de la misma tarea.
8. GitHub Actions se encarga de la validación final, Ready for review, squash merge y eliminación de la rama.
9. Nunca hace force-push.
