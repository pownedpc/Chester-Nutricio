# Proxy IA · Chester-Nutricio

Worker de Cloudflare que amaga la API key d'Anthropic perquè `index.html`
(estàtic, públic a GitHub Pages) mai la necessiti.

## Desplegament (5 minuts)

```bash
cd worker
npm install -g wrangler      # si no el tens
wrangler login
```

1. Revoca la key vella exposada al repo a
   https://console.anthropic.com/settings/keys i genera'n una de nova.
2. Edita `wrangler.toml` si el teu GitHub Pages no és
   `https://pownedpc.github.io` (canvia `ALLOWED_ORIGIN`).
3. Puja els secrets (no es guarden mai al repo):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   # (opcional però recomanat) una frase qualsevol com a fricció extra:
   wrangler secret put APP_SHARED_SECRET
   ```
4. Desplega:
   ```bash
   wrangler deploy
   ```
   Et donarà una URL tipus `https://chester-nutricio-proxy.<el-teu-subdomini>.workers.dev`.
5. Obre `index.html` → pestanya **IA** → "Configuració connexió IA" →
   enganxa aquesta URL (i la `APP_SHARED_SECRET` si l'has posat) → Desar.
   Es guarda només al `localStorage` del teu navegador, mai al repo.

## Protecció extra (recomanat, gratuït)

Al dashboard de Cloudflare → el teu Worker → Triggers/Rate limiting,
afegeix una regla senzilla (p. ex. 20 peticions/minut per IP) sobre la
ruta del Worker. Això talla l'abús encara que algú trobi la URL i es
salti la clau d'aplicació.

## Per què no la key directa al navegador

Qualsevol string que visqui en JS servit al navegador és públic —
`view-source` el mostra igual que si estigués al repo. L'única manera
de mantenir una API key privada és que visqui en un servidor (aquest
Worker) i que el navegador només parli amb el Worker.
