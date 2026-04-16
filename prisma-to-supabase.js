require('dotenv').config();
const { chromium } = require('playwright');

/**
 * Verificar se o usuário ainda está logado
 * @param {Object} page - Página do Playwright
 * @returns {boolean} True se ainda estiver logado
 */
async function isLoggedIn(page) {
    try {
        // Verificar se estamos na página de login (indicativo de logout)
        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
            return false;
        }
        
        // Verificar se existe elemento que só aparece quando logado
        const loggedInElement = await page.$('a[href="/logout"], .user-menu, .navbar-nav');
        return loggedInElement !== null;
    } catch (error) {
        console.log('⚠️ Erro ao verificar login:', error.message);
        return false;
    }
}

/**
 * Fazer login no sistema
 * @param {Object} page - Página do Playwright
 */
async function performLogin(page) {
    console.log('🔐 Fazendo login...');
    
    // Navegar para a página de login se não estivermos lá
    if (!page.url().includes('/login')) {
        console.log('📍 Navegando para página de login...');
        await page.goto('https://app.prismabox.com.br/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000); // Aguardar brevemente para scripts iniciais
    }
    
    // Aguardar o campo de usuário aparecer
    console.log('⏳ Aguardando campo de usuário...');
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.fill('input[name="username"]', process.env.PRISMA_USERNAME);
    
    console.log('⏳ Aguardando campo de senha...');
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
    await page.fill('input[name="password"]', process.env.PRISMA_PASSWORD);
    
    console.log('⏳ Procurando botão de login...');
    await page.waitForSelector('button[type="submit"]:has-text("Entrar")', { timeout: 15000 });
    
    console.log('🔑 Clicando em Entrar...');
    await page.click('button[type="submit"]:has-text("Entrar")');
    
    // Aguardar a página carregar após login (usar load em vez de networkidle)
    console.log('⏳ Aguardando página de proposta carregar...');
    try {
        await page.waitForLoadState('load', { timeout: 20000 });
    } catch (e) {
        console.warn('⚠️ Timeout em waitForLoadState, continuando mesmo assim...');
    }
    
    // Aguardar um pouco mais para elementos renderizarem
    await page.waitForTimeout(1500);
    
    // Navegar para a página de criação de proposta
    console.log('📝 Navegando para página de proposta...');
    await page.goto('https://app.prismabox.com.br/proposal/add', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Aguardar apenas load, não networkidle (mais rápido)
    console.log('⏳ Finalizando carregamento...');
    try {
        await page.waitForLoadState('load', { timeout: 15000 });
    } catch (e) {
        console.warn('⚠️ Timeout em waitForLoadState da proposta, continuando...');
    }
    
    await page.waitForTimeout(2000);
    
    console.log('✅ Login realizado! Página de proposta carregada...');
}

/**
 * Fechar modal de notificação que aparece na página
 * @param {Object} page - Página do Playwright
 */
async function fecharModalNotificacao(page) {
    try {
        console.log('🔔 Verificando se há modal de notificação...');
        
        // Aguardar brevemente para ver se o modal aparece
        await page.waitForTimeout(1000);
        
        // Procurar pelo modal de notificação
        const modal = await page.$('.modal-dialog');
        
        if (modal) {
            console.log('📢 Modal de notificação detectado!');
            
            // Procurar pelo botão "Não"
            const botaoNao = await page.$('button[data-bb-handler="success"]');
            
            if (botaoNao) {
                console.log('👆 Clicando em "Não"...');
                await page.click('button[data-bb-handler="success"]');
                
                // Aguardar o modal fechar
                await page.waitForTimeout(1000);
                console.log('✅ Modal fechado com sucesso!');
            } else {
                console.log('⚠️ Botão "Não" não encontrado no modal');
            }
        } else {
            console.log('ℹ️ Nenhum modal de notificação detectado');
        }
        
    } catch (error) {
        console.log(`⚠️ Erro ao tentar fechar modal: ${error.message}`);
        // Continuar mesmo assim
    }
}

/**
 * Validar e fechar modal de cliente duplicado (Bootbox)
 * Aparece quando um cliente com mesmo telefone já existe no cadastro
 * @param {Object} page - Página do Playwright
 */
async function validarEFecharModalClienteDuplicado(page) {
    try {
        console.log('\n🔍 Validando se há modal de cliente duplicado...');
        
        // Aguardar um pouco para o modal aparecer (se existir)
        await page.waitForTimeout(1500);
        
        // Procurar pelo modal (Bootbox usa .bootbox-body)
        const modalBody = await page.$('.bootbox-body');
        
        if (modalBody) {
            // Obter o texto do modal para validar
            const textoModal = await page.evaluate(() => {
                const body = document.querySelector('.bootbox-body');
                return body ? body.textContent.trim() : '';
            });
            
            console.log('⚠️ Modal de cliente duplicado DETECTADO!');
            console.log(`   Mensagem: "${textoModal.substring(0, 100)}..."`);
            
            // Procurar pelo botão "Não" (data-bb-handler="danger")
            const botaoNao = await page.$('button[data-bb-handler="danger"]');
            
            if (botaoNao) {
                console.log('👆 Clicando em "Não" para REJEITAR o cadastro duplicado...');
                await botaoNao.click();
                
                // Aguardar o modal fechar e a página processar
                await page.waitForTimeout(1500);
                console.log('✅ Modal fechado! Continuando com novo cadastro...');
                return true;
            } else {
                console.warn('⚠️ Botão "Não" não encontrado no modal de cliente duplicado');
                return false;
            }
        } else {
            console.log('✅ Nenhum modal de cliente duplicado detectado - prosseguindo normalmente');
            return false;
        }
        
    } catch (error) {
        console.log(`⚠️ Erro ao validar modal de cliente duplicado: ${error.message}`);
        // Continuar mesmo assim
        return false;
    }
}

/**
 * Capturar erros e avisos do console do navegador
 * Útil para detectar erros silenciosos em headless mode
 * @param {Object} page - Página do Playwright
 * @returns {Object} Objeto com erros e warnings capturados
 */
async function capturarLogsDaPagina(page) {
    try {
        const logs = {
            erros: [],
            warnings: [],
            chamadasPagina: 0
        };
        
        // Capturar console.log, console.error, console.warn da página
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.erros.push(msg.text());
            } else if (msg.type() === 'warning') {
                logs.warnings.push(msg.text());
            }
        });
        
        // Capturar exceptions não capturadas
        page.on('pageerror', err => {
            logs.erros.push(`Uncaught: ${err.message}`);
        });
        
        return logs;
    } catch (error) {
        console.warn(`⚠️ Erro ao capturar logs: ${error.message}`);
        return { erros: [], warnings: [], chamadasPagina: 0 };
    }
}

/**
 * Verificar se há elemento desabilitado ou readonly bloqueando a ação
 * @param {Object} page - Página do Playwright
 * @returns {Array} Lista de elementos problemáticos
 */
async function diagnosticarElementosBloqueados(page) {
    return page.evaluate(() => {
        const problemas = [];
        
        // Procurar por botões desabilitados
        const botoes = document.querySelectorAll('button:disabled, a[href="#finish"]');
        botoes.forEach(btn => {
            if (btn.disabled || btn.getAttribute('disabled') === 'disabled') {
                problemas.push({
                    tipo: 'disabled',
                    elemento: btn.tagName,
                    id: btn.id,
                    class: btn.className,
                    motivo: 'Elemento está desabilitado'
                });
            }
        });
        
        // Procurar por elementos readonly
        const inputs = document.querySelectorAll('input[readonly], textarea[readonly]');
        inputs.forEach(input => {
            problemas.push({
                tipo: 'readonly',
                elemento: input.tagName,
                name: input.name,
                motivo: 'Elemento está readonly'
            });
        });
        
        // Procurar por formulários não válidos
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.checkValidity()) {
                problemas.push({
                    tipo: 'form-invalid',
                    motivo: 'Formulário não passou em validação'
                });
            }
        });
        
        return problemas;
    });
}

/**
 * Sistema de keep-alive para manter sessão ativa
 * @param {Object} page - Página do Playwright
 */
async function keepAlive(page) {
    try {
        // Fazer uma ação simples para manter a sessão ativa
        await page.evaluate(() => {
            // Simular movimento do mouse
            document.dispatchEvent(new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: Math.random() * window.innerWidth,
                clientY: Math.random() * window.innerHeight
            }));
        });
    } catch (error) {
        // Ignorar erros do keep-alive
    }
}

/**
 * Verificador universal de modais antes de qualquer ação
 * Detecta e fecha automaticamente modais abertos (incluindo invisíveis)
 * @param {Object} page - Página do Playwright
 * @returns {boolean} True se havia modal aberto
 */
async function verificarEFecharModaisAbertos(page) {
    try {
        // Primeiro: verificar se há overlay/backdrop visível
        const temOverlay = await page.evaluate(() => {
            // Procurar por elementos que parecem ser modais (alta opacity, alto z-index, grande tamanho)
            const allElements = document.querySelectorAll('*');
            
            for (const el of allElements) {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                
                // Verificar características de modal
                const isLargeElement = rect.width > window.innerWidth * 0.3 || rect.height > window.innerHeight * 0.3;
                const hasHighZindex = parseInt(style.zIndex) >= 1000;
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                const isModal = el.classList.toString().includes('modal') || 
                               el.getAttribute('role') === 'dialog' ||
                               el.classList.toString().includes('popup') ||
                               el.classList.toString().includes('dialog');
                
                if (isModal && (isVisible || hasHighZindex)) {
                    return true;
                }
            }
            
            return false;
        });
        
        if (!temOverlay) {
            return false; // Nenhum modal encontrado
        }
        
        console.log(`⚠️ Modal detectado no DOM!`);
        
        // Segundo: procurar e fechar modais
        const seletoresModais = [
            '.modal.show:not([style*="display: none"])',
            '.bootbox-body',
            '[role="dialog"]:not([aria-hidden="true"])',
            '.popup-overlay',
            '.modal-backdrop',
            '.modal:not([style*="display: none"])',
            'div[class*="modal"]:not([style*="display: none"])',
            'div[class*="dialog"]:not([style*="display: none"])'
        ];
        
        let modalFechado = false;
        
        for (const seletor of seletoresModais) {
            try {
                const elementos = await page.$$(seletor);
                
                for (const elemento of elementos) {
                    try {
                        const visible = await elemento.isVisible().catch(() => true); // Assumir visível se erro
                        
                        if (visible) {
                            console.log(`🔍 Encontrado modal: ${seletor}`);
                            
                            // Botões para fechar (em ordem de importância)
                            const botoes = [
                                'button[data-bb-handler="danger"]',  // Bootbox "Não"
                                'button[data-bb-handler="success"]', // Bootbox "Sim"
                                'button.btn-close',
                                'button.close',
                                'button[aria-label="Close"]',
                                'button[aria-label*="close" i]',
                                '[data-dismiss="modal"]',
                                'button:last-child' // Último botão como fallback
                            ];
                            
                            for (const botaoSel of botoes) {
                                try {
                                    const btn = await elemento.$(botaoSel);
                                    if (btn) {
                                        const btnVisible = await btn.isVisible().catch(() => true);
                                        if (btnVisible) {
                                            console.log(`✅ Fechando com botão: ${botaoSel}`);
                                            await btn.click({ force: true });
                                            await page.waitForTimeout(1200);
                                            modalFechado = true;
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    // Continuar
                                }
                            }
                            
                            if (modalFechado) break;
                        }
                    } catch (e) {
                        // Continuar com próximo elemento
                    }
                }
                
                if (modalFechado) break;
            } catch (e) {
                // Continuar com próximo seletor
            }
        }
        
        // Terceiro: se não conseguiu fechar, tentar com ESC key
        if (!modalFechado) {
            console.log('🔑 Tentando fechar modal com tecla ESC...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
        }
        
        return true;
        
    } catch (error) {
        console.warn(`⚠️ Erro ao verificar modais: ${error.message}`);
        return false;
    }
}

/**
 * WRAPPER: Executa ação com verificação de modal automática
 * Evita quebras no fluxo causadas por modais inesperados
 * @param {Object} page - Página do Playwright
 * @param {Function} acao - Função assíncrona a executar
 * @param {number} tentativas - Número de tentativas (default: 3)
 * @returns {any} Resultado da ação executada
 */
async function comVerificacaoDeModal(page, acao, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
        try {
            // SEMPRE verificar modal antes de qualquer ação
            const tinhaModal = await verificarEFecharModaisAbertos(page);
            
            if (tinhaModal) {
                console.log(`🔄 Modal encontrado, tentativa ${i + 1}/${tentativas}`);
                await page.waitForTimeout(1000);
                continue; // Tenta novamente
            }
            
            // Executar a ação
            return await acao();
            
        } catch (error) {
            if (i === tentativas - 1) throw error;
            console.warn(`⚠️ Erro na tentativa ${i + 1}, verificando novamente...`);
            await verificarEFecharModaisAbertos(page);
            await page.waitForTimeout(1500);
        }
    }
}

/**
 * Helper: Clicar com verificação de modal
 * @param {Object} page - Página do Playwright
 * @param {string} seletor - Seletor do elemento
 */
async function clicarComSeguranca(page, seletor) {
    return comVerificacaoDeModal(page, async () => {
        await page.click(seletor);
    });
}

/**
 * Helper: Preencher campo com verificação de modal
 * @param {Object} page - Página do Playwright
 * @param {string} seletor - Seletor do elemento
 * @param {string} texto - Texto a preencher
 */
async function fillComSeguranca(page, seletor, texto) {
    return comVerificacaoDeModal(page, async () => {
        await page.fill(seletor, texto);
    });
}

/**
 * Helper: Selecionar opção com verificação de modal
 * @param {Object} page - Página do Playwright
 * @param {string} seletor - Seletor do element
 * @param {string} valor - Valor a selecionar
 */
async function selectComSeguranca(page, seletor, valor) {
    return comVerificacaoDeModal(page, async () => {
        await page.selectOption(seletor, valor);
    });
}

/**
 * Preencher campo que pode estar oculto (hidden) em headless mode
 * Funciona com elementos que estão no DOM mas com display:none ou visibility:hidden
 * @param {Object} page - Página do Playwright
 * @param {string} seletor - Seletor CSS do input
 * @param {string} valor - Valor a preencher
 * @param {string} tipo - Tipo de campo: 'text' (default), 'select', 'password'
 */
async function preencherCampoOculto(page, seletor, valor, tipo = 'text') {
    try {
        let tentativas = 5;
        let elemento = null;
        
        // Tentar encontrar o elemento
        for (let i = 0; i < tentativas; i++) {
            elemento = await page.$(seletor);
            if (elemento) {
                break;
            }
            await page.waitForTimeout(500);
        }
        
        if (!elemento) {
            throw new Error(`Elemento ${seletor} não encontrado no DOM após ${tentativas} tentativas`);
        }
        
        // Fazer scroll mesmo que hidden
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, seletor);
        
        await page.waitForTimeout(600);
        
        if (tipo === 'select') {
            // Para select: usar setValue via JavaScript
            await elemento.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, valor);
        } else {
            // Para text/password: limpar e preencher
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) {
                    // Remover readonly temporariamente
                    const wasReadonly = el.readOnly;
                    el.readOnly = false;
                    el.value = '';
                    el.readOnly = wasReadonly;
                }
            }, seletor);
            
            await page.waitForTimeout(300);
            
            // Tentar digitar normalmente
            try {
                await elemento.type(String(valor), { delay: 20 });
            } catch (typeError) {
                // Se falhar (elemento oculto), usar JavaScript
                console.warn(`⚠️ type() falhou, usando JavaScript para ${seletor}`);
                await elemento.evaluate((el, val) => {
                    el.value = String(val);
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, valor);
            }
        }
        
        // Disparar eventos finais para garantir
        await elemento.evaluate(el => {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
        });
        
        await page.waitForTimeout(300);
        return true;
        
    } catch (error) {
        console.error(`❌ Erro ao preencher campo oculto ${seletor}: ${error.message}`);
        throw error;
    }
}

/**
 * Clicar no botão "Criar um Novo Cliente"
 * @param {Object} page - Página do Playwright
 */
async function clicarCriarNovoCliente(page) {
    try {
        console.log('\n👤 Procurando botão "Criar um Novo Cliente"...');
        
        // Aguardar o botão aparecer
        await page.waitForSelector('#btn-add-client', { timeout: 10000 });
        console.log('✅ Botão "Criar um Novo Cliente" encontrado');
        
        // Clicar no botão com verificação de modal
        await clicarComSeguranca(page, '#btn-add-client');
        console.log('✅ Clicado em "Criar um Novo Cliente"');
        
        // Aguardar o formulário aparecer
        await page.waitForSelector('#add-client[style*="display: block"]', { timeout: 10000 });
        console.log('✅ Formulário aberto com sucesso!');
        
        await page.waitForTimeout(1000);
        
    } catch (error) {
        console.error(`❌ Erro ao clicar no botão "Criar um Novo Cliente":`, error.message);
        throw error;
    }
}

/**
 * Preencher dados do cliente no formulário
 * @param {Object} page - Página do Playwright
 * @param {string} clienteNome - Nome do cliente
 * @param {string} clienteTelCel - Celular do cliente
 */
async function preencherDadosCliente(page, clienteNome, clienteTelCel) {
    try {
        console.log(`\n📝 Preenchendo dados do cliente...`);
        
        // Preencher nome com verificação de modal
        console.log(`⏳ Preenchendo Nome: ${clienteNome}`);
        await page.waitForSelector('#clienteNome', { timeout: 10000 });
        await fillComSeguranca(page, '#clienteNome', clienteNome);
        console.log('✅ Nome preenchido');
        
        // Preencher celular com verificação de modal
        console.log(`⏳ Preenchendo Celular: ${clienteTelCel}`);
        await page.waitForSelector('#searchTelCel', { timeout: 10000 });
        await fillComSeguranca(page, '#searchTelCel', clienteTelCel);
        console.log('✅ Celular preenchido');
        
        await page.waitForTimeout(1000);
        console.log('✅ Dados do cliente preenchidos com sucesso!');
        
    } catch (error) {
        console.error(`❌ Erro ao preencher dados do cliente:`, error.message);
        throw error;
    }
}

/**
 * Converter data para formato DD/MM/YYYY
 * @param {string} data - Data em formato YYYY-MM-DD ou DD/MM/YYYY
 * @returns {string} Data em formato DD/MM/YYYY
 */
function converterParaDataBRASIL(data) {
    if (!data) return '';
    
    // Se já está no formato DD/MM/YYYY, retorna como está
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
        return data;
    }
    
    // Se está no formato YYYY-MM-DD, converte
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    }
    
    // Se está em outro formato, tenta retornar como está
    return data;
}

/**
 * Preencher previsão de entrada da proposta via datepicker
 * @param {Object} page - Página do Playwright
 * @param {string} previsaoEntrada - Data da previsão de entrada (formato: YYYY-MM-DD ou DD/MM/YYYY)
 */
async function preencherPrevisaoEntrada(page, previsaoEntrada) {
    try {
        console.log(`\n📅 Preenchendo Previsão de Entrada...`);
        console.log(`⏳ Data fornecida: ${previsaoEntrada}`);
        
        // Converter para formato YYYY-MM-DD para usar com input type="date"
        let dataFormatada = previsaoEntrada;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(previsaoEntrada)) {
            // Converte DD/MM/YYYY para YYYY-MM-DD
            const [dia, mes, ano] = previsaoEntrada.split('/');
            dataFormatada = `${ano}-${mes}-${dia}`;
        }
        console.log(`📅 Data formatada (YYYY-MM-DD): ${dataFormatada}`);
        
        // Aguardar o campo aparecer
        await page.waitForSelector('#propostaPrevisaoEntrada', { timeout: 10000 });
        console.log('✅ Campo de previsão de entrada encontrado');
        
        // Tentar preencher via JavaScript (contornando o readonly)
        await page.evaluate((args) => {
            const input = document.querySelector(args.selector);
            if (input) {
                // Definir o valor
                input.value = args.data;
                // Disparar eventos de mudança
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, { selector: '#propostaPrevisaoEntrada', data: dataFormatada });
        
        console.log('✅ Previsão de entrada preenchida');
        await page.waitForTimeout(1000);
        
    } catch (error) {
        console.error(`❌ Erro ao preencher previsão de entrada:`, error.message);
        throw error;
    }
}

/**
 * Preencher previsão de entrada da proposta via datepicker
 * @param {Object} page - Página do Playwright
 * @param {string} DataNascimento - Data da previsão de entrada (formato: YYYY-MM-DD ou DD/MM/YYYY)
 */
async function preencherDataNascimento(page, data_nascimento) {
    try {
        console.log(`\n📅 Preenchendo Previsão de Entrada...`);
        console.log(`⏳ Data fornecida: ${data_nascimento}`);
        
        // Converter para formato YYYY-MM-DD para usar com input type="date"
        let dataFormatada = data_nascimento;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(data_nascimento)) {
            // Converte DD/MM/YYYY para YYYY-MM-DD
            const [dia, mes, ano] = data_nascimento.split('/');
            dataFormatada = `${dia}-${mes}-${ano}`;
        }
        console.log(`📅 Data formatada (YYYY-MM-DD): ${dataFormatada}`);
        
        // Aguardar o campo aparecer
        await page.waitForSelector('#clienteNascimento', { timeout: 10000 });
        console.log('✅ Campo de data nascimento encontrado');
        
        // Tentar preencher via JavaScript (contornando o readonly)
        await page.evaluate((args) => {
            const input = document.querySelector(args.selector);
            if (input) {
                // Definir o valor
                input.value = args.data;
                // Disparar eventos de mudança
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, { selector: '#clienteNascimento', data: dataFormatada });
        
        console.log('✅ data nascimento preenchida');
        await page.waitForTimeout(1000);
        
    } catch (error) {
        console.error(`❌ Erro ao preencher data nacimento:`, error.message);
        throw error;
    }
}

/**
 * Selecionar motivo de locação
 * @param {Object} page - Página do Playwright
 * @param {string} motivoLocacaoId - ID do motivo de locação
 */
async function selecionarMotivoLocacao(page, motivoLocacaoId) {
    try {
        console.log(`\n🎯 Selecionando Motivo de Locação...`);
        console.log(`⏳ ID do motivo: ${motivoLocacaoId}`);
        
        // Aguardar o select aparecer
        await page.waitForSelector('#motivoLocacaoId', { timeout: 10000 });
        console.log('✅ Select de motivo de locação encontrado');
        
        // Selecionar a opção com verificação de modal
        await selectComSeguranca(page, '#motivoLocacaoId', motivoLocacaoId);
        console.log(`✅ Motivo de locação selecionado`);
        
        await page.waitForTimeout(500);
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar motivo de locação:`, error.message);
        throw error;
    }
}

/**
 * Selecionar vendedor responsável
 * @param {Object} page - Página do Playwright
 * @param {string} vendedorId - ID do vendedor/responsável
 */
async function selecionarVendedor(page, vendedorId) {
    try {
        console.log(`\n👤 Selecionando Vendedor/Responsável...`);
        console.log(`⏳ ID do vendedor: ${vendedorId}`);
        
        // Aguardar o select aparecer
        await page.waitForSelector('#vendedorId', { timeout: 10000 });
        console.log('✅ Select de vendedor encontrado');
        
        // Selecionar a opção com verificação de modal
        await selectComSeguranca(page, '#vendedorId', vendedorId);
        console.log(`✅ Vendedor selecionado`);
        
        await page.waitForTimeout(500);
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar vendedor:`, error.message);
        throw error;
    }
}

/**
 * Clicar no botão "Próximo"
 * @param {Object} page - Página do Playwright
 */
async function clicarProximo(page) {
    try {
        console.log('\n⏳ Procurando botão "Próximo"...');
        
        // Verificar e fechar modais antes de clicar
        const tinhaModal = await verificarEFecharModaisAbertos(page);
        if (tinhaModal) {
            console.log('🔄 Modal foi fechado, aguardando...');
            await page.waitForTimeout(1000);
        }
        
        // Tentar encontrar o botão de próximo
        const botaoProximo = await page.$('a[href="#next"]');
        
        if (!botaoProximo) {
            console.warn('⚠️ Botão "a[href="#next"]" não encontrado, tentando outros seletores...');
            
            // Tentar outros seletores
            const alternativas = [
                'button:has-text("Próximo")',
                'button:has-text("próximo")',
                'a:has-text("Próximo")',
                'a:has-text("próximo")',
                '.btn-next',
                '[role="menuitem"][href="#next"]'
            ];
            
            let encontrou = false;
            for (const seletor of alternativas) {
                try {
                    await page.waitForSelector(seletor, { timeout: 2000 });
                    console.log(`✅ Encontrado com seletor: ${seletor}`);
                    await clicarComSeguranca(page, seletor);
                    console.log('✅ Botão "Próximo" clicado com sucesso!');
                    encontrou = true;
                    break;
                } catch (e) {
                    console.log(`   ❌ Seletor "${seletor}" não funcionou`);
                }
            }
            
            if (!encontrou) {
                console.error('❌ FALHA: Nenhum botão "Próximo" encontrado!');
                throw new Error('Botão Próximo não encontrado');
            }
        } else {
            console.log('✅ Botão encontrado, clicando...');
            await clicarComSeguranca(page, 'a[href="#next"]');
            console.log('✅ Botão "Próximo" clicado com sucesso!');
        }
        
        // Aguardar a próxima página carregar
        console.log('⏳ Aguardando próxima página carregar...');
        try {
            await page.waitForLoadState('load', { timeout: 15000 });
            await page.waitForTimeout(2000);
            console.log('✅ Próxima página carregou!');
        } catch (e) {
            console.warn('⚠️ Timeout ao aguardar página, mas continuando...');
        }
        
    } catch (error) {
        console.error(`❌ Erro ao clicar no próximo:`, error.message);
        throw error;
    }
}

/**
 * Mapear tipo de plano (texto) para ID
 * @param {string} tipo - Tipo do plano (ex: "MENSAL", "DIÁRIA", etc)
 * @returns {string} ID do plano
 */
function mapearTipoParaPlanoId(tipo) {
    const mapas = {
        'DIÁRIA': '1',
        'SEMANAL': '16',
        'DEZENA': '17',
        'QUINZENAL': '2',
        'MENSAL': '3',
        'BIMESTRAL': '4',
        'TRIMESTRAL': '5',
        'QUADRIMESTRAL': '18',
        'SEMESTRAL': '14',
        'ANUAL': '15',
        'BIENAL': '19',
        'TRIENAL': '20'
    };
    
    return mapas[tipo.toUpperCase()] || null;
}

/**
 * Adicionar múltiplos items de boxes na proposta
 * @param {Object} page - Página do Playwright
 * @param {Array} boxes - Array de boxes com formato [{nome: "...", tipo: "..."}, ...]
 */
async function adicionarItemsBoxes(page, boxes, dadosCliente = {}) {
    try {
        if (!boxes || boxes.length === 0) {
            console.log('⚠️ Nenhum box para adicionar');
            return;
        }
        
        const { cpf, sexo, cep, numero_endereco, pagamento, valorBens, data_nascimento, email } = dadosCliente;
        
        console.log(`\n📦 Iniciando adição de ${boxes.length} items...`);
        console.log(`   📊 Parâmetros recebidos em adicionarItemsBoxes:`);
        console.log(`      • cpf: ${cpf ? `"${cpf}"` : 'undefined'}`);
        console.log(`      • sexo: ${sexo ? `"${sexo}"` : 'undefined'}`);
        console.log(`      • cep: ${cep ? `"${cep}"` : 'undefined'}`);
        console.log(`      • numero_endereco: ${numero_endereco ? `"${numero_endereco}"` : 'undefined'}`);
        console.log(`      • pagamento: ${pagamento ? `"${pagamento}"` : 'undefined'}`);
        console.log(`      • valorBens: ${valorBens ? `"${valorBens}"` : 'undefined'}`);
        
        // Guardar IDs de todos os rows processados
        const rowIdsProcessados = [];
        
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const itemIndex = i + 1;
            
            console.log(`\n🎯 [Item ${itemIndex}/${boxes.length}] Processando: ${box.nome} (${box.tipo})`);
            
            try {
                // 1️⃣ Clicando no dropdown
                console.log(`   [1] Clicando no botão dropdown...`);
                const dropdownBtn = await page.$('button.btn-primary.btn-circle.btn-lg.dropdown-toggle');
                if (!dropdownBtn) {
                    console.error(`   ❌ Botão dropdown não encontrado`);
                    throw new Error('Botão dropdown não encontrado');
                }
                await dropdownBtn.click();
                await page.waitForTimeout(500);
                console.log(`   ✅ Dropdown aberto`);
                
                // 2️⃣ Clicando em "Adicionar"
                console.log(`   [2] Clicando em "Adicionar"...`);
                const btnAdicionar = await page.$('#btn-add-item-by-box');
                if (!btnAdicionar) {
                    console.error(`   ❌ Botão "Adicionar" não encontrado`);
                    throw new Error('Botão Adicionar não encontrado');
                }
                await btnAdicionar.click();
                await page.waitForTimeout(1000);
                console.log(`   ✅ Item adicionado ao formulário`);
                
                // 3️⃣ Aguardar o novo row aparecer e obter seus IDs
                console.log(`   [3] Aguardando novo row aparecer...`);
                const newRow = await page.$('div.row[id^="line-box-"]:last-of-type');
                if (!newRow) {
                    console.warn(`   ⚠️ Não foi possível confirmar novo row, continuando mesmo assim...`);
                }
                
                // Obter o ID do novo row para usar como referência
                let dataValue = '';
                try {
                    const rows = await page.$$('div.row[id^="line-box-"]');
                    if (rows.length > 0) {
                        const lastRow = rows[rows.length - 1];
                        const id = await lastRow.getAttribute('id');
                        dataValue = id.replace('line-box-', '');
                        console.log(`   ✅ Novo row encontrado com data-value: ${dataValue}`);
                        
                        // Guardar o ID para ocultação posterior
                        rowIdsProcessados.push(id);
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Erro ao obter data-value: ${e.message}`);
                }
                
                // 4️⃣ Preencher planoId
                console.log(`   [4] Selecionando plano: ${box.tipo}...`);
                const planoId = mapearTipoParaPlanoId(box.tipo);
                if (!planoId) {
                    console.error(`   ❌ Tipo "${box.tipo}" não reconhecido!`);
                    throw new Error(`Tipo de plano desconhecido: ${box.tipo}`);
                }
                
                // Obter o último row adicionado
                const rows = await page.$$('div.row[id^="line-box-"]');
                if (rows.length === 0) {
                    throw new Error('Nenhum row encontrado para preencher plano');
                }
                
                const ultimoRow = rows[rows.length - 1];
                const ultimoRowId = await ultimoRow.getAttribute('id');
                console.log(`   📍 Selecionando plano no row: ${ultimoRowId}`);
                
                // Encontrar o select.planoId dentro deste row específico
                const planoSelectNoRow = await ultimoRow.$('select.planoId');
                if (!planoSelectNoRow) {
                    console.error(`   ❌ Select planoId não encontrado no row ${ultimoRowId}`);
                    throw new Error(`Select planoId não encontrado no row: ${ultimoRowId}`);
                }
                
                // Selecionar a opção usando evaluate para garantir
                await planoSelectNoRow.evaluate((el, val) => {
                    el.value = val;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }, planoId);
                
                console.log(`   ✅ Plano selecionado: ${planoId} (${box.tipo})`);
                await page.waitForTimeout(500);
                
                // 5️⃣ Preencher boxTipoId via autocomplete (Select2)
                console.log(`   [5] Selecionando tipo de box: ${box.nome}...`);
                
                // Fechar TODOS os dropdowns Select2 abertos na página antes de abrir o novo
                console.log(`   🧹 Limpando dropdowns anteriores...`);
                await page.evaluate(() => {
                    // Fechar todos os Select2 na página
                    if (typeof jQuery !== 'undefined') {
                        jQuery('select').each(function() {
                            try {
                                if (jQuery(this).data('select2')) {
                                    jQuery(this).select2('close');
                                }
                            } catch (e) {
                                // ignorar
                            }
                        });
                    }
                    
                    // Remover todos os dropdowns visíveis da página
                    const dropdowns = document.querySelectorAll('span.select2-dropdown');
                    dropdowns.forEach(dd => {
                        dd.style.display = 'none';
                        dd.setAttribute('aria-expanded', 'false');
                    });
                });
                await page.waitForTimeout(500);
                console.log(`   ✅ Dropdowns anterior limpos`);
                
                // Encontrar o select pelo atributo name E data-value (para evitar duplicatas de ID)
                const tipoSelectByName = await ultimoRow.$('select[name="sub[boxTipoId][]"]');
                if (!tipoSelectByName) {
                    console.error(`   ❌ Select boxTipoId (name) não encontrado no row ${ultimoRowId}`);
                    throw new Error(`Select boxTipoId não encontrado no row: ${ultimoRowId}`);
                }
                
                console.log(`   ✅ Select encontrado pelo name="sub[boxTipoId][]"`);
                
                // ✅ VALIDAÇÃO: Verificar se o dropdown já está preenchido
                console.log(`   🔍 Verificando se dropdown já está preenchido...`);
                const valorAtual = await tipoSelectByName.evaluate((el) => {
                    return el.value;
                });
                
                if (valorAtual && valorAtual.trim() !== '') {
                    console.log(`   ⚠️ Dropdown já está preenchido com valor: "${valorAtual}"`);
                    console.log(`   ⏭️ Pulando! Campo já tem um valor, passando para próximo item...`);
                    await page.waitForTimeout(500);
                    continue;
                }
                
                console.log(`   ✅ Dropdown está vazio, procedendo com seleção...`);
                
                // Focar e abrir Select2 diretamente no elemento correto
                console.log(`   🎯 Abrindo Select2 para este row...`);
                
                // Focar e disparar focus
                await tipoSelectByName.focus();
                
                // Abrir Select2 usando jQuery API
                const openedOk = await tipoSelectByName.evaluate((el) => {
                    try {
                        if (typeof jQuery !== 'undefined' && jQuery(el).data('select2')) {
                            jQuery(el).select2('open');
                            return true;
                        }
                        return false;
                    } catch (e) {
                        console.warn('Erro ao abrir Select2:', e.message);
                        return false;
                    }
                });
                
                if (openedOk) {
                    console.log(`   ✅ Select2 aberto com sucesso!`);
                } else {
                    console.warn(`   ⚠️ Select2 não abriu...`);
                }
                
                // Aguardar para o Select2 abrir
                console.log(`   ⏳ Aguardando abertura...`);
                await page.waitForTimeout(1000);
                
                // Procurar o campo de busca
                console.log(`   ⏳ Aguardando campo de busca...`);
                let searchInput = null;
                try {
                    await page.waitForSelector('input.select2-search__field', { timeout: 3000 });
                    searchInput = await page.$('input.select2-search__field');
                    if (searchInput) {
                        console.log(`   ✅ Campo de busca encontrado!`);
                    }
                } catch (e) {
                    console.warn(`   ⚠️ Campo de busca não encontrado`);
                }
                
                if (searchInput) {
                    console.log(`   🔍 Digitando no campo: "${box.nome}"`);
                    
                    // Limpar e digitar
                    await searchInput.focus();
                    await searchInput.evaluate(el => el.value = '');
                    await page.waitForTimeout(100);
                    await searchInput.type(box.nome, { delay: 50 });
                    
                    console.log(`   ⏳ Aguardando filtro de resultados...`);
                    await page.waitForTimeout(2000);
                    console.log(`   ✅ Digitado com sucesso: "${box.nome}"`);
                }
                
                // Aguardar opções aparecerem
                console.log(`   ⏳ Aguardando opções...`);
                await page.waitForTimeout(1500);
                
                // Procurar opções do Select2
                console.log(`   🔎 Procurando opções...`);
                
                let options = [];
                try {
                    // Procurar dropdown visível
                    options = await page.$$('span.select2-dropdown:not([style*="display: none"]) li.select2-results__option');
                    console.log(`   📋 Opções encontradas: ${options.length}`);
                } catch (e) {
                    console.warn(`   ⚠️ Erro ao procurar opções: ${e.message}`);
                }
                
                let selecionou = false;
                if (options.length > 0) {
                    console.log(`   🔍 Procurando opção com Qtd > 0...`);
                    
                    for (let optIdx = 0; optIdx < options.length; optIdx++) {
                        const option = options[optIdx];
                        try {
                            const optionInfo = await option.evaluate(el => ({
                                text: el.textContent,
                                dataId: el.getAttribute('data-id')
                            }));
                            
                            const qtdMatch = optionInfo.text.match(/Qtd:\s*(\d+)/);
                            if (qtdMatch) {
                                const qtd = parseInt(qtdMatch[1], 10);
                                
                                if (qtd > 0) {
                                    console.log(`   ✅ Encontrada opção com Qtd = ${qtd}! Clicando...`);
                                    
                                    // Clicar na opção
                                    try {
                                        await option.click();
                                        console.log(`   ✅ Opção clicada!`);
                                        await page.waitForTimeout(1500);
                                        
                                        // Verificar se o valor foi selecionado
                                        const valorFinal = await tipoSelectByName.evaluate(el => el.value);
                                        console.log(`   🔍 Valor no select após clique: "${valorFinal}"`);
                                        
                                        if (valorFinal && valorFinal.trim() !== '') {
                                            console.log(`   ✅ Seleção confirmada!`);
                                            selecionou = true;
                                            break;
                                        } else {
                                            console.warn(`   ⚠️ Valor não foi selecionado, tentando API...`);
                                            // Tentar via API
                                            const apiOk = await tipoSelectByName.evaluate((el, optText) => {
                                                const options = el.querySelectorAll('option');
                                                for (let opt of options) {
                                                    if (opt.textContent.includes(optText.split('Qtd:')[0].trim())) {
                                                        if (typeof jQuery !== 'undefined') {
                                                            jQuery(el).val(opt.value).trigger('change');
                                                        } else {
                                                            el.value = opt.value;
                                                            el.dispatchEvent(new Event('change', { bubbles: true }));
                                                        }
                                                        return true;
                                                    }
                                                }
                                                return false;
                                            }, optionInfo.text);
                                            
                                            if (apiOk) {
                                                console.log(`   ✅ Seleção via API funcionou!`);
                                                await page.waitForTimeout(1000);
                                                selecionou = true;
                                                break;
                                            }
                                        }
                                    } catch (clickError) {
                                        console.warn(`   ⚠️ Erro ao clicar: ${clickError.message}`);
                                    }
                                }
                            }
                        } catch (optError) {
                            console.warn(`   ⚠️ Erro ao processar opção ${optIdx}`);
                        }
                    }
                } else {
                    console.warn(`   ⚠️ Nenhuma opção encontrada no dropdown`);
                }
                
                // Fechar Select2
                console.log(`   🔌 Fechando Select2...`);
                await tipoSelectByName.evaluate((el) => {
                    if (typeof jQuery !== 'undefined' && jQuery(el).data('select2')) {
                        try {
                            jQuery(el).select2('close');
                        } catch (e) {}
                    }
                });
                
                // Pressionar Escape para garantir fechamento
                console.log(`   ⌨️ Pressionando Escape...`);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
                
                // Aguardar o dropdown desaparecer completamente
                console.log(`   ⏳ Aguardando dropdown desaparecer...`);
                try {
                    await page.waitForSelector('span.select2-dropdown', { 
                        state: 'hidden',
                        timeout: 3000 
                    }).catch(() => null);
                } catch (e) {
                    // ignorar timeout
                }
                
                // Aguardar mais um pouco extra para garantir limpeza completa
                await page.waitForTimeout(1000);
                console.log(`   ✅ Select2 fechado completamente`);
                
                // Verificar se o dropdown realmente desapareceu
                const dropdownStillVisible = await page.$('span.select2-dropdown:visible');
                if (dropdownStillVisible) {
                    console.warn(`   ⚠️ Dropdown ainda pode estar visível, aguardando mais...`);
                    await page.waitForTimeout(1500);
                }
                
                console.log(`✅ [Item ${itemIndex}/${boxes.length}] Processado com sucesso!\n`);
                
                // Aguardar um pouco antes do próximo item
                await page.waitForTimeout(1000);
                
            } catch (itemError) {
                console.error(`❌ [Item ${itemIndex}/${boxes.length}] Erro: ${itemError.message}`);
                console.error(`   Stack: ${itemError.stack}`);
                throw itemError;
            }
        }
        
        // 7️⃣ Ocultando todos os rows processados ao final
        if (rowIdsProcessados.length > 0) {
            console.log(`\n🙈 Ocultando todos os ${rowIdsProcessados.length} rows processados...`);
            try {
                await page.evaluate((ids) => {
                    ids.forEach(id => {
                        const row = document.getElementById(id);
                        if (row) {
                            row.style.display = 'none';
                        }
                    });
                }, rowIdsProcessados);
                console.log(`   ✅ Todos os rows foram ocultados com sucesso`);
            } catch (hideError) {
                console.warn(`   ⚠️ Erro ao ocultar rows: ${hideError.message}`);
            }
            await page.waitForTimeout(500);
        }
        
        // 8️⃣ Mostrar todos os rows novamente ao final
        console.log(`\n👁️ Mostrando todos os items...`);
        await page.evaluate(() => {
            // Mostrar todos os rows
            const allRows = document.querySelectorAll('div.row[id^="line-box-"]');
            allRows.forEach(row => {
                row.style.display = '';
            });
        });
        await page.waitForTimeout(500);
        console.log(`✅ Todos os items estão visíveis!\n`);
        
        console.log(`✅ Todos os ${boxes.length} items foram adicionados com sucesso!\n`);
        
        // 9️⃣ Clicar em "Próximo" para ir para próxima etapa
        console.log(`\n➡️ Clicando em "Próximo"...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Próxima etapa iniciada!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em "Próximo": ${proximoError.message}`);
            throw proximoError;
        }
        
        // 🔟 Preencher formulário de Feedback
        console.log(`\n🔟 Preenchendo formulário de Feedback...`);
        try {
            await preencherFeedback(page);
            console.log(`✅ Feedback preenchido com sucesso!\n`);
        } catch (feedbackError) {
            console.error(`❌ Erro ao preencher Feedback: ${feedbackError.message}`);
            throw feedbackError;
        }
        
        // 1️⃣1️⃣ Clicar em "Salvar"
        console.log(`1️⃣1️⃣ Clicando em "Salvar"...`);
        try {
            await clicarSalvar(page);
            console.log(`✅ Salvar clicado com sucesso!\n`);
        } catch (salvarError) {
            console.error(`❌ Erro ao clicar em "Salvar": ${salvarError.message}`);
            throw salvarError;
        }
        
        // 1️⃣2️⃣ Extrair número da proposta
        console.log(`1️⃣2️⃣ Extraindo número da proposta...`);
        let numeroProposta = '';
        try {
            numeroProposta = await extrairNumeroProposta(page);
            console.log(`✅ Número de proposta extraído: ${numeroProposta}\n`);
        } catch (extraiError) {
            console.error(`❌ Erro ao extrair número da proposta: ${extraiError.message}`);
            console.log(`⚠️ Continuando mesmo assim...\n`);
        }
        
        // 1️⃣3️⃣ Navegar para página de contratos
        console.log(`1️⃣3️⃣ Navegando para página de contratos...`);
        try {
            await navegarParaContratos(page);
            console.log(`✅ Página de contratos carregada!\n`);
        } catch (navegarError) {
            console.error(`❌ Erro ao navegar para contratos: ${navegarError.message}`);
            throw navegarError;
        }
        
        // 1️⃣4️⃣ Selecionar proposta
        console.log(`1️⃣4️⃣ Selecionando proposta...`);
        try {
            if (numeroProposta) {
                await selecionarPropostaNaContratos(page, numeroProposta);
                console.log(`✅ Proposta selecionada com sucesso!\n`);
            } else {
                console.warn(`⚠️ Número de proposta não disponível, pulando seleção...`);
            }
        } catch (selectError) {
            console.error(`❌ Erro ao selecionar proposta: ${selectError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣4️⃣.5️⃣ Clicar em Próximo após selecionar proposta
        console.log(`1️⃣4️⃣.5️⃣ Clicando em Próximo após seleção da proposta...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Clicado em Próximo!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em Próximo: ${proximoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣5️⃣ Preencher dados do cliente
        console.log(`1️⃣5️⃣ Preenchendo dados do cliente no contrato...`);
        console.log(`   📋 Dados recebidos:`);
        console.log(`      • CPF: ${cpf ? `"${cpf}"` : 'NÃO FORNECIDO'}`);
        console.log(`      • EMAIL: ${email ? `"${email}"` : 'NÃO FORNECIDO'}`);
        console.log(`      • NASCIMENTO: ${data_nascimento ? `"${data_nascimento}"` : 'NÃO FORNECIDO'}`);
        console.log(`      • Sexo: ${sexo ? `"${sexo}"` : 'NÃO FORNECIDO'}`);
        console.log(`      • CEP: ${cep ? `"${cep}"` : 'NÃO FORNECIDO'}`);
        console.log(`      • Número: ${numero_endereco ? `"${numero_endereco}"` : 'NÃO FORNECIDO'}`);
        try {
            if (cpf || sexo || cep || numero_endereco) {
                await preencherDadosClienteContrato(page, cpf, sexo, cep, numero_endereco, data_nascimento, email);
                console.log(`✅ Dados do cliente preenchidos!\n`);
            } else {
                console.warn(`⚠️ Nenhum dado do cliente fornecido...`);
                console.log(`   💡 Para preencher os dados, forneça estes parâmetros no request:`);
                console.log(`      { "cpf": "12345678901", "sexo": "M", "cep": "12345000", "numero_endereco": "123" }`);
            }
        } catch (dadosError) {
            console.error(`❌ Erro ao preencher dados do cliente: ${dadosError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣6️⃣ Clicar em Próximo
        console.log(`1️⃣6️⃣ Clicando em Próximo...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Clicado em Próximo!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em Próximo: ${proximoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣7️⃣ Selecionar plano
        console.log(`1️⃣7️⃣ Selecionando plano...`);
        try {
            await selecionarPlanoEProxima(page);
            console.log(`✅ Plano selecionado com sucesso!\n`);
        } catch (planoError) {
            console.error(`❌ Erro ao selecionar plano: ${planoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣8️⃣ Clicar em Próximo
        console.log(`1️⃣8️⃣ Clicando em Próximo...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Clicado em Próximo!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em Próximo: ${proximoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 1️⃣9️⃣ Selecionar forma de pagamento
        console.log(`1️⃣9️⃣ Selecionando forma de pagamento...`);
        try {
            if (pagamento) {
                await selecionarPagamentoEProxima(page, pagamento);
                console.log(`✅ Forma de pagamento selecionada!\n`);
            } else {
                console.warn(`⚠️ Nenhuma forma de pagamento fornecida...`);
            }
        } catch (pagamentoError) {
            console.error(`❌ Erro ao selecionar forma de pagamento: ${pagamentoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 2️⃣0️⃣ Clicar em Próximo
        console.log(`2️⃣0️⃣ Clicando em Próximo...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Clicado em Próximo!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em Próximo: ${proximoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 2️⃣1️⃣ Preencher valor dos bens
        console.log(`2️⃣1️⃣ Preenchendo valor dos bens...`);
        try {
            if (valorBens) {
                await preencherValorBensEProxima(page, valorBens);
                console.log(`✅ Valor dos bens preenchido!\n`);
            } else {
                console.warn(`⚠️ Nenhum valor de bens fornecido...`);
            }
        } catch (valorError) {
            console.error(`❌ Erro ao preencher valor dos bens: ${valorError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 2️⃣2️⃣ Clicar em Próximo
        console.log(`2️⃣2️⃣ Clicando em Próximo...`);
        try {
            await clicarProximo(page);
            console.log(`✅ Clicado em Próximo!\n`);
        } catch (proximoError) {
            console.error(`❌ Erro ao clicar em Próximo: ${proximoError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // 2️⃣3️⃣ Clicar em "Salvar"
        console.log(`2️⃣3️⃣ Clicando em "Salvar"...`);
        let urlFinal = null;
        try {
            await clicarSalvar(page);
            console.log(`✅ Contrato salvo com sucesso!\n`);
            
            // Capturar URL da página após salvar
            console.log(`2️⃣4️⃣ Capturando URL final...`);
            await page.waitForTimeout(2000); // Aguardar a página carregar completamente
            urlFinal = page.url();
            console.log(`✅ URL capturada: ${urlFinal}\n`);
            
        } catch (salvarError) {
            console.error(`❌ Erro ao clicar em "Salvar": ${salvarError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        // Retornar resultado com URL final
        return {
            success: true,
            message: 'Contrato criado com sucesso!',
            urlFinal: urlFinal
        };
        
    } catch (error) {
        console.error(`\n❌ ERRO ao adicionar items de boxes:`);
        console.error('Mensagem:', error.message);
        throw error;
    }
}

/**
 * Calcular data para próximo contato (3 dias após hoje, ajustado para segunda se cair no fim de semana)
 * @returns {string} Data formatada como DD/MM/YYYY
 */
function calcularProximoContato() {
    const hoje = new Date();
    const proxima = new Date(hoje);
    proxima.setDate(proxima.getDate() + 3);
    
    // Verificar se caiu no fim de semana (0 = domingo, 6 = sábado)
    const diaSemana = proxima.getDay();
    
    // Se for domingo (0), adicionar 1 dia (segunda)
    if (diaSemana === 0) {
        proxima.setDate(proxima.getDate() + 1);
    }
    // Se for sábado (6), adicionar 2 dias (segunda)
    else if (diaSemana === 6) {
        proxima.setDate(proxima.getDate() + 2);
    }
    
    // Formatar como DD/MM/YYYY
    const dia = String(proxima.getDate()).padStart(2, '0');
    const mes = String(proxima.getMonth() + 1).padStart(2, '0');
    const ano = proxima.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
}

/**
 * Preencher formulário de Feedback
 * @param {Object} page - Página do Playwright
 */
async function preencherFeedback(page) {
    try {
        console.log('\n📋 Preenchendo formulário de Feedback...');
        
        // Aguardar os campos aparecerem E ficarem visíveis
        console.log('⏳ Aguardando formulário de Feedback ficar visível...');
        await page.waitForFunction(() => {
            const element = document.querySelector('select[name="feedBackMeioId"]');
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }, { timeout: 10000 });
        console.log('✅ Formulário de Feedback encontrado e visível');
        
        // Scroll para o elemento para garantir que está visível
        await page.evaluate(() => {
            const element = document.querySelector('select[name="feedBackMeioId"]');
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await page.waitForTimeout(500);
        
        // 1️⃣ Selecionar "Meio de contato"
        console.log(`   [1] Selecionando Meio de contato: TELEFONE...`);
        await page.evaluate(() => {
            const select = document.querySelector('select[name="feedBackMeioId"]');
            if (select) {
                select.value = '3'; // 1 = TELEFONE
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        });
        console.log(`   ✅ Meio de contato selecionado`);
        await page.waitForTimeout(500);
        
        // 2️⃣ Selecionar "Chances"
        console.log(`   [2] Selecionando Chances: 80%...`);
        await page.evaluate(() => {
            const select = document.querySelector('select[name="feedBackChances"]');
            if (select) {
                select.value = '80';
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        });
        console.log(`   ✅ Chances selecionadas`);
        await page.waitForTimeout(500);
        
        // 3️⃣ Preencher "Próximo Contato" (usando a mesma estratégia do preencherPrevisaoEntrada)
        const dataProximo = calcularProximoContato();
        console.log(`   [3] Preenchendo Próximo Contato: ${dataProximo}...`);
        
        // Converter DD/MM/YYYY para YYYY-MM-DD
        const [dia, mes, ano] = dataProximo.split('/');
        const dataFormatada = `${ano}-${mes}-${dia}`;
        
        // Preencher via JavaScript (contornando o readonly do datepicker)
        await page.evaluate((args) => {
            const input = document.querySelector(args.selector);
            if (input) {
                // Definir o valor
                input.value = args.data;
                // Disparar eventos de mudança
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, { selector: 'input[name="feedBackRetornar"]', data: dataFormatada });
        
        console.log(`   ✅ Próximo Contato preenchido: ${dataProximo}`);
        await page.waitForTimeout(500);
        
        // 4️⃣ Preencher "Comentário / Negociação"
        console.log(`   [4] Preenchendo Comentário...`);
        await page.evaluate(() => {
            const textarea = document.querySelector('textarea[name="feedBackResposta"]');
            if (textarea) {
                textarea.value = 'Proposta enviada. Aguardando retorno do cliente.';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                textarea.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        });
        console.log(`   ✅ Comentário preenchido`);
        await page.waitForTimeout(500);
        
        console.log(`✅ Feedback preenchido com sucesso!\n`);
        
    } catch (error) {
        console.error(`\n❌ Erro ao preencher Feedback:`, error.message);
        throw error;
    }
}

/**
 * Clicar no botão "Salvar"
 * @param {Object} page - Página do Playwright
 */
async function clicarSalvar(page) {
    try {
        console.log('\n💾 Procurando botão "Salvar"...');
        
        // 🔍 DIAGNÓSTICO INICIAL
        console.log('🔍 Executando diagnóstico da página...');
        
        // Capturar logs do navegador
        const logsPagina = await capturarLogsDaPagina(page);
        
        // Verificar elementos bloqueados
        const elementosBloqueados = await diagnosticarElementosBloqueados(page);
        if (elementosBloqueados.length > 0) {
            console.warn('⚠️ Elementos bloqueados/desabilitados encontrados:');
            elementosBloqueados.forEach(el => {
                console.warn(`   - ${el.tipo}: ${el.motivo}`);
                if (el.id) console.warn(`     ID: ${el.id}`);
                if (el.class) console.warn(`     Class: ${el.class}`);
            });
        } else {
            console.log('✅ Nenhum elemento bloqueado detectado');
        }
        
        // 1️⃣ Validar estado da página antes de salvar
        console.log('🔍 Validando estado da formulário...');
        const validacaoFormulario = await page.evaluate(() => {
            const validacoes = {
                temErros: false,
                erros: [],
                temCamposVazios: false,
                camposVazios: []
            };
            
            // Procurar por mensagens de erro
            const erros = document.querySelectorAll('[class*="error"], .text-danger, [role="alert"]');
            if (erros.length > 0) {
                validacoes.temErros = true;
                erros.forEach(el => {
                    validacoes.erros.push(el.textContent.trim());
                });
            }
            
            // Procurar por campos obrigatórios não preenchidos
            const inputs = document.querySelectorAll('input[required], textarea[required], select[required]');
            inputs.forEach(input => {
                if (!input.value || input.value.trim() === '') {
                    validacoes.temCamposVazios = true;
                    validacoes.camposVazios.push(input.name || input.id || input.className);
                }
            });
            
            return validacoes;
        });
        
        if (validacaoFormulario.temErros) {
            console.warn('⚠️ Erros encontrados no formulário:');
            validacaoFormulario.erros.forEach(err => console.warn(`   - ${err}`));
        }
        
        if (validacaoFormulario.temCamposVazios) {
            console.warn('⚠️ Campos vazios encontrados:');
            validacaoFormulario.camposVazios.forEach(campo => console.warn(`   - ${campo}`));
        }
        
        // 2️⃣ Fechar modais antes de tentar salvar
        console.log('🔔 Verificando modais...');
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            const tinhaModal = await verificarEFecharModaisAbertos(page);
            if (tinhaModal) {
                console.log(`🔄 Modal detectado e fechado (tentativa ${tentativa + 1})`);
                await page.waitForTimeout(1500);
            } else {
                break; // Sem modais
            }
        }
        
        // 3️⃣ Capturar URL atual para comparar depois
        const urlAntes = page.url();
        console.log(`📍 URL antes de salvar: ${urlAntes}`);
        
        // 4️⃣ Fazer scroll para o botão
        console.log('📍 Scrollando para o elemento "Salvar"...');
        await page.evaluate(() => {
            const el = document.querySelector('a[href="#finish"]');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        await page.waitForTimeout(1000);
        
        // 5️⃣ Verificar visibilidade final do botão
        const botaoVisivel = await page.evaluate(() => {
            const btn = document.querySelector('a[href="#finish"]');
            if (!btn) return false;
            
            const style = window.getComputedStyle(btn);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
        
        console.log(`🔎 Botão "Salvar" visível: ${botaoVisivel ? '✅ Sim' : '⚠️ Não (mas tentando)'}`);
        
        // 6️⃣ Clicar no botão com múltiplas tentativas
        let clickSucesso = false;
        const tentativasClick = 3;
        
        for (let i = 0; i < tentativasClick; i++) {
            try {
                console.log(`🖱️ Tentativa ${i + 1}/${tentativasClick} - Clicando no botão...`);
                
                // Tentar verificar novamente se há modal
                await verificarEFecharModaisAbertos(page);
                
                const botaoSalvar = await page.$('a[href="#finish"]');
                if (!botaoSalvar) {
                    console.warn(`   ⚠️ Botão não encontrado na tentativa ${i + 1}`);
                    await page.waitForTimeout(800);
                    continue;
                }
                
                // Tentar click normal
                try {
                    await botaoSalvar.click({ timeout: 5000 });
                    console.log(`   ✅ Click bem-sucedido na tentativa ${i + 1}!`);
                    clickSucesso = true;
                    break;
                } catch (clickNormalError) {
                    console.warn(`   ⚠️ Click normal falhou: ${clickNormalError.message}`);
                    
                    // Fallback: JavaScript direto
                    console.log(`   🔧 Tentando com JavaScript...`);
                    await botaoSalvar.evaluate(el => {
                        el.click();
                    });
                    console.log(`   ✅ JavaScript click executado`);
                    clickSucesso = true;
                    break;
                }
            } catch (erro) {
                console.warn(`   ❌ Tentativa ${i + 1} falhou: ${erro.message}`);
                if (i < tentativasClick - 1) {
                    await page.waitForTimeout(1200);
                }
            }
        }
        
        if (!clickSucesso) {
            throw new Error('Não foi possível clicar no botão "Salvar" após múltiplas tentativas');
        }
        
        console.log('✅ Clique no botão "Salvar" realizado!');
        
        // 7️⃣ Aguardar reação da página
        console.log('⏳ Aguardando resposta da página após clique...');
        await page.waitForTimeout(2000);
        
        // 8️⃣ Tentar detectar sucesso
        let urlDepois = page.url();
        let urlMudou = urlAntes !== urlDepois;
        
        console.log(`📍 URL depois de salvar: ${urlDepois}`);
        console.log(`📊 URL mudou: ${urlMudou ? '✅ Sim' : '⚠️ Não'}`);
        
        // 9️⃣ Aguardar o carregamento da página
        console.log('⏳ Aguardando página carregar...');
        try {
            await page.waitForLoadState('load', { timeout: 20000 });
            console.log('✅ Página carregou!');
        } catch (loadError) {
            console.warn(`⚠️ Timeout ao aguardar carga: ${loadError.message}`);
        }
        
        await page.waitForTimeout(3000);
        
        // 1️⃣0️⃣ Verificação final
        urlDepois = page.url();
        urlMudou = urlAntes !== urlDepois;
        
        console.log(`\n📊 RESULTADO FINAL DO CLIQUE "${clicarSalvar.name}"`);
        console.log(`   URL antes: ${urlAntes}`);
        console.log(`   URL depois: ${urlDepois}`);
        console.log(`   URL mudou: ${urlMudou ? '✅ Sim' : '⚠️ Não'}`);
        console.log(`   Erros na página: ${validacaoFormulario.temErros ? '⚠️ Sim' : '✅ Não'}`);
        console.log(`\n`)
        
    } catch (error) {
        console.error(`❌ Erro ao clicar em "Salvar":`, error.message);
        // NÃO lançar erro, apenas logar - a automação pode continuar
        console.log('⚠️ Continuando mesmo com erro...');
    }
}

/**
 * Extrair o número da proposta do heading da página
 * @param {Object} page - Página do Playwright
 * @returns {string} O número da proposta (ex: "01768")
 */
async function extrairNumeroProposta(page) {
    try {
        console.log('\n🔍 Extraindo número da proposta...');
        
        // Aguardar o elemento estar presente
        console.log('⏳ Aguardando elemento com número da proposta...');
        try {
            await page.waitForFunction(() => {
                const element = document.querySelector('span.caption-subject');
                return element && element.textContent && element.textContent.includes('Proposta');
            }, { timeout: 5000 });
            console.log('✅ Elemento com a proposta encontrado!');
        } catch (e) {
            console.warn('⚠️ Timeout aguardando elemento, tentando mesmo assim...');
        }
        
        // Estratégia 1: Seletor específico (mais preciso)
        console.log('📍 Estratégia 1: Procurando «span.caption-subject»...');
        let numeroProposta = await page.evaluate(() => {
            const element = document.querySelector('span.caption-subject.font-blue-sharp');
            if (element) {
                const texto = element.textContent.trim();
                console.log(`   Texto encontrado: "${texto}"`);
                
                const match = texto.match(/\((\d+)\)/);
                if (match && match[1]) {
                    console.log(`   ✅ Número extraído: ${match[1]}`);
                    return match[1];
                }
            }
            return null;
        });
        
        if (numeroProposta) {
            console.log(`✅ Número da proposta (Estratégia 1): ${numeroProposta}`);
            return numeroProposta;
        }
        
        // Estratégia 2: Seletor menos específico
        console.log('📍 Estratégia 2: Procurando «span.caption-subject» (qualquer uma)...');
        numeroProposta = await page.evaluate(() => {
            const elements = document.querySelectorAll('span.caption-subject');
            console.log(`   Elementos encontrados: ${elements.length}`);
            
            for (let el of elements) {
                const texto = el.textContent.trim();
                if (texto.includes('Proposta')) {
                    console.log(`   Testando: "${texto.substring(0, 100)}"`);
                    const match = texto.match(/\((\d+)\)/);
                    if (match && match[1]) {
                        console.log(`   ✅ Encontrado: ${match[1]}`);
                        return match[1];
                    }
                }
            }
            return null;
        });
        
        if (numeroProposta) {
            console.log(`✅ Número da proposta (Estratégia 2): ${numeroProposta}`);
            return numeroProposta;
        }
        
        // Estratégia 3: Buscar em toda a página por padrão
        console.log('📍 Estratégia 3: Busca global por padrão «(número)»...');
        numeroProposta = await page.evaluate(() => {
            // Procurar em todos os elementos de texto
            const allElements = document.querySelectorAll('*');
            
            for (let el of allElements) {
                // Apenas elementos com texto direto (não considerar elementos com filhos)
                if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
                    const texto = el.textContent.trim();
                    
                    // Procurar padrão (números)
                    if (/\(\d+\)/.test(texto)) {
                        // Priorizar se contiver "Proposta"
                        if (texto.includes('Proposta') || texto.includes('proposta')) {
                            const match = texto.match(/\((\d+)\)/);
                            if (match && match[1]) {
                                console.log(`   ✅ Encontrado em elemento de texto: ${match[1]}`);
                                return match[1];
                            }
                        }
                    }
                }
            }
            return null;
        });
        
        if (numeroProposta) {
            console.log(`✅ Número da proposta (Estratégia 3): ${numeroProposta}`);
            return numeroProposta;
        }
        
        // Estratégia 4: Usar regex em todo o corpo da página
        console.log('📍 Estratégia 4: Busca em todo o HTML por padrão «(número)»...');
        numeroProposta = await page.evaluate(() => {
            const html = document.documentElement.innerHTML;
            
            // Procurar padrão Proposta (número)
            let match = html.match(/Proposta[^)]*\((\d+)\)/i);
            if (match && match[1]) {
                console.log(`   ✅ Encontrado no HTML: ${match[1]}`);
                return match[1];
            }
            
            // Fallback: procurar qualquer número entre parênteses (5+ dígitos)
            match = html.match(/\((\d{5,})\)/);
            if (match && match[1]) {
                console.log(`   ⚠️ Número entre parênteses: ${match[1]}`);
                return match[1];
            }
            
            return null;
        });
        
        if (numeroProposta) {
            console.log(`✅ Número da proposta (Estratégia 4): ${numeroProposta}`);
            return numeroProposta;
        }
        
        // Estratégia 5: Dump completo para debug
        console.log('📍 Estratégia 5: Dump de todas as spans com "caption-subject"...');
        const allSpans = await page.evaluate(() => {
            const spans = document.querySelectorAll('span.caption-subject');
            const results = [];
            
            spans.forEach((span, idx) => {
                results.push({
                    index: idx,
                    text: span.textContent.trim().substring(0, 150),
                    classes: span.className,
                    html: span.outerHTML.substring(0, 200)
                });
            });
            
            return results;
        });
        
        if (allSpans && allSpans.length > 0) {
            console.log(`   📋 Spans encontradas:`);
            allSpans.forEach((span, idx) => {
                console.log(`      [${idx}] ${span.text}`);
                console.log(`          Classes: ${span.classes}`);
            });
        } else {
            console.log('   ℹ️ Nenhuma span com classe "caption-subject" encontrada');
        }
        
        // Se chegou aqui sem encontrar, retornar fallback
        console.warn('⚠️ Não foi possível extrair número da proposta após todas as estratégias');
        console.log('   Retornando "0" como fallback');
        return '0';
        
    } catch (error) {
        console.error(`❌ Erro ao extrair número da proposta:`, error.message);
        console.warn('⚠️ Retornando "0" como fallback');
        return '0';
    }
}

/**
 * Navegar para a página de adição de contratos
 * @param {Object} page - Página do Playwright
 */
async function navegarParaContratos(page) {
    try {
        console.log('\n🌐 Navegando para página de contratos...');
        
        const targetUrl = 'https://app.prismabox.com.br/contract/add';
        console.log(`📍 URL destino: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        console.log('⏳ Aguardando página carregar...');
        
        // Aguardar o select de proposta carregar
        try {
            await page.waitForSelector('#propostaId', { timeout: 15000 });
            console.log('✅ Página de contratos carregada com sucesso!');
        } catch (e) {
            console.warn('⚠️ Select de proposta não encontrado, mas continuando...');
        }
        
        // Aguardar o Select2 ser inicializado
        await page.waitForTimeout(2000);
        
    } catch (error) {
        console.error(`❌ Erro ao navegar para contratos:`, error.message);
        throw error;
    }
}

/**
 * Selecionar a proposta no dropdown de contratos
 * @param {Object} page - Página do Playwright
 * @param {string} numeroProposta - Número da proposta a selecionar
 */
async function selecionarPropostaNaContratos(page, numeroProposta) {
    try {
        console.log(`\n📋 Selecionando proposta: ${numeroProposta}`);
        
        // Aguardar o select estar disponível
        console.log('⏳ Aguardando select de proposta (#propostaId)...');
        await page.waitForSelector('#propostaId', { timeout: 10000 });
        console.log('✅ Select de proposta encontrado');
        
        // Obter o elemento do select
        const propostaSelect = await page.$('#propostaId');
        if (!propostaSelect) {
            throw new Error('Select de proposta não encontrado');
        }
        
        // Abrir Select2 usando a API jQuery (evita problemas de clique bloqueado)
        console.log('🎯 Abrindo Select2 via API jQuery...');
        await page.evaluate(() => {
            if (typeof jQuery !== 'undefined') {
                jQuery('#propostaId').select2('open');
            }
        });
        
        await page.waitForTimeout(800);
        
        // Aguardar o campo de busca ficar visível
        console.log('🔍 Aguardando campo de busca aparecer...');
        await page.waitForFunction(() => {
            const searchInput = document.querySelector('input.select2-search__field');
            if (!searchInput) return false;
            
            const style = window.getComputedStyle(searchInput);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }, { timeout: 5000 });
        
        console.log('✅ Campo de busca está visível!');
        
        // Obter o input de busca
        const searchInput = await page.$('input.select2-search__field');
        if (!searchInput) {
            throw new Error('Campo de busca não encontrado');
        }
        
        // Digitar o número da proposta
        console.log(`💬 Digitando número da proposta: ${numeroProposta}`);
        await searchInput.focus();
        await searchInput.type(numeroProposta, { delay: 50 });
        
        // Dispatcher os eventos para trigger a busca no Select2
        console.log('📡 Disparando eventos para triggar busca no Select2...');
        await searchInput.evaluate(el => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
        });
        
        // Aguardar os resultados da busca
        console.log('⏳ Aguardando resultados da busca...');
        await page.waitForTimeout(2000);
        
        // Procurar e clicar na opção correta
        console.log('🔎 Procurando opção com o número da proposta...');
        
        const options = await page.$$('li.select2-results__option');
        console.log(`📋 Opções encontradas: ${options.length}`);
        
        if (options.length === 0) {
            throw new Error('Nenhuma opção encontrada para a proposta');
        }
        
        let optionSelecionada = null;
        
        // Procurar opção que contém o número da proposta
        for (let option of options) {
            const text = await option.textContent();
            console.log(`   Verificando opção: "${text.trim()}"`);
            
            // Pular mensagens padrão
            if (text.includes('Digite') || text.includes('Selecione')) {
                continue;
            }
            
            // Verificar se contém o número ou é a primeira opção válida
            if (text.includes(numeroProposta) || !optionSelecionada) {
                optionSelecionada = option;
                console.log(`   ✅ Encontrada opção!`);
                if (text.includes(numeroProposta)) break;
            }
        }
        
        if (!optionSelecionada) {
            throw new Error(`Nenhuma opção válida encontrada para proposta ${numeroProposta}`);
        }
        
        // Clicar na opção
        console.log('🖱️ Clicando na opção encontrada...');
        await optionSelecionada.click();
        
        await page.waitForTimeout(1000);
        
        // Verificar se foi selecionado
        const valorSelecionado = await propostaSelect.evaluate(el => el.value);
        console.log(`✅ Valor selecionado no select: ${valorSelecionado}`);
        
        if (!valorSelecionado) {
            throw new Error('Proposta não foi selecionada no select');
        }
        
        console.log(`✅ Proposta ${numeroProposta} selecionada com sucesso!\n`);
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar proposta:`, error.message);
        throw error;
    }
}

/**
 * Preencher valor dos bens e clicar em Próximo
 * @param {Object} page - Página do Playwright
 * @param {string|number} valorBens - Valor dos bens (ex: "5000.00" ou 5000)
 */
async function preencherValorBensEProxima(page, valorBens) {
    try {
        console.log(`\n💰 Preenchendo valor dos bens...`);
        
        if (!valorBens) {
            console.warn('⚠️ Nenhum valor de bens fornecido, pulando...');
            return;
        }
        
        // Aguardar o input estar disponível NO DOM (NÃO aguardar visibilidade - pode estar hidden)
        console.log('⏳ Aguardando input de valor dos bens (#contratoValorDosBens) no DOM...');
        let elementEncontrado = false;
        
        // Tentar encontrar o elemento sem exigir visibilidade
        for (let i = 0; i < 5; i++) {
            const elemento = await page.$('#contratoValorDosBens');
            if (elemento) {
                console.log('✅ Input de valor dos bens encontrado no DOM');
                elementEncontrado = true;
                break;
            }
            console.log(`   🔄 Tentativa ${i + 1}/5 - aguardando...`);
            await page.waitForTimeout(1000);
        }
        
        if (!elementEncontrado) {
            console.error('❌ Input #contratoValorDosBens não encontrado no DOM após múltiplas tentativas!');
            throw new Error('Input #contratoValorDosBens não encontrado no DOM');
        }
        
        // Fazer scroll para o elemento (funciona mesmo que hidden)
        console.log('📍 Scrollando para o elemento de valor dos bens...');
        await page.evaluate(() => {
            const el = document.querySelector('#contratoValorDosBens');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        await page.waitForTimeout(800);
        
        // Converter valor para string se for número
        const valorFormatado = String(valorBens).replace(/\./g, '').replace(',', '.');
        console.log(`📝 Preenchendo com valor: ${valorFormatado}`);
        
        // Usar JavaScript direto para preencher (funciona com elementos ocultos/hidden)
        const preenchidoOk = await page.evaluate((valor) => {
            const input = document.querySelector('#contratoValorDosBens');
            if (!input) {
                console.warn('Input não encontrado no evaluate');
                return false;
            }
            
            // Remover readonly temporariamente se existir
            const wasReadonly = input.readOnly;
            input.readOnly = false;
            
            // Preencher o valor
            input.value = valor;
            
            // Disparar eventos para a aplicação processar a mudança
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Restaurar readonly
            if (wasReadonly) input.readOnly = true;
            
            return true;
        }, valorFormatado);
        
        if (!preenchidoOk) {
            console.warn('⚠️ Falha ao preencher valor via JavaScript');
        }
        
        await page.waitForTimeout(800);
        
        // Verificar o valor preenchido
        const valorVerificado = await page.evaluate(() => {
            const input = document.querySelector('#contratoValorDosBens');
            return input ? input.value : 'não encontrado';
        });
        console.log(`✅ Valor preenchido: ${valorVerificado}`);
        
        // Selecionar o índice "IPCA TRIMESTRAL"
        console.log(`📊 Selecionando índice: IPCA TRIMESTRAL...`);
        try {
            // Tentar encontrar sem exigir visibilidade
            let indiceEncontrado = false;
            for (let i = 0; i < 3; i++) {
                const element = await page.$('#indiceId');
                if (element) {
                    console.log('✅ Select de índice encontrado no DOM');
                    indiceEncontrado = true;
                    break;
                }
                await page.waitForTimeout(500);
            }
            
            if (indiceEncontrado) {
                // Selecionar IPCA TRIMESTRAL (value="150")
                const selecionadoOk = await page.evaluate(() => {
                    const select = document.querySelector('#indiceId');
                    if (select) {
                        select.value = '150';
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        select.dispatchEvent(new Event('blur', { bubbles: true }));
                        return true;
                    }
                    return false;
                });
                
                if (selecionadoOk) {
                    console.log('✅ Índice IPCA TRIMESTRAL selecionado');
                } else {
                    console.warn('⚠️ Falha ao selecionar índice via JavaScript');
                }
            } else {
                console.warn('⚠️ Select de índice não encontrado no DOM');
            }
            
            await page.waitForTimeout(500);
        } catch (indiceError) {
            console.warn(`⚠️ Erro ao selecionar índice: ${indiceError.message}`);
            console.log(`⚠️ Continuando mesmo assim...`);
        }
        
        console.log(`✅ Valor dos bens preenchido com sucesso!\n`);
        
    } catch (error) {
        console.error(`❌ Erro ao preencher valor dos bens:`, error.message);
        throw error;
    }
}

/**
 * Selecionar forma de pagamento/carteira e clicar em Próximo
 * @param {Object} page - Página do Playwright
 * @param {string} pagamento - ID ou nome da forma de pagamento (ex: "6009" ou "PIX")
 */
async function selecionarPagamentoEProxima(page, pagamento) {
    try {
        console.log(`\n💳 Selecionando forma de pagamento...`);
        
        if (!pagamento) {
            console.warn('⚠️ Nenhuma forma de pagamento fornecida, pulando...');
            return;
        }
        
        // NÃO aguardar visibilidade! Select2 mantém o select oculto e mostra um dropdown customizado
        console.log('⏳ Procurando select de pagamento (#carteiraSubId)...');
        const carteiraSelectElement = await page.$('#carteiraSubId');
        if (!carteiraSelectElement) {
            console.error('❌ Select #carteiraSubId não encontrado!');
            throw new Error('Select #carteiraSubId não encontrado na página');
        }
        console.log('✅ Select de pagamento encontrado (oculto por Select2)');
        
        // Scroll para o dropdown (usar a versão visível do Select2)
        console.log('📍 Scrollando para o dropdown customizado...');
        await page.evaluate(() => {
            const el = document.querySelector('span.select2-container');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        await page.waitForTimeout(800);
        
        // Tentar usar a API Select2 diretamente
        console.log(`\n📍 Tentando selecionar forma de pagamento: ${pagamento}`);
        
        // Primeiro, listar as opções disponíveis
        const options = await page.evaluate(() => {
            const select = document.querySelector('#carteiraSubId');
            if (!select) return [];
            
            const opts = [];
            for (let option of Array.from(select.options)) {
                if (option.value) {
                    opts.push({
                        value: option.value,
                        text: option.textContent.trim()
                    });
                }
            }
            return opts;
        });
        
        console.log(`📋 Opções disponíveis: ${options.length}`);
        options.forEach(opt => console.log(`   - ${opt.text} (${opt.value})`));
        
        // Procurar correspondência por valor exato ou por texto
        let matchedValue = null;
        
        // Tentar por valor exato primeiro
        if (options.find(opt => opt.value === pagamento)) {
            matchedValue = pagamento;
            console.log(`✅ Encontrada correspondência exata por valor: ${pagamento}`);
        } else {
            // Tentar por texto (case-insensitive)
            const match = options.find(opt => 
                opt.text.toUpperCase().includes(pagamento.toUpperCase())
            );
            if (match) {
                matchedValue = match.value;
                console.log(`✅ Encontrada correspondência por texto: "${match.text}"`);
            }
        }
        
        if (matchedValue) {
            console.log(`🎯 Selecionando via JavaScript direto...`);
            await page.evaluate((valor) => {
                const select = document.querySelector('#carteiraSubId');
                if (select) {
                    select.value = valor;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Disparar evento Select2 se disponível
                    if (typeof jQuery !== 'undefined') {
                        try {
                            jQuery(select).trigger('change');
                        } catch (e) {}
                    }
                }
            }, matchedValue);
            
            console.log(`✅ Forma de pagamento selecionada!`);
            await page.waitForTimeout(1000);
            return;
        }
        
        console.warn(`⚠️ Forma de pagamento "${pagamento}" não encontrada por correspondência exata`);
        console.log(`🔍 Tentando abrir Select2 e buscar manualmente...`);
        
        
        // Limpar dropdowns anteriores
        console.log('🧹 Limpando dropdowns anteriores...');
        await page.evaluate(() => {
            if (typeof jQuery !== 'undefined') {
                jQuery('select').each(function() {
                    try {
                        if (jQuery(this).data('select2')) {
                            jQuery(this).select2('close');
                        }
                    } catch (e) {}
                });
            }
            
            // Remover dropdowns visíveis
            const dropdowns = document.querySelectorAll('span.select2-dropdown');
            dropdowns.forEach(dd => dd.remove());
        });
        
        await page.waitForTimeout(500);
        
        // Abrir Select2 para a carteira
        console.log('🎯 Abrindo Select2 da carteira...');
        const carteiraSelect = await page.$('#carteiraSubId');
        if (!carteiraSelect) {
            throw new Error('Select de pagamento não encontrado');
        }
        
        const openedOk = await carteiraSelect.evaluate((el) => {
            try {
                if (typeof jQuery !== 'undefined' && jQuery(el).data('select2')) {
                    jQuery(el).select2('open');
                    return true;
                }
                return false;
            } catch (e) {
                return false;
            }
        });
        
        if (openedOk) {
            console.log('✅ Select2 aberto!');
        } else {
            console.warn('⚠️ Falha ao abrir Select2 via jQuery');
        }
        
        
        // Aguardar campo de busca aparecer
        console.log('⏳ Aguardando campo de busca do Select2...');
        try {
            await page.waitForFunction(() => {
                const input = document.querySelector('input.select2-search__field');
                return input && window.getComputedStyle(input).display !== 'none';
            }, { timeout: 3000 });
            console.log('✅ Campo de busca está visível!');
        } catch (e) {
            console.warn('⚠️ Campo de busca não apareceu, tentando mesmo assim...');
        }
        
        // Procurar e clicar na primeira opção que contém o texto
        console.log(`🔎 Procurando opção com: "${pagamento}"`);
        let optionFound = false;
        
        try {
            optionFound = await page.evaluate((searchText) => {
                const dropdown = document.querySelector('span.select2-dropdown');
                if (!dropdown) {
                    console.error('❌ Dropdown não visível');
                    return false;
                }
                
                // Procurar por qualquer opção que contenha o texto
                const options = Array.from(dropdown.querySelectorAll('li.select2-results__option'));
                console.log(`📋 Opções encontradas no dropdown: ${options.length}`);
                
                for (let option of options) {
                    const text = option.textContent.trim();
                    console.log(`   - Verificando: "${text}"`);
                    
                    // Pular labels de grupos/mensagens vazias
                    if (text === '' || text.startsWith('Digite') || text.startsWith('Selecione')) {
                        continue;
                    }
                    
                    // Se contém o texto procurado (case-insensitive)
                    if (text.toUpperCase().includes(searchText.toUpperCase())) {
                        console.log(`✅ Encontrada correspondência!`);
                        
                        // Scroll para visibilidade
                        option.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        
                        // Aguardar renderização
                        setTimeout(() => {}, 100);
                        
                        // Clicar
                        option.click();
                        
                        return true;
                    }
                }
                
                console.error(`❌ Nenhuma opção encontrada contendo "${searchText}"`);
                return false;
            }, pagamento);
            
            if (optionFound) {
                console.log('✅ Opção selecionada com sucesso!');
                await page.waitForTimeout(1000);
            } else {
                throw new Error(`Opção "${pagamento}" não encontrada no dropdown`);
            }
        } catch (e) {
            console.error(`❌ Erro ao selecionar opção: ${e.message}`);
            throw e;
        }
        
        
        // Fechar Select2
        console.log('🔌 Fechando Select2...');
        await carteiraSelect.evaluate((el) => {
            if (typeof jQuery !== 'undefined' && jQuery(el).data('select2')) {
                try {
                    jQuery(el).select2('close');
                } catch (e) {}
            }
        });
        
        console.log(`✅ Forma de pagamento selecionada com sucesso!\n`);
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar forma de pagamento:`, error.message);
        throw error;
    }
}

/**
 * Selecionar o plano e clicar em Próximo
 * @param {Object} page - Página do Playwright
 * @param {string} planoId - ID do plano a selecionar (opcional, usa primeira opção se não fornecido)
 */
async function selecionarPlanoEProxima(page, planoId = '3') {
    try {
        console.log(`\n📋 Selecionando plano...`);
        
        // Aguardar o select estar disponível E visível
        console.log('⏳ Aguardando select de plano (#planoId) ficar visível...');
        try {
            await page.waitForFunction(() => {
                const elem = document.querySelector('#planoId');
                if (!elem) return false;
                
                // Verificar se o elemento está visível (não hidden, display:none, etc)
                const style = window.getComputedStyle(elem);
                const isVisible = style.display !== 'none' && 
                                style.visibility !== 'hidden' && 
                                style.opacity !== '0';
                
                // Também verificar se não tem aria-hidden
                const isAccessible = elem.getAttribute('aria-hidden') !== 'true';
                
                return isVisible || isAccessible; // Se acessível via API, pode usar
            }, { timeout: 15000 });
            
            console.log('✅ Select de plano está pronto!');
        } catch (e) {
            console.error('❌ Select #planoId não ficou pronto no tempo esperado!');
            throw e;
        }
        
        // Tentar usar selectOption primeiro
        console.log(`📍 Tentando selecionar plano com ID: ${planoId}`);
        try {
            await page.selectOption('#planoId', planoId);
            console.log(`✅ Plano selecionado com sucesso!`);
            await page.waitForTimeout(500);
        } catch (selectError) {
            console.warn(`⚠️ Erro ao usar selectOption, tentando Select2...`);
            
            // Se falhar, tentar com Select2
            const planoSelect = await page.$('#planoId');
            if (!planoSelect) {
                throw new Error('Select de plano não encontrado');
            }
            
            // Abrir Select2 usando API jQuery (evita problemas de clique)
            console.log('🎯 Abrindo Select2 via API jQuery...');
            await page.evaluate(() => {
                if (typeof jQuery !== 'undefined') {
                    jQuery('#planoId').select2('open');
                }
            });
            
            await page.waitForTimeout(800);
            
            // Procurar campo de busca
            console.log('🔍 Procurando campo de busca...');
            let searchInput = null;
            try {
                await page.waitForSelector('input.select2-search__field', { timeout: 2000 });
                searchInput = await page.$('input.select2-search__field');
                if (searchInput) {
                    console.log('✅ Campo de busca encontrado!');
                }
            } catch (e) {
                console.warn('⚠️ Campo de busca não encontrado');
            }
            
            if (searchInput) {
                console.log('💬 Digitando no campo de busca...');
                
                // Limpar e digitar
                await searchInput.focus();
                await searchInput.evaluate(el => el.value = '');
                await page.waitForTimeout(100);
                
                // Digitar MENSAL (primeira opção geralmente)
                await searchInput.type('MENSAL', { delay: 50 });
                
                console.log('⏳ Aguardando resultados...');
                await page.waitForTimeout(1000);
            }
            
            // Procurar e clicar na opção
            console.log('🔎 Procurando opção do plano...');
            
            const options = await page.$$('span.select2-dropdown:not([style*="display: none"]) li.select2-results__option');
            console.log(`📋 Opções encontradas: ${options.length}`);
            
            if (options.length > 0) {
                console.log('🖱️ Clicando na primeira opção...');
                
                try {
                    const primeiraOpcao = options[0];
                    const optText = await primeiraOpcao.textContent();
                    console.log(`   Opção: ${optText}`);
                    
                    await primeiraOpcao.click();
                    console.log('✅ Opção clicada!');
                    
                    await page.waitForTimeout(1000);
                    
                } catch (clickError) {
                    console.error(`❌ Erro ao clicar na opção: ${clickError.message}`);
                }
            } else {
                console.warn('⚠️ Nenhuma opção encontrada, tentando via API...');
                
                // Tentar selecionar via API
                const sucesso = await planoSelect.evaluate((el, id) => {
                    if (typeof jQuery !== 'undefined') {
                        jQuery(el).val(id).trigger('change');
                        return true;
                    }
                    return false;
                }, planoId);
                
                if (sucesso) {
                    console.log('✅ Plano selecionado via API!');
                } else {
                    console.error('❌ Falha ao selecionar plano');
                    throw new Error('Não foi possível selecionar o plano');
                }
            }
            
            // Fechar Select2
            console.log('🔌 Fechando Select2...');
            await planoSelect.evaluate((el) => {
                if (typeof jQuery !== 'undefined' && jQuery(el).data('select2')) {
                    try {
                        jQuery(el).select2('close');
                    } catch (e) {}
                }
            });
        }
        
        console.log(`✅ Plano selecionado com sucesso!\n`);
        
    } catch (error) {
        console.error(`❌ Erro ao selecionar plano:`, error.message);
        throw error;
    }
}

/**
 * Preencher dados do cliente na página de contratos
 * @param {Object} page - Página do Playwright
 * @param {string} cpf - CPF do cliente (sem formatação)
 * @param {string} sexo - Sexo do cliente (F ou M)
 * @param {string} cep - CEP do cliente
 * @param {string} numero - Número do endereço
 */
async function preencherDadosClienteContrato(page, cpf, sexo, cep, numero, data_nascimento, email) {
    try {
        console.log('\n👤 Preenchendo dados do cliente no contrato...');
        
        if (!cpf && !sexo && !cep && !numero) {
            console.log('⚠️ Nenhum dado do cliente fornecido, pulando preenchimento');
            return;
        }
        
        // Preencher CPF
        if (cpf) {
            console.log(`📝 Preenchendo CPF: ${cpf}`);
            try {
                const cpfLimpo = cpf.replace(/\D/g, '');
                await preencherCampoOculto(page, '#clienteCGC', cpfLimpo, 'text');
                console.log('✅ CPF preenchido');
            } catch (cpfError) {
                console.warn(`⚠️ Erro ao preencher CPF: ${cpfError.message}`);
            }
        }

        // Preencher email
        if (email) {
            console.log(`📝 Preenchendo EMAIL: ${email}`);
            try {
                await preencherCampoOculto(page, '#clienteEmail', email, 'text');
                console.log('✅ EMAIL preenchido');
            } catch (emailError) {
                console.warn(`⚠️ Erro ao preencher EMAIL: ${emailError.message}`);
            }
        }

        // Preencher data nascimento
        if (data_nascimento) {
            console.log(`📝 Preenchendo DATA NASCIMENTO: ${data_nascimento}`);
            try {
                await preencherDataNascimento(page, data_nascimento);
                //await preencherCampoOculto(page, '#clienteNascimento', data_nascimento, 'text');
                console.log('✅ DATA NASCIMENTO preenchido');
            } catch (nascimentoError) {
                console.warn(`⚠️ Erro ao preencher DATA NASCIMENTO: ${nascimentoError.message}`);
            }
        }
        
        // Preencher Sexo
        if (sexo) {
            console.log(`📝 Preenchendo Sexo: ${sexo}`);
            try {
                const sexoValor = sexo.toUpperCase().charAt(0); // F ou M
                await preencherCampoOculto(page, '#clienteSexo', sexoValor, 'select');
                console.log(`✅ Sexo selecionado: ${sexoValor}`);
            } catch (sexoError) {
                console.warn(`⚠️ Erro ao preencher sexo: ${sexoError.message}`);
            }
        }
        
        // Preencher CEP
        if (cep) {
            console.log(`📝 Preenchendo CEP: ${cep}`);
            try {
                const cepLimpo = cep.replace(/\D/g, '');
                await preencherCampoOculto(page, '#clienteCEP', cepLimpo, 'text');
                console.log('✅ CEP preenchido');
                
                // Clicar no botão "Localizar!"
                console.log(`🔍 Clicando em "Localizar" para buscar endereço...`);
                const btnLocalizar = await page.$('#btn-find-address');
                if (btnLocalizar) {
                    await btnLocalizar.click();
                    
                    // Aguardar os campos de endereço serem preenchidos
                    console.log(`⏳ Aguardando endereço ser localizado...`);
                    await page.waitForTimeout(2000);
                    
                    // Verificar se o endereço foi preenchido
                    const enderecoPreenchido = await page.evaluate(() => {
                        const input = document.querySelector('#clienteEndereco');
                        return input && input.value && input.value.trim() !== '';
                    });
                    
                    if (enderecoPreenchido) {
                        console.log('✅ Endereço foi localizado e preenchido automaticamente');
                    } else {
                        console.warn('⚠️ Endereço não foi localizado automaticamente');
                    }
                } else {
                    console.warn('⚠️ Botão "Localizar" não encontrado');
                }
                
            } catch (cepError) {
                console.warn(`⚠️ Erro ao preencher CEP: ${cepError.message}`);
            }
        }
        
        // Preencher Número
        if (numero) {
            console.log(`📝 Preenchendo Número do Endereço: ${numero}`);
            try {
                await preencherCampoOculto(page, '#clienteNumero', numero, 'text');
                console.log('✅ Número preenchido');
            } catch (numeroError) {
                console.warn(`⚠️ Erro ao preencher número: ${numeroError.message}`);
            }
        }
        
        console.log(`✅ Dados do cliente preenchidos com sucesso!\n`);
        
    } catch (error) {
        console.error(`❌ Erro ao preencher dados do cliente:`, error.message);
        console.log(`⚠️ Continuando mesmo assim...`);
    }
}

/**
 * Selecionar unidade no combo e clicar em Próximo
 * @param {Object} page - Página do Playwright
 * @param {string} unidade - Nome da unidade a selecionar
 */
async function selecionarUnidadeEProxima(page, unidade) {
    try {
        console.log(`\n🔍 Iniciando seleção de unidade: ${unidade}`);
        
        // Aguardar o select estar disponível
        console.log('⏳ [A] Aguardando select de unidades (#unidadeId)...');
        try {
            await page.waitForSelector('#unidadeId', { timeout: 10000 });
            console.log('✅ [A] Select de unidades encontrado');
        } catch (e) {
            console.error('❌ [A] FALHA: Select #unidadeId não encontrado!');
            console.error('   Tentando encontrar outros seletores...');
            const seletoresAlternativos = await page.$$eval('select', selects => {
                return selects.map(s => ({
                    id: s.id,
                    name: s.name,
                    classe: s.className
                }));
            });
            console.error('   Selects encontrados:', seletoresAlternativos);
            throw e;
        }
        
        // Listar todas as opções disponíveis
        console.log('📋 [B] Listando opções disponíveis:');
        let opcoes = [];
        try {
            opcoes = await page.$$eval('#unidadeId option', options => {
                return options.map(opt => ({
                    value: opt.value,
                    text: opt.textContent.trim()
                }));
            });
            console.log(`✅ [B] Total de opções encontradas: ${opcoes.length}`);
        } catch (e) {
            console.error('❌ [B] FALHA ao listar opções:', e.message);
            throw e;
        }
        
        opcoes.forEach((opt, idx) => {
            console.log(`      ${idx + 1}. [${opt.value}] ${opt.text}`);
        });
        
        // Encontrar a opção que contém a unidade
        console.log(`\n🔎 [C] Procurando unidade: "${unidade}"`);
        const opcaoEncontrada = opcoes.find(opt => 
            opt.text.toUpperCase().includes(unidade.toUpperCase())
        );
        
        if (!opcaoEncontrada) {
            console.error(`❌ [C] FALHA: Unidade "${unidade}" não encontrada nas opções!`);
            console.error('   Opções disponíveis:');
            opcoes.forEach(o => console.error(`      - ${o.text}`));
            throw new Error(`Unidade "${unidade}" não encontrada`);
        }
        
        console.log(`✅ [C] Unidade encontrada: [${opcaoEncontrada.value}] ${opcaoEncontrada.text}`);
        
        // Selecionar a opção
        console.log(`\n🔄 [D] Selecionando opção com value: ${opcaoEncontrada.value}`);
        try {
            await page.selectOption('#unidadeId', opcaoEncontrada.value);
            console.log(`✅ [D] Unidade selecionada com sucesso`);
        } catch (e) {
            console.error(`❌ [D] FALHA ao selecionar opção:`, e.message);
            throw e;
        }
        
        // Verificar se foi realmente selecionada
        console.log('🔍 [E] Verificando seleção...');
        const valorSelecionado = await page.inputValue('#unidadeId');
        console.log(`✅ [E] Valor no select: ${valorSelecionado}`);
        
        // Aguardar um pouco para o select processar
        await page.waitForTimeout(1500);
        
        // Clicar no botão "Próximo"
        await clicarProximo(page);
        
        console.log('✅ Próximo passo iniciado com sucesso!\n');
        
    } catch (error) {
        console.error(`\n❌ ERRO NA FUNÇÃO selecionarUnidadeEProxima:`);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

/**
 * Extrair dados dos boxes disponíveis do Prisma Box para todas as unidades
 * @returns {Object} Dados extraídos dos boxes de todas as unidades
 */
async function extractBoxesData() {
    // Versão simplificada - apenas para login
    // Em produção ou quando PLAYWRIGHT_HEADLESS=true, SEMPRE usar headless
    const headlessEnv = process.env.PLAYWRIGHT_HEADLESS;
    const isProduction = process.env.NODE_ENV === 'production';
    
    let headless = true; // ✅ PADRÃO: sempre headless (seguro para servidores)
    
    // Só usar modo headed em development se explicitamente configurado
    if (!isProduction && headlessEnv === 'false') {
        headless = false;
    }

    headless = true;
    const slowMo = headless ? 0 : 100;
    
    console.log(`🧭 Playwright: headless=${headless} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
    console.log(`💻 Modo: ${headless ? '❌ HEADLESS (sem interface)' : '✅ COM INTERFACE GRÁFICA'}`);

    const browser = await chromium.launch({
        headless,
        slowMo,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('🚀 Iniciando login no Prisma Box...');
        
        // Fazer login inicial
        await performLogin(page);

        console.log('✅ Login realizado com sucesso!');
        console.log('🌐 Navegador aberto e aguardando próximas instruções...');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📌 Informações da Sessão:');
        console.log(`   URL atual: ${page.url()}`);
        console.log(`   Título: ${await page.title()}`);
        console.log(`   Navegador: Visível na tela`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        return {
            success: true,
            browser: browser,
            page: page,
            context: context,
            loggedInAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Erro durante login:', error);
        throw error;
    }
    // Nota: Browser será fechado após os 5 minutos
}

/**
 * Função principal que executa todo o processo de login
 */
async function main(options = {}) {
    try {
        const separator = '█'.repeat(100);
        console.error('\n' + separator);
        console.error('✨ [MAIN-1] FUNÇÃO MAIN INICIADA');
        console.error('✨ [MAIN-1] OPÇÕES RECEBIDAS:');
        console.error(JSON.stringify(options, null, 2));
        console.error('✨ [MAIN-1] Unidade: ' + (options.unidade || 'NÃO FORNECIDA'));
        console.error('✨ [MAIN-1] Boxes: ' + (options.boxes ? options.boxes.length : 0) + ' items');
        console.error(separator + '\n');

        console.log('🎯 Iniciando processo de login Prisma Box');
        console.log('='.repeat(50));
        
        const { 
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
            boxes,
            data_nascimento,
            email 
        } = options;
        
        if (unidade) {
            console.log(`📍 Unidade selecionada: ${unidade}`);
        } else {
            console.log(`⚠️ Nenhuma unidade fornecida`);
        }
        
        if (clienteNome) {
            console.log(`👤 Cliente: ${clienteNome}`);
        }
        
        if (clienteTelCel) {
            console.log(`📱 Celular: ${clienteTelCel}`);
        }
        
        if (cpf) {
            console.log(`🆔 CPF: ${cpf}`);
        }
        
        if (sexo) {
            console.log(`👥 Sexo: ${sexo}`);
        }
        
        if (cep) {
            console.log(`📮 CEP: ${cep}`);
        }
        
        if (numero_endereco) {
            console.log(`🏠 Número: ${numero_endereco}`);
        }
        
        if (pagamento) {
            console.log(`💳 Forma de Pagamento: ${pagamento}`);
        }
        
        if (valorBens) {
            console.log(`💰 Valor dos Bens: R$ ${valorBens}`);
        }
        
        if (propostaPrevisaoEntrada) {
            console.log(`📅 Previsão de Entrada: ${propostaPrevisaoEntrada}`);
        }
        
        if (motivoLocacaoId) {
            console.log(`🎯 Motivo de Locação ID: ${motivoLocacaoId}`);
        }
        
        if (vendedorId) {
            console.log(`👥 Vendedor/Responsável ID: ${vendedorId}`);
        }
        
        if (boxes && boxes.length > 0) {
            console.log(`📦 Boxes para adicionar: ${boxes.length}`);
            boxes.forEach((b, idx) => {
                console.log(`   ${idx + 1}. ${b.nome} (${b.tipo})`);
            });
        } else {
            console.log(`⚠️ Nenhum box para adicionar`);
        }
        
        // Executar login
        console.log('\n📝 [1/4] Executando login...');
        const result = await extractBoxesData();
        console.log('✅ [1/4] Login completo - Página carregada');
        
        // Fechar modal de notificação se houver
        console.log('\n🔔 [2/4] Processando modal de notificação...');
        try {
            await fecharModalNotificacao(result.page);
            console.log('✅ [2/4] Modal de notificação processado');
        } catch (modalError) {
            console.error('❌ [2/4] Erro ao fechar modal:', modalError.message);
            console.log('⚠️ Continuando mesmo assim...');
        }
        
        // Se houver unidade, selecionar no combo e clicar próximo
        if (unidade && result.page) {
            console.log(`\n📋 [3/4] Iniciando seleção de unidade...`);
            console.log(`   → Página disponível: ${result.page !== undefined}`);
            console.log(`   → Unidade fornecida: "${unidade}"`);
            
            try {
                await selecionarUnidadeEProxima(result.page, unidade);
                console.log('✅ [3/4] Unidade selecionada e próximo clicado com sucesso!');
                
                // Se houver dados de cliente, preencher o formulário
                if (clienteNome && clienteTelCel) {
                    console.log('\n👤 [3.1/4] Preenchendo dados do cliente...');
                    try {
                        await clicarCriarNovoCliente(result.page);
                        await preencherDadosCliente(result.page, clienteNome, clienteTelCel);
                        console.log('✅ [3.1/4] Cliente adicionado com sucesso!');
                        
                        // Clicar em próximo novamente
                        console.log('\n👉 [3.2/4] Clicando em Próximo para continuar...');
                        await clicarProximo(result.page);
                        console.log('✅ [3.2/4] Avançado para próximo passo!');
                        
                        // Validar se há modal de cliente duplicado
                        console.log('\n🔍 [3.2.1/4] Validando modal de cliente duplicado...');
                        await validarEFecharModalClienteDuplicado(result.page);
                        
                    } catch (clienteError) {
                        console.error('❌ [3.1/4] Erro ao preencher cliente:', clienteError.message);
                        console.log('⚠️ Continuando mesmo assim...');
                    }
                } else {
                    console.log('\n⏭️ [3.1/4] Pulando preenchimento de cliente');
                    console.log(`   → clienteNome: ${clienteNome ? 'Fornecido' : 'Não fornecido'}`);
                    console.log(`   → clienteTelCel: ${clienteTelCel ? 'Fornecido' : 'Não fornecido'}`);
                }
                
                // Se houver dados da proposta, preencher
                if (propostaPrevisaoEntrada && motivoLocacaoId) {
                    console.log('\n📝 [3.3/4] Preenchendo dados da proposta...');
                    try {
                        await preencherPrevisaoEntrada(result.page, propostaPrevisaoEntrada);
                        await selecionarMotivoLocacao(result.page, motivoLocacaoId);
                        console.log('✅ [3.3/4] Dados da proposta preenchidos com sucesso!');
                        
                        // Clicar em próximo apenas 1 vez
                        console.log('\n👉 [3.4/4] Clicando em Próximo...');
                        await clicarProximo(result.page);
                        console.log('✅ [3.4/4] Avançado para próximo passo!');
                        
                        // Se houver vendedor, selecionar
                        if (vendedorId) {
                            console.log('\n👥 [3.5/4] Selecionando Vendedor/Responsável...');
                            try {
                                await selecionarVendedor(result.page, vendedorId);
                                console.log('✅ [3.5/4] Vendedor selecionado com sucesso!');
                                
                                // Clicar em próximo 1 vez
                                console.log('\n👉 [3.6/4] Clicando em Próximo...');
                                await clicarProximo(result.page);
                                console.log('✅ [3.6/4] Avançado!');
                            } catch (vendedorError) {
                                console.error('❌ [3.5/4] Erro ao selecionar vendedor:', vendedorError.message);
                                console.log('⚠️ Continuando mesmo assim...');
                            }
                        } else {
                            // Se não houver vendedor, clicar em próximo 1 vez mesmo assim
                            console.log('\n⏭️ [3.5/4] Pulando seleção de vendedor');
                            console.log(`   → vendedorId: ${vendedorId ? 'Fornecido' : 'Não fornecido'}`);
                            
                            console.log('\n👉 [3.6/4] Clicando em Próximo...');
                            await clicarProximo(result.page);
                            console.log('✅ [3.6/4] Avançado!');
                        }
                    } catch (propostaError) {
                        console.error('❌ [3.3/4] Erro ao preencher proposta:', propostaError.message);
                        console.log('⚠️ Continuando mesmo assim...');
                    }
                } else {
                    console.log('\n⏭️ [3.3/4] Pulando preenchimento de proposta');
                    console.log(`   → propostaPrevisaoEntrada: ${propostaPrevisaoEntrada ? 'Fornecida' : 'Não fornecida'}`);
                    console.log(`   → motivoLocacaoId: ${motivoLocacaoId ? 'Fornecido' : 'Não fornecido'}`);
                }
                
            } catch (unidadeError) {
                console.error('❌ [3/4] Erro ao selecionar unidade:', unidadeError.message);
                console.error('Stack completo:', unidadeError.stack);
                throw unidadeError;
            }
        } else {
            console.log(`\n⏭️ [3/4] Pulando seleção de unidade`);
            console.log(`   → Unidade: ${unidade ? 'Fornecida' : 'Não fornecida'}`);
            console.log(`   → Page: ${result.page ? 'Disponível' : 'Indisponível'}`);
        }
        
        // Se houver boxes para adicionar, executar a função
        let contratoUrl = null;
        if (boxes && boxes.length > 0 && result.page) {
            console.log(`\n📦 [3.7/4] Iniciando adição de items (boxes)...`);
            console.log(`   📊 Parâmetros sendo passados para adicionarItemsBoxes:`);
            console.log(`      • cpf: ${cpf ? `"${cpf}"` : 'undefined'}`);
            console.log(`      • sexo: ${sexo ? `"${sexo}"` : 'undefined'}`);
            console.log(`      • cep: ${cep ? `"${cep}"` : 'undefined'}`);
            console.log(`      • numero_endereco: ${numero_endereco ? `"${numero_endereco}"` : 'undefined'}`);
            console.log(`      • pagamento: ${pagamento ? `"${pagamento}"` : 'undefined'}`);
            console.log(`      • valorBens: ${valorBens ? `"${valorBens}"` : 'undefined'}`);
            console.log(`      • data_nascimento: ${data_nascimento ? `"${data_nascimento}"` : 'undefined'}`);
            console.log(`      • email: ${email ? `"${email}"` : 'undefined'}`);
            try {
                const boxesResult = await adicionarItemsBoxes(result.page, boxes, { cpf, sexo, cep, numero_endereco, pagamento, valorBens, data_nascimento, email });
                if (boxesResult && boxesResult.urlFinal) {
                    contratoUrl = boxesResult.urlFinal;
                }
                console.log(`✅ [3.7/4] Todos os items foram adicionados com sucesso!`);
            } catch (boxesError) {
                console.error(`❌ [3.7/4] Erro ao adicionar items:`, boxesError.message);
                console.log(`⚠️ Continuando mesmo assim...`);
            }
        } else {
            console.log(`\n⏭️ [3.7/4] Pulando adição de items`);
            if (!boxes || boxes.length === 0) {
                console.log(`   → Boxes: Não fornecidos ou vazios`);
            }
            if (!result.page) {
                console.log(`   → Page: Indisponível`);
            }
        }
        
        console.log(`\n[4/4] Resumo final:`);
        console.log(`🎉 Login realizado com sucesso!`);
        console.log(`📅 Hora do login: ${result.loggedInAt}`);
        if (contratoUrl) {
            console.log(`🔗 URL do Contrato: ${contratoUrl}`);
        }
        console.log('✅ Navegador aberto aguardando próximas instruções...');
        console.log('');
        console.log('⏳ Navegador permanecerá aberto por 5 minutos.');
        console.log('💡 Você pode interagir com ele durante este tempo.');
        console.log('');
        
        // Não aguardar se apenas automatizando - o processo terminou
        // Fechar o navegador de forma graciosa
        if (result.browser) {
            try {
                await result.browser.close();
                console.log('\n✅ Navegador fechado com sucesso');
            } catch (e) {
                console.warn('⚠️ Erro ao fechar navegador:', e.message);
            }
        }
        
        return {
            success: true,
            loggedInAt: result.loggedInAt,
            contratoUrl: contratoUrl,
            message: 'Login realizado com sucesso. Navegador pronto para próximas operações.'
        };

    } catch (error) {
        console.error('\n⚠️ ❌ ERRO NO PROCESSO:');
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// Executar apenas se este arquivo for chamado diretamente
if (require.main === module) {
    main();
}

module.exports = {
    extractBoxesData,
    fecharModalNotificacao,
    validarEFecharModalClienteDuplicado,
    selecionarUnidadeEProxima,
    clicarCriarNovoCliente,
    preencherDadosCliente,
    preencherPrevisaoEntrada,
    selecionarMotivoLocacao,
    selecionarVendedor,
    clicarProximo,
    adicionarItemsBoxes,
    mapearTipoParaPlanoId,
    calcularProximoContato,
    preencherFeedback,
    clicarSalvar,
    extrairNumeroProposta,
    navegarParaContratos,
    selecionarPropostaNaContratos,
    preencherDadosClienteContrato,
    selecionarPlanoEProxima,
    selecionarPagamentoEProxima,
    preencherValorBensEProxima,
    main
};
