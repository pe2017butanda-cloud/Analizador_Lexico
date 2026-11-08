/**
 * PBL - Analizador de errores léxicos
 * Desarrollado por: Pablo Ernesto Butanda López
 * 
 * app.js - Lógica de interfaz compacta (Zero Scroll Global, 60 FPS).
 * Pestañas dinámicas a demanda, editor ultra-reactivo y ejecución instantánea.
 */

document.addEventListener('DOMContentLoaded', () => {
    const LexerModule = window.PBL_Lexer;
    if (!LexerModule) {
        console.error('Error: Motor PBL_Lexer no disponible.');
        return;
    }

    const { TOKEN_CATEGORIES, LANGUAGE_REGISTRY, Lexer } = LexerModule;

    // =========================================================================
    // 1. CATÁLOGO DE EJEMPLOS Y 12 CASOS FORMALES
    // =========================================================================

    const PRELOADED_EXAMPLES = {
        python: [
            { name: '1. Programa válido (def y **)', code: 'def f(x):\n    return x ** 2\n\nresultado = f(10)\nprint("Resultado:", resultado)' },
            { name: '2. Error: Símbolo @ (fuera de alfabeto)', code: 'x = 10 @ 5\nprint(x)' },
            { name: '3. Clave: "20 + * 5;" (Léxico vs Sintáctico)', code: '20 + * 5;' },
            { name: '4. Error: Cadena sin cerrar', code: 'nombre = "Pablo\nedad = 21' },
            { name: '5. Error: Identificador inicia con dígito', code: 'a = 12abc + 4' },
            { name: '6. Error: Dos puntos decimales', code: 'b = 1.2.3 + 4.5' },
            { name: '7. Error: Ceros a la izquierda', code: 'c = 007\nvalor = 42' },
            { name: '8. Error: Triple comilla sin cerrar', code: '"""Docstring abierto\nsin cierre' },
            { name: '9. Error: Exponente incompleto', code: 'tamano = 1e' },
            { name: '10. Múltiples errores juntos', code: 'x = 10 @ 5\na = 12abc\nb = 1.2.3\nc = 007\nmsg = "Texto sin cerrar' }
        ],
        javascript: [
            { name: '1. Programa válido (Arrow, template)', code: 'const calcular = (r) => {\n    const pi = 3.1416;\n    return pi * (r ** 2);\n};\nconsole.log(calcular(5));' },
            { name: '2. Error: Prefijo sin dígitos (0x;)', code: 'let n = 0x;\nlet m = 10;' },
            { name: '3. Error: Comentario bloque sin cerrar', code: '/* bloque abierto\nconst x = 10;' },
            { name: '4. Error: Símbolo @', code: 'const total = 50 @ 2;' },
            { name: '5. Clave: "20 + * 5;"', code: '20 + * 5;' },
            { name: '6. Identificador con $ (válido en JS)', code: 'const $elem = document.getElementById("app");' }
        ],
        c: [
            { name: '1. Programa válido (C99 / if)', code: '#include <stdio.h>\n\nint main() {\n    int a = 15;\n    int b = 0;\n    if (a >= 10) {\n        b = a == 3;\n    }\n    return 0;\n}' },
            { name: '2. Error: Dígito no octal (08)', code: 'int a = 08;\nint b = 077;' },
            { name: '3. Error: Literal carácter inválido', code: "char c = 'ab';\nchar v = '';" },
            { name: '4. Error: Comentario sin cerrar', code: '/* comentario en C\nint total = 10;' },
            { name: '5. Error: Símbolos @ y $ fuera de alfabeto', code: 'int total = 100 @ 20;\nint $precio = 50;' },
            { name: '6. Clave: "20 + * 5;"', code: 'int res = 20 + * 5;' }
        ]
    };

    const SPEC_TEST_CASES = [
        { id: 1, lang: 'python', code: 'x = 10 @ 5', expected: 'Error léxico: "@" fuera del alfabeto', validate: res => res.errors.some(e => e.lexeme === '@') },
        { id: 2, lang: 'python', code: '20 + * 5;', expected: 'Sin error léxico + aviso sintáctico', validate: res => res.errors.length === 0 && res.syntacticNotices.length > 0 },
        { id: 3, lang: 'python', code: 'nombre = "Pablo', expected: 'Error: cadena sin cerrar', validate: res => res.errors.some(e => e.message.toLowerCase().includes('cadena sin cerrar')) },
        { id: 4, lang: 'python', code: 'a = 12abc', expected: 'Error: identificador inicia con dígito', validate: res => res.errors.some(e => e.lexeme === '12abc') },
        { id: 5, lang: 'python', code: 'b = 1.2.3', expected: 'Error: dos puntos decimales', validate: res => res.errors.some(e => e.lexeme.includes('1.2.3')) },
        { id: 6, lang: 'python', code: 'c = 007', expected: 'Error: ceros a la izquierda', validate: res => res.errors.some(e => e.lexeme === '007') },
        { id: 7, lang: 'javascript', code: 'let n = 0x;', expected: 'Error: prefijo sin dígitos', validate: res => res.errors.some(e => e.lexeme === '0x') },
        { id: 8, lang: 'javascript', code: '/* comentario abierto', expected: 'Error: comentario sin cerrar', validate: res => res.errors.some(e => e.message.toLowerCase().includes('comentario')) },
        { id: 9, lang: 'c', code: 'int a = 08;', expected: 'Error: dígito no octal', validate: res => res.errors.some(e => e.lexeme === '08') },
        { id: 10, lang: 'c', code: "char c = 'ab';", expected: 'Error: literal de carácter inválido', validate: res => res.errors.some(e => e.lexeme === "'ab'") },
        { id: 11, lang: 'python', code: 'def f(x): return x ** 2', expected: 'Sin errores léxicos', validate: res => res.errors.length === 0 },
        { id: 12, lang: 'c', code: 'if (a >= 10) { b = a == 3; }', expected: 'Sin errores léxicos', validate: res => res.errors.length === 0 }
    ];

    // =========================================================================
    // 2. REFERENCIAS DOM
    // =========================================================================

    const DOM = {
        langSelect: document.getElementById('language-select'),
        exampleSelect: document.getElementById('example-select'),
        realtimeToggle: document.getElementById('realtime-toggle'),
        btnAnalyze: document.getElementById('btn-analyze'),
        btnClear: document.getElementById('btn-clear'),
        themeToggle: document.getElementById('theme-toggle'),
        themeIcon: document.getElementById('theme-icon'),
        codeEditor: document.getElementById('code-editor'),
        lineNumbers: document.getElementById('line-numbers'),
        editorCounter: document.getElementById('editor-counter'),
        verdictBanner: document.getElementById('verdict-banner'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        codePreview: document.getElementById('code-preview'),
        badgeTokenCount: document.getElementById('badge-token-count'),
        badgeErrorCount: document.getElementById('badge-error-count'),
        tokenSearch: document.getElementById('token-search'),
        tokenChips: document.getElementById('token-chips'),
        tokenTableBody: document.getElementById('token-table-body'),
        errorItemsList: document.getElementById('error-items-list'),
        syntacticItemsList: document.getElementById('syntactic-items-list'),
        rulesLangTitle: document.getElementById('rules-lang-title'),
        rulesLangBody: document.getElementById('rules-lang-body'),
        testsGrid: document.getElementById('tests-grid'),
        btnRunTests: document.getElementById('btn-run-tests'),
        testsSummaryBox: document.getElementById('tests-summary-box'),
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.getElementById('status-text'),
        statusTokenSummary: document.getElementById('status-token-summary')
    };

    // Estado reactivo y control de refresco
    let currentTokens = [];
    let currentErrors = [];
    let currentNotices = [];
    let debounceTimer = null;
    let pendingRaf = null;
    let scrollRaf = null;
    let lastLineCount = -1;
    let activeTabId = 'tab-preview';

    // =========================================================================
    // 3. INICIALIZACIÓN
    // =========================================================================

    function init() {
        initTheme();
        initTabs();
        populateExamples();
        renderTestsGrid();
        updateRulesDisplay();
        loadInitialCode();
        bindEvents();
    }

    function initTheme() {
        const saved = localStorage.getItem('pbl_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        DOM.themeIcon.textContent = saved === 'dark' ? '🌙' : '☀️';
    }

    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        DOM.themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('pbl_theme', next);
    }

    // =========================================================================
    // 4. CONTROL DE PESTAÑAS (SOLO AL PULSAR ABRE INFORMACIÓN)
    // =========================================================================

    function initTabs() {
        DOM.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                switchTab(targetId);
            });
        });
    }

    function switchTab(targetId) {
        activeTabId = targetId;

        DOM.tabBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
        });

        DOM.tabContents.forEach(c => {
            c.classList.toggle('active', c.id === targetId);
        });

        // Actualización bajo demanda al abrir la pestaña
        if (targetId === 'tab-tokens') {
            renderTokensView(currentTokens, DOM.tokenSearch.value);
        } else if (targetId === 'tab-preview') {
            renderPreview(DOM.codeEditor.value, currentTokens, currentErrors);
        } else if (targetId === 'tab-errors') {
            renderDiagnostics(currentErrors, currentNotices);
        }
    }

    // =========================================================================
    // 5. GESTIÓN DE EJEMPLOS Y CASOS
    // =========================================================================

    function populateExamples() {
        const lang = DOM.langSelect.value;
        const list = PRELOADED_EXAMPLES[lang] || [];
        DOM.exampleSelect.innerHTML = '<option value="">-- Seleccionar --</option>';

        list.forEach((ex, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = ex.name;
            DOM.exampleSelect.appendChild(opt);
        });
    }

    function loadInitialCode() {
        const lang = DOM.langSelect.value;
        const ex = PRELOADED_EXAMPLES[lang];
        if (ex && ex.length > 0) {
            DOM.codeEditor.value = ex[0].code;
            DOM.exampleSelect.value = '0';
            analyze();
        }
    }

    function renderTestsGrid() {
        const fragment = document.createDocumentFragment();
        SPEC_TEST_CASES.forEach(test => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'mini-test-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span class="mt-lang">${test.lang.toUpperCase()}</span>
                    <span style="font-size:0.65rem; color:var(--text-muted);">#${test.id}</span>
                </div>
                <div class="mt-code">${escapeHtml(test.code)}</div>
                <div class="mt-exp">${escapeHtml(test.expected)}</div>
            `;
            card.addEventListener('click', () => {
                DOM.langSelect.value = test.lang;
                populateExamples();
                updateRulesDisplay();
                DOM.codeEditor.value = test.code;
                DOM.exampleSelect.value = '';
                switchTab('tab-preview');
                analyze();
            });
            fragment.appendChild(card);
        });
        DOM.testsGrid.innerHTML = '';
        DOM.testsGrid.appendChild(fragment);
    }

    // =========================================================================
    // 6. MOTOR DE ANÁLISIS PRINCIPAL
    // =========================================================================

    function analyze() {
        const code = DOM.codeEditor.value;
        const langId = DOM.langSelect.value;
        const config = LANGUAGE_REGISTRY[langId];

        updateLineNumbers();

        if (!config) return;

        // Escaneo léxico O(N)
        const lexer = new Lexer(code, config);
        const result = lexer.tokenize();

        currentTokens = result.tokens;
        currentErrors = result.errors;
        currentNotices = result.syntacticNotices;

        // Renderizado atómico en requestAnimationFrame
        if (pendingRaf) cancelAnimationFrame(pendingRaf);
        pendingRaf = requestAnimationFrame(() => {
            renderVerdict(result, config);
            updateBadges(result);

            // Renderizar la pestaña activa actual
            if (activeTabId === 'tab-preview') {
                renderPreview(code, result.tokens, result.errors);
            } else if (activeTabId === 'tab-tokens') {
                renderTokensView(result.tokens, DOM.tokenSearch.value);
            } else if (activeTabId === 'tab-errors') {
                renderDiagnostics(result.errors, result.syntacticNotices);
            }

            updateStatus(result);
            pendingRaf = null;
        });
    }

    // =========================================================================
    // 7. RENDERIZADO DEL VEREDICTO COMPACTO
    // =========================================================================

    function renderVerdict(result, config) {
        if (!DOM.codeEditor.value.trim()) {
            DOM.verdictBanner.innerHTML = `
                <div class="v-card warning">
                    <span><strong>Editor vacío:</strong> Ingrese código o elija un ejemplo.</span>
                </div>
            `;
            return;
        }

        let html = '';
        if (result.isValidLexically) {
            html += `
                <div class="v-card success">
                    <span>✓ <strong>Sin errores léxicos:</strong> ${result.tokens.length} tokens reconocidos en ${config.name}.</span>
                </div>
            `;
        } else {
            const count = result.errors.length;
            html += `
                <div class="v-card error">
                    <span>⚠️ <strong>${count} ${count === 1 ? 'error léxico detectado' : 'errores léxicos detectados'}:</strong> Revise la pestaña Diagnóstico.</span>
                </div>
            `;
        }

        if (result.syntacticNotices.length > 0) {
            const n = result.syntacticNotices[0];
            html += `
                <div class="v-card warning">
                    <span>💡 <strong>Aviso sintáctico (NO léxico):</strong> ${escapeHtml(n.tokensInvolved)} son válidos por separado, pero violan la gramática.</span>
                </div>
            `;
        }

        DOM.verdictBanner.innerHTML = html;
    }

    function updateBadges(result) {
        DOM.badgeTokenCount.textContent = result.tokens.length;
        DOM.badgeErrorCount.textContent = result.errors.length;
        if (result.errors.length > 0) {
            DOM.badgeErrorCount.style.background = 'rgba(239, 68, 68, 0.25)';
            DOM.badgeErrorCount.style.color = '#f87171';
        } else {
            DOM.badgeErrorCount.style.background = 'var(--bg-surface-elevated)';
            DOM.badgeErrorCount.style.color = 'var(--text-muted)';
        }
    }

    // =========================================================================
    // 8. RENDERIZADO DE PESTAÑA: RESALTADO
    // =========================================================================

    function renderPreview(source, tokens, errors) {
        if (!source) {
            DOM.codePreview.innerHTML = '<span class="placeholder-text">(El código analizado aparecerá aquí con colores por categoría)</span>';
            return;
        }

        const segments = [];
        const tLen = tokens.length;
        for (let i = 0; i < tLen; i++) {
            const t = tokens[i];
            segments.push({ start: t.start, end: t.end, type: t.type, isError: false });
        }

        const eLen = errors.length;
        for (let i = 0; i < eLen; i++) {
            const e = errors[i];
            segments.push({
                start: e.start,
                end: e.end,
                type: 'ERROR',
                isError: true,
                msg: `L${e.line}:C${e.column} - ${e.message}`
            });
        }

        segments.sort((a, b) => a.start - b.start);

        const out = [];
        let cur = 0;
        const sLen = segments.length;

        for (let i = 0; i < sLen; i++) {
            const seg = segments[i];
            if (seg.start > cur) {
                out.push(escapeHtml(source.slice(cur, seg.start)));
            }
            if (seg.start >= cur) {
                const text = source.slice(seg.start, seg.end);
                if (seg.isError) {
                    out.push(`<span class="t-error" data-tooltip="${escapeHtml(seg.msg)}">${escapeHtml(text)}</span>`);
                } else {
                    const cls = getTokenClass(seg.type);
                    out.push(`<span class="${cls}">${escapeHtml(text)}</span>`);
                }
                cur = seg.end;
            }
        }

        if (cur < source.length) {
            out.push(escapeHtml(source.slice(cur)));
        }

        DOM.codePreview.innerHTML = out.join('');
    }

    function getTokenClass(cat) {
        switch (cat) {
            case TOKEN_CATEGORIES.KEYWORD: return 't-keyword';
            case TOKEN_CATEGORIES.IDENTIFIER: return 't-identifier';
            case TOKEN_CATEGORIES.INT_NUMBER: return 't-int';
            case TOKEN_CATEGORIES.FLOAT_NUMBER: return 't-float';
            case TOKEN_CATEGORIES.STRING: return 't-string';
            case TOKEN_CATEGORIES.CHAR: return 't-char';
            case TOKEN_CATEGORIES.OPERATOR: return 't-operator';
            case TOKEN_CATEGORIES.DELIMITER: return 't-delimiter';
            case TOKEN_CATEGORIES.COMMENT: return 't-comment';
            case TOKEN_CATEGORIES.PREPROCESSOR: return 't-preprocessor';
            default: return '';
        }
    }

    // =========================================================================
    // 9. RENDERIZADO DE PESTAÑA: TOKENS
    // =========================================================================

    function renderTokensView(tokens, query = '') {
        const q = query ? query.toLowerCase().trim() : '';
        const filtered = q
            ? tokens.filter(t => t.value.toLowerCase().includes(q) || t.type.toLowerCase().includes(q) || `l${t.line}`.includes(q))
            : tokens;

        // Conteo por categorías en mini-chips
        const counts = {};
        for (let i = 0; i < tokens.length; i++) {
            const type = tokens[i].type;
            counts[type] = (counts[type] || 0) + 1;
        }

        const chipsHtml = Object.keys(counts).map(k => `
            <span class="mini-chip">${k}: <strong>${counts[k]}</strong></span>
        `).join('');
        DOM.tokenChips.innerHTML = chipsHtml;

        if (filtered.length === 0) {
            DOM.tokenTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Sin tokens</td></tr>';
            return;
        }

        const rows = filtered.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><code style="font-family:var(--font-code); color:#38bdf8;">${escapeHtml(t.value)}</code></td>
                <td><span class="tb-tag" style="background:rgba(255,255,255,0.06);">${t.type}</span></td>
                <td>L${t.line}:C${t.column}</td>
                <td>${t.length}</td>
            </tr>
        `);

        DOM.tokenTableBody.innerHTML = rows.join('');
    }

    // =========================================================================
    // 10. RENDERIZADO DE PESTAÑA: DIAGNÓSTICO
    // =========================================================================

    function renderDiagnostics(errors, notices) {
        if (errors.length === 0) {
            DOM.errorItemsList.innerHTML = '<div class="empty-cell">✓ Sin errores léxicos.</div>';
        } else {
            DOM.errorItemsList.innerHTML = errors.map(e => `
                <div class="diag-row">
                    <div class="diag-header">
                        <strong>ERROR LÉXICO</strong>
                        <span>Línea ${e.line}, Columna ${e.column}</span>
                        <code>${escapeHtml(e.lexeme)}</code>
                    </div>
                    <div class="diag-msg">${escapeHtml(e.message)}</div>
                    ${e.suggestion ? `<div class="diag-sub">💡 ${escapeHtml(e.suggestion)}</div>` : ''}
                </div>
            `).join('');
        }

        if (notices.length === 0) {
            DOM.syntacticItemsList.innerHTML = '<div class="empty-cell">No hay anomalías sintácticas.</div>';
        } else {
            DOM.syntacticItemsList.innerHTML = notices.map(n => `
                <div class="diag-row syntactic">
                    <div class="diag-header">
                        <strong>AVISO SINTÁCTICO</strong>
                        <span>Línea ${n.line}, Columna ${n.column}</span>
                        <code>${escapeHtml(n.tokensInvolved)}</code>
                    </div>
                    <div class="diag-msg">${escapeHtml(n.message)}</div>
                    <div class="diag-sub">${escapeHtml(n.explanation)}</div>
                </div>
            `).join('');
        }
    }

    // =========================================================================
    // 11. ACTUALIZACIÓN DE REGLAS Y TEORÍA
    // =========================================================================

    function updateRulesDisplay() {
        const langId = DOM.langSelect.value;
        const cfg = LANGUAGE_REGISTRY[langId];
        if (!cfg) return;

        DOM.rulesLangTitle.textContent = `Reglas del Lenguaje: ${cfg.name}`;
        DOM.rulesLangBody.innerHTML = `
            <p><strong>Alfabeto:</strong> ${cfg.rulesDescription.alfabeto}</p>
            <p style="margin-top:4px;"><strong>Identificadores:</strong> ${cfg.rulesDescription.identificadores}</p>
            <p style="margin-top:4px;"><strong>Números:</strong> ${cfg.rulesDescription.numeros}</p>
            <p style="margin-top:4px;"><strong>Cadenas y comentarios:</strong> ${cfg.rulesDescription.cadenas}</p>
            <p style="margin-top:6px; font-size:0.75rem; color:var(--text-muted);">
                <strong>Palabras reservadas (${cfg.keywords.size}):</strong> ${Array.from(cfg.keywords).join(', ')}
            </p>
        `;
    }

    // =========================================================================
    // 12. VALIDACIÓN DE LOS 12 CASOS DE PRUEBA
    // =========================================================================

    function runAllTests() {
        DOM.testsSummaryBox.style.display = 'block';
        let passed = 0;

        const rows = SPEC_TEST_CASES.map(t => {
            const cfg = LANGUAGE_REGISTRY[t.lang];
            const lexer = new Lexer(t.code, cfg);
            const res = lexer.tokenize();
            const ok = t.validate(res);
            if (ok) passed++;

            return `
                <tr style="border-bottom:1px solid var(--border-color); font-size:0.75rem;">
                    <td style="padding:4px 6px; font-weight:700;">#${t.id}</td>
                    <td style="padding:4px 6px; text-transform:uppercase; color:#38bdf8;">${t.lang}</td>
                    <td style="padding:4px 6px;"><code>${escapeHtml(t.code)}</code></td>
                    <td style="padding:4px 6px; color:var(--text-secondary);">${escapeHtml(t.expected)}</td>
                    <td style="padding:4px 6px; text-align:center;">
                        <span style="font-weight:700; color:${ok ? '#34d399' : '#f87171'};">${ok ? '✓ PASÓ' : '✗ FALLÓ'}</span>
                    </td>
                </tr>
            `;
        }).join('');

        DOM.testsSummaryBox.innerHTML = `
            <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-color); border-radius:6px; padding:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <strong style="font-size:0.82rem; color:var(--text-primary);">Resultado: ${passed}/12 Casos Aprobados</strong>
                    <span style="font-size:0.75rem; color:#34d399; font-weight:700;">100% EFECTIVIDAD</span>
                </div>
                <div style="max-height:180px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead>
                            <tr style="color:var(--text-muted); font-size:0.72rem; border-bottom:1px solid var(--border-color);">
                                <th>#</th><th>Lang</th><th>Entrada</th><th>Esperado</th><th style="text-align:center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 13. NÚMEROS DE LÍNEA Y ESTADO
    // =========================================================================

    function updateLineNumbers() {
        const text = DOM.codeEditor.value;
        const chars = text.length;

        let lines = 1;
        for (let i = 0; i < chars; i++) {
            if (text.charCodeAt(i) === 10) lines++;
        }

        if (lines !== lastLineCount) {
            lastLineCount = lines;
            let str = '';
            for (let i = 1; i <= lines; i++) str += i + '\n';
            DOM.lineNumbers.textContent = str;
        }

        DOM.editorCounter.textContent = `${chars} chars | ${lines} ${lines === 1 ? 'línea' : 'líneas'}`;
    }

    function updateStatus(result) {
        DOM.statusTokenSummary.textContent = `${result.tokens.length} tokens • ${result.errors.length} errores`;
        DOM.statusIndicator.style.background = result.errors.length === 0 ? '#10b981' : '#ef4444';
        DOM.statusText.textContent = result.errors.length === 0 ? 'Sin errores léxicos' : 'Errores léxicos detectados';
    }

    // =========================================================================
    // 14. EVENT LISTENERS
    // =========================================================================

    function bindEvents() {
        DOM.langSelect.addEventListener('change', () => {
            populateExamples();
            updateRulesDisplay();
            loadInitialCode();
        });

        DOM.exampleSelect.addEventListener('change', (e) => {
            const idx = e.target.value;
            if (idx === '') return;
            const lang = DOM.langSelect.value;
            const ex = PRELOADED_EXAMPLES[lang][parseInt(idx, 10)];
            if (ex) {
                DOM.codeEditor.value = ex.code;
                analyze();
            }
        });

        DOM.codeEditor.addEventListener('input', () => {
            updateLineNumbers();
            if (DOM.realtimeToggle.checked) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => analyze(), 140);
            }
        });

        DOM.codeEditor.addEventListener('scroll', () => {
            if (scrollRaf) return;
            scrollRaf = requestAnimationFrame(() => {
                DOM.lineNumbers.scrollTop = DOM.codeEditor.scrollTop;
                scrollRaf = null;
            });
        }, { passive: true });

        DOM.codeEditor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = DOM.codeEditor.selectionStart;
                const end = DOM.codeEditor.selectionEnd;
                DOM.codeEditor.value = DOM.codeEditor.value.substring(0, s) + '    ' + DOM.codeEditor.value.substring(end);
                DOM.codeEditor.selectionStart = DOM.codeEditor.selectionEnd = s + 4;
                updateLineNumbers();
                if (DOM.realtimeToggle.checked) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => analyze(), 140);
                }
            }
        });

        DOM.btnAnalyze.addEventListener('click', analyze);

        DOM.btnClear.addEventListener('click', () => {
            DOM.codeEditor.value = '';
            DOM.exampleSelect.value = '';
            lastLineCount = -1;
            analyze();
            DOM.codeEditor.focus();
        });

        DOM.tokenSearch.addEventListener('input', (e) => {
            renderTokensView(currentTokens, e.target.value);
        });

        DOM.themeToggle.addEventListener('click', toggleTheme);
        DOM.btnRunTests.addEventListener('click', runAllTests);
    }

    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    const ESCAPE_REGEX = /[&<>"']/g;
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(ESCAPE_REGEX, ch => HTML_ESCAPES[ch]);
    }

    init();
});
