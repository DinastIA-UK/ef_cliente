# API de Scraping Prisma Box

Esta API permite executar o scraping do Prisma Box de forma assíncrona, fornecendo uma resposta imediata e notificando o resultado via callback.

## 🚀 Como Usar

### 1. Iniciar Scraping

**Endpoint:** `POST /api/scraping/start`

Parâmetros de query opcionais:
- `mode`: força o modo de execução
  - `worker` → usa `worker_threads` (recomendado para produção)
  - `direct` → executa diretamente no processo (útil em desenvolvimento)

Comportamento padrão:
- Em desenvolvimento/localhost ou com `SCRAPING_DIRECT_EXECUTION=true` → execução direta.
- Em produção (Vercel) → execução via worker.

**Body:**
```json
{
  "callbackUrl": "https://seu-servidor.com/webhook/scraping-result"
}
```

**Resposta Imediata (200 OK):**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Scraping iniciado com sucesso",
  "status": "pending",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Exemplos:
- Iniciar com worker: `POST /api/scraping/start?mode=worker`
- Iniciar direto: `POST /api/scraping/start?mode=direct`

### 2. Verificar Status

**Endpoint:** `GET /api/scraping/status/:jobId`

**Resposta:**
```json
{
  "success": true,
  "job": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "progress": "Processando unidade 5 de 20...",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    "logs": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "message": "Scraping iniciado",
        "level": "info"
      }
    ]
  }
}
```

### 3. Callback de Resultado

Quando o scraping terminar, a API enviará um POST para a `callbackUrl` fornecida:

**Callback de Sucesso:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "timestamp": "2024-01-15T10:45:00.000Z",
  "data": {
    "summary": "Scraping concluído com sucesso",
    "totalBoxes": 1250,
    "unitsProcessed": 20,
    "successfulUnits": 18,
    "failedUnits": ["UNIT001", "UNIT002"],
    "processingTime": 900,
    "logs": [...]
  }
}
```

**Callback de Erro:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "error",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "error": {
    "message": "Erro de autenticação no Prisma Box",
    "type": "AuthenticationError",
    "logs": [...]
  }
}
```

## 📋 Outros Endpoints

### Listar Jobs
`GET /api/scraping/jobs` - Lista todos os jobs

### Cancelar Job
`DELETE /api/scraping/job/:jobId` - Cancela um job em execução

### Workers Ativos
`GET /api/scraping/active` - Lista workers ativos

Exemplo de resposta:
```json
{
  "success": true,
  "activeWorkers": ["550e8400-e29b-41d4-a716-446655440000"],
  "count": 1
}
```

### Health Check
`GET /health` - Verifica se a API está funcionando

## 🔧 Configuração

1. Copie `.env.example` para `.env`
2. Configure as variáveis de ambiente:
   - `PRISMA_USERNAME` e `PRISMA_PASSWORD`
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` (uso de serviço)
   - `SCRAPING_DIRECT_EXECUTION` (opcional; `true` força execução direta)
   - `PORT` (opcional, padrão: 3000)

## 🚀 Executar

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm start
```

## 📝 Status dos Jobs

- `pending`: Job criado, aguardando início
- `running`: Scraping em execução
- `completed`: Scraping concluído com sucesso
- `failed`: Scraping falhou

Notas:
- Em execução direta (dev), o `progress` inicia com "Execução direta iniciada...".
- Em execução via worker (prod), o `progress` inicia com "Worker iniciado, carregando script de scraping...".

## 🔄 Sistema de Retry

O sistema de callback possui retry automático:
- Máximo de 3 tentativas
- Intervalo de 5 segundos entre tentativas
- Timeout de 30 segundos por tentativa

## 🛡️ Validações

- URL do callback deve ser HTTP/HTTPS válida
- URLs localhost não são permitidas em produção
- Jobs têm timeout de 2 horas
- Limpeza automática de jobs antigos

Deploy (Vercel):
- Funções possuem `maxDuration` (atual: 900 segundos) definido em `vercel.json`.

## 📊 Monitoramento

A API gera logs detalhados para monitoramento:
- Início e fim de jobs
- Progresso do scraping
- Erros e tentativas de callback
- Performance e timing

Diferenças de ambiente:
- Local: rotas montadas em `/api/scraping/*` via `api-server.js`.
- Vercel: função `api/scraping` monta as rotas no root (`'/'`), acessíveis como `/api/scraping/*`.
