# Base com Playwright e Chromium prontos (compatível com ^1.56.0)
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

# Diretório de trabalho
WORKDIR /app

# Copiar apenas manifestos para otimizar cache de dependências
COPY package*.json ./

# Instalar dependências (omitindo dev)
RUN npm ci --omit=dev

# Copiar o restante do código
COPY . .

# Ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expor porta da API
EXPOSE 3000

# Comando de inicialização (API local) sem npm wrapper
# Evita logs de "npm error signal SIGTERM" em reinícios controlados
CMD ["node", "api-server.js"]
