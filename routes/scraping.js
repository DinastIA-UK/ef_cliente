const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jobTracker = require('../utils/job-tracker');
const callbackService = require('../utils/callback');
const scrapingWorker = require('../workers/scraping-worker');

const router = express.Router();

// POST /api/scraping/gerar-proposta - Gerar proposta
router.post('/gerar-proposta', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const separator = '█'.repeat(100);
    
    // 🔴 Usar console.error para garantir que aparece nos logs do container
    console.error('\n' + separator);
    console.error('🚨🚨🚨 ROTA /gerar-proposta ATIVADA EM: ' + timestamp);
    console.error('🚨🚨🚨 PROCESSO: routes/scraping.js - ARQUIVO ATUALIZADO');
    console.error(separator);
    console.error('\n📋 REQ.BODY COMPLETO:');
    console.error(JSON.stringify(req.body, null, 2));
    console.error('\n' + separator + '\n');

    const { callbackUrl, unidade, clienteNome, clienteTelCel, cpf, sexo, cep, numero_endereco, pagamento, valorBens, propostaPrevisaoEntrada, motivoLocacaoId, vendedorId, boxes } = req.body;

    console.error('\n📍 VARIÁVEIS EXTRAÍDAS:');
    console.error(`   - callbackUrl: ${callbackUrl}`);
    console.error(`   - unidade: ${unidade}`);
    console.error(`   - boxes: ${JSON.stringify(boxes)}`);
    console.error('');

    // Validar callback URL
    if (!callbackUrl) {
      return res.status(400).json({
        success: false,
        error: 'callbackUrl é obrigatório'
      });
    }

    // Validar unidade
    if (!unidade) {
      return res.status(400).json({
        success: false,
        error: 'unidade é obrigatória'
      });
    }

    // Validar cliente (opcional, mas se fornecido deve ter nome e celular)
    if (clienteNome || clienteTelCel) {
      if (!clienteNome) {
        return res.status(400).json({
          success: false,
          error: 'clienteNome é obrigatório quando clienteTelCel é fornecido'
        });
      }
      if (!clienteTelCel) {
        return res.status(400).json({
          success: false,
          error: 'clienteTelCel é obrigatório quando clienteNome é fornecido'
        });
      }
    }

    // Validar proposta (opcional, mas se fornecido deve ter ambos)
    if (propostaPrevisaoEntrada || motivoLocacaoId) {
      if (!propostaPrevisaoEntrada) {
        return res.status(400).json({
          success: false,
          error: 'propostaPrevisaoEntrada é obrigatório quando motivoLocacaoId é fornecido'
        });
      }
      if (!motivoLocacaoId) {
        return res.status(400).json({
          success: false,
          error: 'motivoLocacaoId é obrigatório quando propostaPrevisaoEntrada é fornecido'
        });
      }
    }

    // Validar vendedor (opcional, mas se fornecido deve ter propostaPrevisaoEntrada e motivoLocacaoId)
    if (vendedorId) {
      if (!propostaPrevisaoEntrada || !motivoLocacaoId) {
        return res.status(400).json({
          success: false,
          error: 'propostaPrevisaoEntrada e motivoLocacaoId são obrigatórios quando vendedorId é fornecido'
        });
      }
    }

    if (boxes && Array.isArray(boxes) && boxes.length > 0) {
      if (!propostaPrevisaoEntrada || !motivoLocacaoId) {
        return res.status(400).json({
          success: false,
          error: 'propostaPrevisaoEntrada e motivoLocacaoId são obrigatórios quando boxes é fornecido'
        });
      }
    }

    const urlValidation = callbackService.validateCallbackUrl(callbackUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        error: urlValidation.error
      });
    }

    // Gerar ID único para o job
    const jobId = uuidv4();
    
    console.error('\n' + '█'.repeat(100));
    console.error('✨ [ROUTES-1] CRIANDO JOB COM ID: ' + jobId);
    console.error('█'.repeat(100) + '\n');

    // Criar job no tracker com unidade armazenada
    await jobTracker.createJob(jobId, callbackUrl);
    
    // Armazenar dados de entrada para uso no worker
    const inputData = {
      unidade,
      clienteNome,
      clienteTelCel,
      cpf,
      sexo,
      cep,
      numero_endereco,
      pagamento,
      valorBens,
      propostaPrevisaoEntrada,
      motivoLocacaoId,
      vendedorId,
      boxes
    };
    
    console.error('\n' + '█'.repeat(100));
    console.error('✨ [ROUTES-2] SALVANDO DADOS NO JOBTRACKER');
    console.error('✨ [ROUTES-2] Job ID: ' + jobId);
    console.error('✨ [ROUTES-2] InputData:');
    console.error(JSON.stringify(inputData, null, 2));
    console.error('█'.repeat(100) + '\n');
    
    await jobTracker.updateJob(jobId, { data: inputData });

    // Adicionar logs informativos
    await jobTracker.addLog(jobId, `Unidade selecionada: ${unidade}`);
    if (clienteNome) {
      await jobTracker.addLog(jobId, `Cliente: ${clienteNome}`);
      await jobTracker.addLog(jobId, `Celular: ${clienteTelCel}`);
    }
    if (cpf) {
      await jobTracker.addLog(jobId, `CPF: ${cpf}`);
    }
    if (sexo) {
      await jobTracker.addLog(jobId, `Sexo: ${sexo}`);
    }
    if (cep) {
      await jobTracker.addLog(jobId, `CEP: ${cep}`);
    }
    if (numero_endereco) {
      await jobTracker.addLog(jobId, `Número Endereço: ${numero_endereco}`);
    }
    if (pagamento) {
      await jobTracker.addLog(jobId, `Forma de Pagamento: ${pagamento}`);
    }
    if (valorBens) {
      await jobTracker.addLog(jobId, `Valor dos Bens: ${valorBens}`);
    }
    if (propostaPrevisaoEntrada) {
      await jobTracker.addLog(jobId, `Previsão de Entrada: ${propostaPrevisaoEntrada}`);
      await jobTracker.addLog(jobId, `Motivo Locação ID: ${motivoLocacaoId}`);
    }
    if (vendedorId) {
      await jobTracker.addLog(jobId, `Vendedor ID: ${vendedorId}`);
    }

    // Responder imediatamente com 200 OK
    res.status(200).json({
      success: true,
      jobId,
      message: 'Proposta iniciada com sucesso',
      status: 'pending',
      unidade: unidade,
      clienteNome: clienteNome || null,
      clienteTelCel: clienteTelCel || null,
      cpf: cpf || null,
      sexo: sexo || null,
      cep: cep || null,
      numero_endereco: numero_endereco || null,
      pagamento: pagamento || null,
      valorBens: valorBens || null,
      propostaPrevisaoEntrada: propostaPrevisaoEntrada || null,
      motivoLocacaoId: motivoLocacaoId || null,
      vendedorId: vendedorId || null,
      timestamp: new Date().toISOString()
    });

    // Iniciar execução de forma assíncrona com pequeno delay para garantir que o job foi criado
    setTimeout(async () => {
      const host = (req.headers && req.headers.host) ? String(req.headers.host) : '';
      const isLocalHost = host.includes('localhost') || host.startsWith('127.0.0.1');
      const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : '';
      const forceWorker = mode === 'worker';
      const useDirectExec = !forceWorker && (process.env.SCRAPING_DIRECT_EXECUTION === 'true' || isLocalHost || (process.env.NODE_ENV && process.env.NODE_ENV !== 'production'));

      if (useDirectExec) {
        // Execução direta (sem worker) para ambiente de desenvolvimento
        try {
          console.log(`🚀 Execução direta iniciada para job: ${jobId}`);
          await jobTracker.updateJob(jobId, {
            status: 'running',
            progress: 'Execução direta iniciada...'
          });

          await jobTracker.addLog(jobId, 'Executando sem worker (dev)');

          const { main } = require('../prisma-to-supabase');
          const { getBoxesStats } = require('../supabase-client');

          const startTime = Date.now();
          await main({ unidade, clienteNome, clienteTelCel, cpf, sexo, cep, numero_endereco, pagamento, valorBens, propostaPrevisaoEntrada, motivoLocacaoId, vendedorId, boxes });
          const endTime = Date.now();
          const processingTime = Math.round((endTime - startTime) / 1000);

          const statsResult = await getBoxesStats();
          const totalBoxes = statsResult?.success ? (statsResult.stats?.total || 0) : 0;

          const scrapingResult = {
            summary: 'Scraping concluído com sucesso (execução direta)',
            totalBoxes,
            unitsProcessed: 0,
            successfulUnits: 0,
            failedUnits: [],
            processingTime,
            logs: [],
            extractedAt: new Date().toISOString()
          };

          await jobTracker.completeJob(jobId, scrapingResult);
          await jobTracker.addLog(jobId, `Scraping concluído em ${processingTime} segundos (execução direta)`);

          try {
            await callbackService.sendSuccessCallback(callbackUrl, jobId, scrapingResult);
          } catch (callbackError) {
            console.error('⚠️ Erro ao enviar callback de sucesso (execução direta):', callbackError);
          }

          console.log(`✅ Execução direta concluída para job: ${jobId}`);

        } catch (error) {
          console.error(`❌ Erro na execução direta para job ${jobId}:`, error);
          await jobTracker.failJob(jobId, error);
          await jobTracker.addLog(jobId, `Erro: ${error.message}`, 'error');
          try {
            await callbackService.sendErrorCallback(callbackUrl, jobId, error);
          } catch (callbackError) {
            console.error(`❌ Erro ao enviar callback de erro (execução direta):`, callbackError);
          }
        }
      } else {
        // Execução via worker (produção)
        try {
          console.log(`🚀 Iniciando worker para job: ${jobId}`);
          await scrapingWorker.startScraping(jobId, callbackUrl);
          console.log(`✅ Worker iniciado para job: ${jobId}`);
        } catch (error) {
          console.error(`❌ Erro ao iniciar worker para job ${jobId}:`, error);
          await jobTracker.failJob(jobId, error);
          try {
            await callbackService.sendErrorCallback(callbackUrl, jobId, error);
          } catch (callbackError) {
            console.error(`❌ Erro ao enviar callback de erro:`, callbackError);
          }
        }
      }
    }, 100); // 100ms de delay para garantir que o job foi salvo

  } catch (error) {
    console.error('❌ Erro ao processar requisição de start:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/scraping/status/:jobId - Verificar status do job
router.get('/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId é obrigatório'
      });
    }

    const job = jobTracker.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado'
      });
    }

    // Remover informações sensíveis
    const { callbackUrl, ...safeJob } = job;

    res.json({
      success: true,
      job: safeJob
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/scraping/jobs - Listar todos os jobs (para debug/admin)
router.get('/jobs', (req, res) => {
  try {
    const jobs = jobTracker.getAllJobs();
    
    // Remover informações sensíveis
    const safeJobs = jobs.map(job => {
      const { callbackUrl, ...safeJob } = job;
      return safeJob;
    });

    res.json({
      success: true,
      jobs: safeJobs,
      total: safeJobs.length
    });

  } catch (error) {
    console.error('❌ Erro ao listar jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/scraping/job/:jobId - Cancelar job (se ainda estiver rodando)
router.delete('/job/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'jobId é obrigatório'
      });
    }

    const job = jobTracker.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job não encontrado'
      });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Job já foi finalizado'
      });
    }

    // Tentar terminar o worker
    const terminated = scrapingWorker.terminateWorker(jobId);
    
    if (terminated) {
      jobTracker.failJob(jobId, new Error('Job cancelado pelo usuário'));
      jobTracker.addLog(jobId, 'Job cancelado pelo usuário', 'info');
    }

    res.json({
      success: true,
      message: terminated ? 'Job cancelado com sucesso' : 'Job não estava rodando',
      jobId
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar job:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/scraping/active - Listar workers ativos
router.get('/active', (req, res) => {
  try {
    const activeWorkers = scrapingWorker.getActiveWorkers();
    
    res.json({
      success: true,
      activeWorkers,
      count: activeWorkers.length
    });

  } catch (error) {
    console.error('❌ Erro ao listar workers ativos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/scraping/callback - Receber callback de teste
router.post('/callback', (req, res) => {
  try {
    const { jobId, success, data, error } = req.body;

    console.log('\n' + '=' .repeat(60));
    console.log('📥 CALLBACK RECEBIDO');
    console.log('=' .repeat(60));
    console.log(`📌 Job ID: ${jobId}`);
    console.log(`✅ Status: ${success ? 'SUCESSO' : 'ERRO'}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    if (data) {
      console.log('\n📊 Dados:');
      console.log(JSON.stringify(data, null, 2));
    }

    if (error) {
      console.log('\n❌ Erro:');
      console.log(error);
    }

    console.log('=' .repeat(60) + '\n');

    // Responder ao callback
    res.status(200).json({
      success: true,
      message: 'Callback recebido com sucesso',
      receivedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao processar callback:', error);
    res.status(400).json({
      success: false,
      error: 'Erro ao processar callback'
    });
  }
});

module.exports = router;
