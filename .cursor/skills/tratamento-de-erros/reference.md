# Tratamento de Erros em Programação Avançada
### Guia de padrão sênior — Clean Code, Error Handling & Contrato JSON

> Este documento reflete o que costuma ser cobrado em code review por um tech lead/staff engineer em empresas que levam confiabilidade a sério (fintechs, telcos, big techs). Não é teoria de curso — é o que separa código júnior de código pronto para produção.

---

## 1. Filosofia: por que erro não é "exceção do dia ruim"

Erro não é algo que "às vezes acontece". Erro é **parte do contrato da função**, tão importante quanto o caminho feliz. Um sênior trata erro como:

- **Informação**, não ruído — todo erro deve dizer *o quê*, *onde* e *por quê*.
- **Previsível**, não surpresa — se uma função pode falhar, isso deve estar no tipo/assinatura, não escondido.
- **Acionável** — quem recebe o erro (outro dev, um sistema, um usuário) precisa saber o que fazer a seguir.

Regra de ouro: **"Fail fast, fail loud, fail informative."** Esconder erro (silenciar, engolir, logar e seguir como se nada tivesse acontecido) é o pecado capital.

---

## 2. Clean Code aplicado a erros

### 2.1 Nomenclatura é documentação
```typescript
// ❌ Genérico, não diz nada
throw new Error("erro");

// ✅ Específico, autoexplicativo
throw new UserNotFoundError(userId);
```

### 2.2 Fail fast — valide na borda, confie no núcleo
Validação pertence à entrada do sistema (controller, DTO, schema). O núcleo da lógica de negócio **não deve** ficar cheio de `if (x == null)` espalhados — isso é sintoma de que a borda não fez o trabalho dela.

```typescript
// ✅ Zod valida na borda, o service já recebe dado confiável
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

function createUser(input: z.infer<typeof schema>) {
  // aqui dentro, input já é garantidamente válido
}
```

### 2.3 Funções pequenas, uma responsabilidade → um tipo de falha
Se uma função tem 5 formas diferentes de falhar, ela provavelmente está fazendo trabalho demais. Quebre.

### 2.4 Evite "código defensivo" em excesso
Defensive programming exagerado (checar null em todo lugar "por garantia") é cheiro de código, não robustez. Prefira:
- Tipagem forte (TypeScript strict mode)
- Validação **uma vez**, na borda
- Tipos que tornam estado inválido **impossível de representar**

```typescript
// ❌ Estado inválido é representável
type Response = {
  data?: User;
  error?: string;
};

// ✅ Só um dos dois pode existir — impossível representar os dois juntos
type Response =
  | { success: true; data: User }
  | { success: false; error: AppError };
```

### 2.5 Comentário não substitui erro bem nomeado
```typescript
// ❌
throw new Error("falhou"); // erro de autenticação

// ✅ — não precisa de comentário, o nome já explica
throw new InvalidCredentialsError();
```

---

## 3. Hierarquia de erros customizados

Nunca jogue `Error` genérico em produção. Crie uma hierarquia que espelha os domínios de falha da sua aplicação.

```typescript
// errors/base.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;       // código estável, usado por clientes/logs
  readonly isOperational = true;        // erro esperado vs bug real (ver seção 4.4)

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
  constructor(resource: string, id: string | number) {
    super(`${resource} com id ${id} não encontrado`);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMIT_EXCEEDED";
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";
  readonly isOperational = false; // bug real, não erro de negócio
}
```

**Por que isso importa em code review:** com essa hierarquia, o middleware de erro precisa de **uma única regra** para decidir status HTTP, log level e o que expor ao cliente — em vez de `if/else` gigante espalhado pelo código.

---

## 4. Padrões de tratamento

### 4.1 Try/catch cirúrgico, não genérico
```typescript
// ❌ Catch genérico esconde o problema real
try {
  await doEverything();
} catch (e) {
  console.log(e);
}

// ✅ Trata o que sabe tratar, propaga o resto
async function getUser(id: string) {
  try {
    return await db.user.findUniqueOrThrow({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("User", id);
    }
    throw e; // erro desconhecido: não finge que sabe tratar, deixa subir
  }
}
```

### 4.2 Nunca catch vazio
```typescript
// ❌ Isso é um crime em qualquer review sênior
try {
  await sendEmail();
} catch {}

// ✅ Se realmente pode ignorar, documente o porquê
try {
  await sendEmail();
} catch (e) {
  logger.warn({ err: e }, "falha ao enviar email de boas-vindas — não bloqueia o cadastro");
}
```

### 4.3 Result/Either — alternativa funcional ao throw
Em fluxos onde erro é **esperado e frequente** (parsing, validação, chamadas externas), `throw` é caro e força try/catch em todo lugar. Result pattern deixa o erro explícito no tipo de retorno.

```typescript
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function parsePayload(raw: unknown): Promise<Result<Order>> {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: new ValidationError("payload inválido", flattenZod(parsed.error)) };
  }
  return { ok: true, value: parsed.data };
}

// Uso: o compilador te obriga a tratar os dois casos
const result = await parsePayload(body);
if (!result.ok) {
  return sendError(res, result.error);
}
processOrder(result.value);
```

Use `throw` para erros excepcionais (algo quebrou de verdade). Use `Result` para erros esperados como parte do fluxo de negócio. Misturar os dois estilos sem critério é o erro mais comum em código intermediário.

### 4.4 Erros operacionais vs. bugs (distinção que todo sênior faz)
- **Operacional**: usuário mandou dado errado, recurso não existe, rate limit estourou. Esperado, tratável, não derruba o processo.
- **Programador (bug)**: null reference, promise não tratada, tipo errado em runtime. Isso é sinal de que algo no código está errado e **deveria** derrubar o processo em vez de continuar em estado inconsistente (fail fast de verdade).

```typescript
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception — encerrando processo");
  process.exit(1); // não tenta "continuar" com estado corrompido
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled rejection — encerrando processo");
  process.exit(1);
});
```

### 4.5 Middleware global de erro (Express/Next.js API routes)
Centraliza a tradução "erro interno → resposta HTTP". Nenhum controller deveria formatar erro manualmente.

```typescript
// middleware/errorHandler.ts
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] ?? crypto.randomUUID();

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId }, "erro não operacional");
    } else {
      logger.warn({ err, requestId }, "erro operacional");
    }

    return res.status(err.statusCode).json(toApiError(err, requestId));
  }

  // erro totalmente desconhecido — nunca vaza detalhe interno
  logger.error({ err, requestId }, "erro não tratado");
  return res.status(500).json(toApiError(new InternalError("erro interno"), requestId));
}
```

### 4.6 Async/await — não esqueça de propagar
```typescript
// ❌ Promise rejeitada nunca é capturada pelo Express (sem wrapper)
app.get("/users/:id", async (req, res) => {
  const user = await getUser(req.params.id); // se rejeitar, request trava
  res.json(user);
});

// ✅ wrapper que encaminha rejeição pro next()
const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
}));
```
(Next.js App Router e frameworks mais novos resolvem isso nativamente, mas o princípio — nunca deixar uma rejeição órfã — vale sempre.)

---

## 5. JSON — o contrato de erro de uma API

Erro mal formatado em JSON é a diferença entre o time de frontend te odiar ou confiar no seu backend. O padrão de mercado (usado por Stripe, GitHub, Google) segue o espírito da **RFC 7807 (Problem Details for HTTP APIs)**.

### 5.1 Estrutura padronizada
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Um ou mais campos são inválidos.",
    "requestId": "8f14e2f1-9c3a-4a2b-8e21-6c1d4a2f9b77",
    "timestamp": "2026-08-04T14:22:01.000Z",
    "details": [
      { "field": "email", "issue": "formato inválido" },
      { "field": "age", "issue": "deve ser maior que 0" }
    ]
  }
}
```

**Por que cada campo existe:**
| Campo | Função |
|---|---|
| `code` | Identificador **estável** que o cliente pode usar em `if/switch` (nunca muda entre versões — diferente de `message`) |
| `message` | Texto legível para humano/log, pode mudar sem quebrar integração |
| `requestId` | Correlaciona o erro reportado pelo usuário com o log do servidor (essencial em suporte/incidentes) |
| `timestamp` | Auditoria e debugging de janela temporal |
| `details` | Granularidade extra (ex: campo por campo em validação) — **opcional**, omitido quando não se aplica |

### 5.2 Nunca vazar detalhes internos (isso é segurança, não só clean code)
```json
// ❌ Vaza stack trace, versão de lib, caminho de arquivo — informação de ouro para atacante
{
  "error": "TypeError: Cannot read property 'id' of undefined at /app/src/services/user.ts:42:10"
}

// ✅ Cliente recebe o necessário, servidor loga o resto internamente
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Ocorreu um erro inesperado. Tente novamente.",
    "requestId": "8f14e2f1-9c3a-4a2b-8e21-6c1d4a2f9b77"
  }
}
```
Isso vale para: stack trace, nome de tabela/coluna do banco, versão de framework, path do servidor, query SQL, e principalmente **mensagens de erro de autenticação que diferenciam "usuário não existe" de "senha errada"** — isso é enumeração de usuário, uma vulnerabilidade real (você já trabalha com OWASP, então isso deve soar familiar: `A01/A07` do Top 10).

```typescript
// ❌ Permite enumerar quais emails existem na base
if (!user) throw new Error("Usuário não encontrado");
if (!validPassword) throw new Error("Senha incorreta");

// ✅ Mesma mensagem para os dois casos
if (!user || !validPassword) throw new UnauthorizedError("Credenciais inválidas");
```

### 5.3 Códigos HTTP corretos (não jogue tudo como 200 ou 500)
| Status | Uso |
|---|---|
| `400` | Payload/sintaxe inválida |
| `401` | Não autenticado |
| `403` | Autenticado, mas sem permissão |
| `404` | Recurso não existe |
| `409` | Conflito (ex: recurso já existe, estado inconsistente) |
| `422` | Sintaticamente válido, mas semanticamente inválido (ex: regra de negócio) |
| `429` | Rate limit |
| `500` | Erro interno não esperado |
| `503` | Serviço temporariamente indisponível (ex: dependência externa fora) |

### 5.4 Função central de tradução Error → JSON
```typescript
function toApiError(err: AppError, requestId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      requestId,
      timestamp: new Date().toISOString(),
      ...(err instanceof ValidationError && err.fields
        ? { details: err.fields }
        : {}),
    },
  };
}
```

---

## 6. Logging estruturado (não use `console.log`)

```typescript
// ✅ Log estruturado com pino, correlacionável e pesquisável
logger.error({
  err,
  requestId,
  userId: req.user?.id,
  route: req.path,
}, "falha ao processar pedido");
```

Princípios:
- **Nunca logue segredo** (senha, token, chave de API) — nem por engano em objetos inteiros (`logger.info({ user })` pode vazar hash de senha se o objeto não for filtrado).
- **Correlation ID / Request ID** em todo log de uma mesma requisição, para reconstruir a timeline de um incidente.
- **Log level correto**: `debug` (dev), `info` (evento normal), `warn` (operacional, esperado), `error` (bug real), `fatal` (processo vai cair).
- Em produção, prefira ferramentas como **Pino + Sentry/Datadog** a `console.log` — você precisa de busca, alerta e agregação, não de texto solto em stdout.

---

## 7. Segurança no tratamento de erros

Como você já estuda pentest/OWASP, vale reforçar o ponto onde error handling e segurança se cruzam:

- **Information disclosure (A05)**: stack trace, versão de dependência, ou query SQL em resposta de erro dá reconhecimento de graça para um atacante.
- **Timing attacks**: se `login` demora diferente para "usuário não existe" vs "senha errada", isso vaza informação por tempo de resposta — vale até comparar com `crypto.timingSafeEqual` em validações sensíveis.
- **Erros de terceiros**: nunca repasse o erro cru de uma lib/API externa direto pro cliente — sempre normalize.
- **Rate limit em rotas de erro previsível**: brute force em login se aproveita de mensagens de erro consistentes e sem limitação de tentativas.

---

## 8. Testando caminhos de erro

Um sênior testa o **caminho triste** com o mesmo rigor do caminho feliz.

```typescript
describe("createUser", () => {
  it("lança ValidationError para email inválido", async () => {
    await expect(createUser({ email: "invalido", age: 20 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("lança ConflictError se email já existe", async () => {
    await createUser({ email: "a@a.com", age: 20 });
    await expect(createUser({ email: "a@a.com", age: 20 }))
      .rejects.toBeInstanceOf(ConflictError);
  });

  it("não vaza mensagem de erro interna do banco", async () => {
    jest.spyOn(db.user, "create").mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));
    await expect(createUser(validInput)).rejects.toThrow(InternalError);
  });
});
```

---

## 9. Anti-padrões comuns (red flags em code review)

| Anti-padrão | Por que é problema |
|---|---|
| `catch (e) {}` | Engole erro, debug vira arqueologia |
| `throw "string"` | Perde stack trace e tipo, use sempre `throw new Error(...)` ou subclasse |
| `catch` que só faz `console.log` e segue | Mesmo efeito de engolir o erro |
| Try/catch cobrindo 50 linhas | Não dá pra saber qual linha falhou nem tratar de forma específica |
| Retornar `null`/`undefined` silenciosamente em erro | Empurra o problema pro chamador sem contexto |
| Reutilizar `Error` genérico em todo lugar | Impossível diferenciar tipos de falha via `instanceof` |
| Expor stack trace em produção | Vazamento de informação, superfície de ataque |
| Mensagens diferentes para "user not found" vs "wrong password" | Enumeração de usuários |
| Misturar `throw` e `Result` sem critério no mesmo módulo | Inconsistência força quem consome a "adivinhar" o contrato |

---

## 10. Checklist de code review sênior

- [ ] Toda função que pode falhar tem isso explícito no tipo (`Result`) ou documentado?
- [ ] Existe hierarquia de erros customizados, ou é tudo `Error` genérico?
- [ ] Nenhum `catch` vazio ou apenas com `console.log`?
- [ ] Resposta de erro da API segue um formato JSON único e documentado?
- [ ] Stack trace, query SQL, path de arquivo — nada disso vaza pro cliente em produção?
- [ ] Status HTTP condiz com o tipo de erro (não é tudo 200 ou tudo 500)?
- [ ] Logs de erro são estruturados e têm `requestId` para correlação?
- [ ] Erros operacionais (esperados) estão separados de bugs (não operacionais)?
- [ ] Existe teste cobrindo o caminho de erro, não só o caminho feliz?
- [ ] Mensagens de erro de auth não permitem enumeração de usuário?

---

### Resumo em uma frase
> Erro bem tratado não é código que "não quebra" — é código que, quando quebra, te diz exatamente onde, por quê, e não expõe nada que um atacante ou um bug futuro possa explorar.
