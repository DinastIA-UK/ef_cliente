# Prisma EF - Automação de Propostas e Contratos

Sistema de automação para gestão de propostas e contratos no Prisma Box, com API REST, scraping de dados e integração com Supabase.

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- Playwright (instalado via npm)
- Supabase (opcional, para persistência de dados)
- Credenciais do Prisma Box

## 🚀 Instalação

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PRISMA_USERNAME=seu-usuario@example.com
PRISMA_PASSWORD=sua-senha
SUPABASE_URL=sua-url-supabase
SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_KEY=sua-service-key
PORT=3000
```

## 📁 Estrutura do Projeto

```
prisma_EF/
├── api/                          # Endpoints da API
│   ├── health.js                 # Health check
│   └── scraping.js               # Scraping de dados
├── config/                       # Arquivos de configuração
│   ├── bases.json               # Dados de bases
│   ├── corrected-units-mapped.json
│   └── final-units-config.json
├── data/                        # Dados persistentes
│   └── jobs.json               # Histórico de jobs
├── routes/                      # Rotas da API
│   └── scraping.js             # Rotas de scraping
├── server/                      # Configuração do servidor
│   └── app.js                  # App Express
├── utils/                       # Utilitários
│   ├── callback.js             # Callbacks
│   └── job-tracker.js          # Rastreamento de jobs
├── workers/                     # Workers em background
│   └── scraping-worker.js      # Worker de scraping
├── api-server.js               # Servidor principal
├── prisma-to-supabase.js       # Automação de propostas/contratos
├── supabase-client.js          # Cliente Supabase
├── package.json
└── README.md
```

## 🎯 Como Usar

### Iniciar o Servidor API

```bash
npm start
```

O servidor estará disponível em `http://localhost:3000`

### Endpoints da API

#### Health Check
```http
GET /api/health
```

#### Automação de Propostas e Contratos
```http
POST /api/scraping/proposal
Content-Type: application/json

{
  "clienteNome": "João Silva",
  "clienteTelCel": "11999999999",
  "previsaoEntrada": "2026-04-15",
  "motivoLocacaoId": "1",
  "vendedorId": "1",
  "boxes": [
    {
      "nome": "Box 01",
      "tipo": "MENSAL"
    }
  ],
  "dadosCliente": {
    "cpf": "12345678902",
    "sexo": "M",
    "cep": "01311-100",
    "numero_endereco": "123",
    "pagamento": "PIX",
    "valorBens": "5000.00"
  }
}
```

## 🔧 Principais Funções

### prisma-to-supabase.js

- **performLogin(page)** - Fazer login no Prisma Box
- **preencherDadosCliente(page, nome, telefone)** - Preencher dados do cliente
- **adicionarItemsBoxes(page, boxes, dadosCliente)** - Adicionar items de boxes
- **preencherDadosClienteContrato(page, cpf, sexo, cep, numero)** - Preencher dados do cliente no contrato
- **preencherValorBensEProxima(page, valorBens)** - Preencher valor dos bens
- **selecionarPagamentoEProxima(page, pagamento)** - Selecionar forma de pagamento

### supabase-client.js

- Integração com banco de dados Supabase
- Persistência de propostas e contratos
- Queries e updates de dados

## 📊 Fluxo de Automação

1. ✅ Login no Prisma Box
2. ✅ Criação de nova proposta
3. ✅ Preenchimento de dados do cliente
4. ✅ Adição de items (boxes)
5. ✅ Preenchimento de feedback
6. ✅ Salva proposta
7. ✅ Navegação para criação de contrato
8. ✅ Seleção da proposta criada
9. ✅ Preenchimento de dados do cliente no contrato
10. ✅ Seleção de forma de pagamento
11. ✅ Preenchimento de valor dos bens (com índice IPCA TRIMESTRAL)
12. ✅ Salva contrato

## 🏗️ Tecnologias Utilizadas

- **Playwright** - Automação de navegador
- **Express.js** - Framework web
- **Supabase** - Banco de dados
- **Node.js** - Runtime JavaScript

## 📝 Exemplos de Uso

### Automatizar Criação de Proposta via cURL

```bash
curl -X POST http://localhost:3000/api/scraping/proposal \
  -H "Content-Type: application/json" \
  -d '{
    "clienteNome": "João Silva",
    "clienteTelCel": "11999999999",
    "previsaoEntrada": "2026-04-15",
    "motivoLocacaoId": "1",
    "vendedorId": "1",
    "boxes": [{"nome": "Box 01", "tipo": "MENSAL"}],
    "dadosCliente": {
      "cpf": "12345678902",
      "sexo": "M",
      "cep": "01311-100",
      "numero_endereco": "123",
      "pagamento": "PIX",
      "valorBens": "5000.00"
    }
  }'
```

## 🔐 Segurança

- Credenciais armazenadas em variáveis de ambiente (`.env`)
- Senhas não são expostas nos logs
- Validação de entrada na API

## 🐛 Troubleshooting

### Erro: "Elemento não está visível"
- Verifique se a página carregou completamente
- Aumente o timeout em `page.waitForSelector()`

### Erro: "Campo não encontrado"
- Verifique os seletores CSS nos comentários das funções
- Confirme que a página do Prisma Box não mudou

### Erro de Login
- Verifique suas credenciais no `.env`
- Confirme se a conta do Prisma Box está ativa

## 📦 Deploy

Para fazer deploy em uma VPS ou Docker:

```bash
docker build -t prisma-ef .
docker run -p 3000:3000 --env-file .env prisma-ef
```

## 📞 Suporte

Para dúvidas ou problemas, verifique:
- Logs do console
- Arquivo de histórico em `data/jobs.json`
- Variáveis de ambiente

## 📄 Licença

Propriedade da Dinastia - Todos os direitos reservados

### 1. Preparar Ambiente

```bash
# Instalar Node.js na VPS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar dependências do Playwright
npx playwright install-deps
```

### 2. Configurar Variáveis de Ambiente

Na VPS, crie o arquivo `.env` com suas credenciais ou use variáveis de ambiente do sistema:

```bash
export SUPABASE_URL="https://uqzlilifrboerjqtuhky.supabase.co"
export SUPABASE_SERVICE_KEY="sua_service_key"
```

### 3. Executar como Serviço

Crie um cron job para execução automática:

```bash
# Editar crontab
crontab -e

# Executar a cada hora
0 * * * * cd /caminho/para/projeto && node prisma-to-supabase.js >> /var/log/prisma-sync.log 2>&1
```

## 🐛 Troubleshooting

### Erro de Login
- Verifique se as credenciais estão corretas
- Certifique-se de que não há captcha ou 2FA ativo

### Erro de Conexão Supabase
- Verifique se as URLs e chaves estão corretas
- Confirme se a tabela foi criada corretamente

### Erro de Extração
- Verifique se a estrutura da página não mudou
- Ajuste os seletores CSS se necessário

## 📈 Monitoramento

O sistema gera logs detalhados durante a execução. Para monitorar:

```bash
# Ver logs em tempo real
tail -f /var/log/prisma-sync.log

# Ver estatísticas no Supabase
node -e "require('./supabase-client').getBoxesStats().then(console.log)"
```

## 🔒 Segurança

- Nunca commite o arquivo `.env` no Git
- Use variáveis de ambiente na produção
- Mantenha as chaves do Supabase seguras
- Configure RLS (Row Level Security) no Supabase se necessário

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs de erro
2. Consulte a documentação do Supabase
3. Teste as funções individualmente para isolar problemas