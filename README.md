# opencode-go-usage-cli

A small CLI that shows your **OpenCode Go** plan usage — rolling (5-hour), weekly and monthly — for **all** your OpenCode Console accounts at once, with percentages and reset countdowns, plus a `--json` mode for scripts/statuslines.

**Main benefit:** the OpenCode Console only shows the usage of one account at a time. If you have more than one Go plan (e.g. two accounts you alternate between), `go-usage` shows them side by side — no more logging in/out to check each one.

> **Unofficial.** Not affiliated with or endorsed by OpenCode. It talks to the same private endpoints the web Console uses and reads the local opencode database, so it may break if those change.

## Requirements

- [Bun](https://bun.sh) (uses `bun:sqlite` and `fetch`, no dependencies)
- OpenCode installed and logged into the Console: `opencode console login` (once per account)

## Install

```sh
git clone https://github.com/aquelejota/opencode-go-usage-cli.git
cd opencode-go-usage-cli
chmod +x bin/go-usage
ln -sf "$PWD/bin/go-usage" ~/.local/bin/go-usage   # ensure ~/.local/bin is on PATH
```

## Setup accounts

`go-usage` uses your OpenCode **Console** session (not the Go inference API key). Log in once per account you want to monitor:

```sh
opencode console login   # repeat for each Go account
```

## Usage

```sh
go-usage                 # readable table (colored on a TTY)
go-usage --json          # machine-readable output
go-usage --no-color      # force no color (pipes/statusline)
go-usage --account a@b   # filter by email (repeatable)
go-usage --db <path>     # use a different opencode.db
go-usage --timeout 8000  # per-request timeout in ms
```

Example:

```
dev@example.com — Example Org · go
  Rolling usage  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   2% used   Resets in 4h 43m
  Weekly usage   [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   4% used   Resets in 6d 7h
  Monthly usage  [███████████████░░░░░░░░░░░░░]  52% used   Resets in 25d 4h

second@example.com — Personal · go ●
  Rolling usage  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0% used   Resets in 2h 4m
  Weekly usage   [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   1% used   Resets in 6d 6h
  Monthly usage  [███████░░░░░░░░░░░░░░░░░░░░░]  25% used   Resets in 17d 15h
```

The `●` marks the active account/org. Colors: green < 50%, yellow 50–80%, red ≥ 80%.

### JSON

```json
[
  {
    "email": "dev@example.com",
    "accountId": "user_...",
    "active": true,
    "orgId": "org_...",
    "orgName": "Example Org",
    "product": "go",
    "endsAt": "2026-10-30T21:20:16.000Z",
    "fiveHour": { "used": 19547279, "limit": 1200000000, "percent": 1.63, "resetsAt": "..." },
    "week":     { "used": 130441902, "limit": 3000000000, "percent": 4.35, "resetsAt": "..." },
    "month":    { "used": 3130441902, "limit": 6000000000, "percent": 52.17, "resetsAt": "..." }
  }
]
```

`used`/`limit` are in microcents (1,000,000,000 µ¢ = US$ 10).

## How it works

1. Opens `~/.local/share/opencode/opencode.db` **read-only** (or `$XDG_DATA_HOME/opencode/opencode.db`, or `--db`/`GO_USAGE_DB`).
2. Reads accounts (`account`: email, url, access_token) and the active org (`account_state`).
3. `GET {url}/api/orgs` (Bearer) → the account's orgs.
4. `GET {url}/api/go/status` with `x-org-id` → `access.meters.{fiveHour,week,month}`. Orgs without a Go subscription return `null` and are skipped.
5. Renders a table or JSON.

A browser-like `User-Agent` is sent because Cloudflare blocks library user agents (error 1010).

## Limitations

- **No token refresh.** Console refresh tokens are rotating with reuse detection; refreshing without persisting the new token could invalidate the opencode login. On `401`, re-run `opencode console login`.
- Depends on the internal `account`/`account_state` schema, which may change between opencode versions. The database is only read.

## Tests

```sh
bun test
```

Covers parsing/percentage/countdown/rendering plus an offline integration flow (local fixture server + temporary DB).

## License

MIT — see [LICENSE](LICENSE).

---

# opencode-go-usage-cli (Português)

Uma CLI simples que mostra o uso do seu plano **OpenCode Go** — rolling (5 horas), semanal e mensal — para **todas** as suas contas do Console do OpenCode de uma vez, com percentuais e contagem regressiva para o reset, além de um modo `--json` para scripts/statusline.

**Principal benefício:** o Console do OpenCode só mostra o uso de uma conta por vez. Se você tem mais de um plano Go (por exemplo, duas contas que alterna), o `go-usage` mostra as duas lado a lado — sem precisar ficar deslogando e logando para conferir cada uma.

> **Não oficial.** Sem vínculo ou endosso do OpenCode. A ferramenta conversa com os mesmos endpoints privados que o Console web usa e lê o banco local do opencode, então pode quebrar se isso mudar.

## Requisitos

- [Bun](https://bun.sh) (usa `bun:sqlite` e `fetch`, sem dependências)
- OpenCode instalado e logado no Console: `opencode console login` (uma vez por conta)

## Instalação

```sh
git clone https://github.com/aquelejota/opencode-go-usage-cli.git
cd opencode-go-usage-cli
chmod +x bin/go-usage
ln -sf "$PWD/bin/go-usage" ~/.local/bin/go-usage   # garanta que ~/.local/bin está no PATH
```

## Configurar as contas

O `go-usage` usa a sua sessão do **Console** do OpenCode (não a API key de inferência do Go). Faça login uma vez em cada conta que quer monitorar:

```sh
opencode console login   # repita para cada conta Go
```

## Uso

```sh
go-usage                 # tabela legível (colorida em TTY)
go-usage --json          # saída para máquinas
go-usage --no-color      # força sem cor (pipes/statusline)
go-usage --account a@b   # filtra por e-mail (pode repetir)
go-usage --db <path>     # usa outro opencode.db
go-usage --timeout 8000  # timeout por requisição em ms
```

Exemplo:

```
dev@example.com — Example Org · go
  Rolling usage  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   2% used   Resets in 4h 43m
  Weekly usage   [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   4% used   Resets in 6d 7h
  Monthly usage  [███████████████░░░░░░░░░░░░░]  52% used   Resets in 25d 4h

second@example.com — Personal · go ●
  Rolling usage  [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   0% used   Resets in 2h 4m
  Weekly usage   [█░░░░░░░░░░░░░░░░░░░░░░░░░░░]   1% used   Resets in 6d 6h
  Monthly usage  [███████░░░░░░░░░░░░░░░░░░░░░]  25% used   Resets in 17d 15h
```

O `●` marca a conta/org ativa. Cores: verde < 50%, amarela 50–80%, vermelha ≥ 80%.

### JSON

```json
[
  {
    "email": "dev@example.com",
    "accountId": "user_...",
    "active": true,
    "orgId": "org_...",
    "orgName": "Example Org",
    "product": "go",
    "endsAt": "2026-10-30T21:20:16.000Z",
    "fiveHour": { "used": 19547279, "limit": 1200000000, "percent": 1.63, "resetsAt": "..." },
    "week":     { "used": 130441902, "limit": 3000000000, "percent": 4.35, "resetsAt": "..." },
    "month":    { "used": 3130441902, "limit": 6000000000, "percent": 52.17, "resetsAt": "..." }
  }
]
```

`used`/`limit` estão em microcents (1.000.000.000 µ¢ = US$ 10).

## Como funciona

1. Abre `~/.local/share/opencode/opencode.db` **somente leitura** (ou `$XDG_DATA_HOME/opencode/opencode.db`, ou `--db`/`GO_USAGE_DB`).
2. Lê as contas (`account`: email, url, access_token) e a org ativa (`account_state`).
3. `GET {url}/api/orgs` (Bearer) → orgs da conta.
4. `GET {url}/api/go/status` com `x-org-id` → `access.meters.{fiveHour,week,month}`. Orgs sem assinatura Go retornam `null` e são ignoradas.
5. Renderiza a tabela ou o JSON.

Um `User-Agent` de navegador é enviado porque a Cloudflare bloqueia user agents de libs (erro 1010).

## Limitações

- **Não faz refresh do token.** Os refresh tokens do Console são rotativos com detecção de reuso; refazer o refresh sem persistir o novo token poderia invalidar o login do opencode. Em `401`, rode `opencode console login` de novo.
- Depende do schema interno `account`/`account_state`, que pode mudar entre versões do opencode. O banco é apenas lido.

## Testes

```sh
bun test
```

Cobre parsing/percentual/contagem regressiva/renderização, além de um fluxo de integração offline (servidor local com fixtures + banco temporário).

## Licença

MIT — veja [LICENSE](LICENSE).
