/**
 * PBL - Analizador de errores léxicos
 * Desarrollado por: Pablo Ernesto Butanda López
 * 
 * lexer.js - Motor del analizador léxico desacoplado y configurable.
 * VERSIÓN OPTIMIZADA: Operadores pre-ordenados para Maximal Munch O(1),
 * reducción de asignaciones en bucles críticos y algoritmos de escaneo eficientes.
 */

(function(global) {
    'use strict';

    // =========================================================================
    // 1. CONSTANTES Y CATEGORÍAS DE TOKEN
    // =========================================================================

    const TOKEN_CATEGORIES = Object.freeze({
        KEYWORD: 'Palabra reservada',
        IDENTIFIER: 'Identificador',
        INT_NUMBER: 'Número entero',
        FLOAT_NUMBER: 'Número decimal',
        STRING: 'Cadena',
        CHAR: 'Literal de carácter',
        OPERATOR: 'Operador',
        DELIMITER: 'Delimitador',
        COMMENT: 'Comentario',
        PREPROCESSOR: 'Directiva de preprocesador',
        ERROR: 'Error léxico'
    });

    // =========================================================================
    // 2. CONFIGURACIONES DE LENGUAJE (Con operadores pre-ordenados)
    // =========================================================================

    const PYTHON_OPERATORS = [
        '**=', '//=', '<<=', '>>=',
        '==', '!=', '<=', '>=', '**', '//', '<<', '>>',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
        '+', '-', '*', '/', '%', '<', '>', '=', '&', '|', '^', '~'
    ];

    const JS_OPERATORS = [
        '===', '!==', '>>>', '>>=', '<<=', '**=', '&&=', '||=', '??=', '...',
        '==', '!=', '<=', '>=', '&&', '||', '??', '++', '--', '**',
        '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '=>',
        '+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '^', '~', '?', ':'
    ];

    const C_OPERATORS = [
        '<<=', '>>=', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=',
        '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=',
        '+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '^', '~', '?', ':'
    ];

    // Función auxiliar para pre-ordenar operadores una única vez (evita re-sort en cada escaneo)
    const sortOps = (ops) => [...ops].sort((a, b) => b.length - a.length);

    /**
     * Configuración para Python (subconjunto didáctico)
     */
    const PYTHON_CONFIG = {
        name: 'Python',
        id: 'python',
        allowDollarInIdent: false,
        keywords: new Set([
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
            'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
            'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
            'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
            'try', 'while', 'with', 'yield', 'print', 'range', 'len'
        ]),
        operators: PYTHON_OPERATORS,
        sortedOperators: sortOps(PYTHON_OPERATORS),
        delimiters: new Set(['(', ')', '[', ']', '{', '}', ',', ':', ';', '.']),
        comments: {
            line: '#',
            blockStart: null,
            blockEnd: null
        },
        strings: {
            singleLine: ["'", '"'],
            multiLine: ["'''", '"""']
        },
        numbers: {
            allowLeadingZeros: false,
            supportsHex: true,
            supportsBinary: true,
            supportsOctal: true,
            cStyleOctal: false
        },
        preprocessor: false,
        charLiteralCheck: false,
        rulesDescription: {
            alfabeto: "Caracteres ASCII estándar, letras a-z/A-Z, dígitos 0-9 y operadores reconocidos. '@' y '$' NO pertenecen al alfabeto de este subconjunto léxico.",
            identificadores: "Inician obligatoriamente con letra o guion bajo (_), seguidos de letras, dígitos o guiones bajos. No pueden iniciar con dígitos ni contener símbolos como '$' o '@'.",
            numeros: "Enteros decimales sin ceros iniciales (007 es ilegal), binarios (0b...), octales (0o...), hexadecimales (0x...) y decimales de punto flotante o notación científica (1e3). Múltiples puntos (1.2.3) son error.",
            cadenas: "Delimitadas por comillas simples ('...'), comillas dobles (\"...\") o triples comillas multilínea ('''...''' o \"\"\"...\"\"\"). Deben cerrarse antes del fin de línea o del archivo.",
            comentarios: "Línea simple iniciando con '#' hasta el final de la línea."
        }
    };

    /**
     * Configuración para JavaScript (ECMAScript)
     */
    const JAVASCRIPT_CONFIG = {
        name: 'JavaScript',
        id: 'javascript',
        allowDollarInIdent: true,
        keywords: new Set([
            'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
            'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
            'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
            'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
            'typeof', 'var', 'void', 'while', 'with', 'yield',
            'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'
        ]),
        operators: JS_OPERATORS,
        sortedOperators: sortOps(JS_OPERATORS),
        delimiters: new Set(['(', ')', '[', ']', '{', '}', ',', ';', ':', '.']),
        comments: {
            line: '//',
            blockStart: '/*',
            blockEnd: '*/'
        },
        strings: {
            singleLine: ["'", '"'],
            multiLine: ['`']
        },
        numbers: {
            allowLeadingZeros: false,
            supportsHex: true,
            supportsBinary: true,
            supportsOctal: true,
            cStyleOctal: false
        },
        preprocessor: false,
        charLiteralCheck: false,
        rulesDescription: {
            alfabeto: "Caracteres ASCII imprimibles estándar. El símbolo '@' NO forma parte del alfabeto léxico de JavaScript en este analizador.",
            identificadores: "Inician con letra, guion bajo (_) o '$', seguidos de letras, dígitos, '_' o '$'. No pueden iniciar con dígitos.",
            numeros: "Enteros (decimales, hex 0x, bin 0b, oct 0o) y decimales con un único punto o notación exponencial (1e4). Prefijos sin dígitos (0x;) o con dígitos inválidos son error.",
            cadenas: "Cadenas de una línea ('...' o \"...\") y plantillas multilínea con acento grave (`...`). Cadenas no cerradas antes del fin de línea constituyen un error léxico.",
            comentarios: "Línea con '//' y comentarios de bloque '/*' hasta '*/'. Comentarios de bloque no cerrados antes de EOF se reportan como error."
        }
    };

    /**
     * Configuración para lenguaje C
     */
    const C_CONFIG = {
        name: 'C',
        id: 'c',
        allowDollarInIdent: false,
        keywords: new Set([
            'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
            'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
            'inline', 'int', 'long', 'register', 'restrict', 'return', 'short',
            'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
            'unsigned', 'void', 'volatile', 'while', '_Bool', '_Complex', '_Imaginary'
        ]),
        operators: C_OPERATORS,
        sortedOperators: sortOps(C_OPERATORS),
        delimiters: new Set(['(', ')', '[', ']', '{', '}', ',', ';', ':', '.']),
        comments: {
            line: '//',
            blockStart: '/*',
            blockEnd: '*/'
        },
        strings: {
            singleLine: ['"'],
            multiLine: []
        },
        numbers: {
            allowLeadingZeros: true,
            supportsHex: true,
            supportsBinary: false,
            supportsOctal: true,
            cStyleOctal: true
        },
        preprocessor: true,
        charLiteralCheck: true,
        rulesDescription: {
            alfabeto: "Juego de caracteres ASCII para C. Los símbolos '@' y '$' NO pertenecen al alfabeto léxico.",
            identificadores: "Inician con letra o guion bajo (_), seguidos de letras, dígitos o guiones bajos. No pueden iniciar con dígitos.",
            numeros: "Enteros decimales, hexadecimales (0x...) y octales (inician con 0 seguido de dígitos 0-7; números como 08 son inválidos). Decimales con punto o exponente.",
            cadenas: "Cadenas de texto con comillas dobles (\"...\"). Literales de carácter con comillas simples ('...'), que deben contener exactamente un carácter (no 'ab' ni '').",
            comentarios: "Línea con '//' y bloque con '/*' y '*/'. Directivas de preprocesador con '#' al inicio de línea."
        }
    };

    const LANGUAGE_REGISTRY = {
        python: PYTHON_CONFIG,
        javascript: JAVASCRIPT_CONFIG,
        c: C_CONFIG
    };

    // =========================================================================
    // 3. MOTOR DEL ANALIZADOR LÉXICO (LEXER ENGINE ULTRA-RÁPIDO)
    // =========================================================================

    class Lexer {
        /**
         * @param {string} source Código fuente a analizar
         * @param {object} config Configuración del lenguaje
         */
        constructor(source, config) {
            this.source = source || '';
            this.config = config || PYTHON_CONFIG;
            this.length = this.source.length;

            this.index = 0;
            this.line = 1;
            this.column = 1;

            this.tokens = [];
            this.errors = [];
            this.syntacticNotices = [];
            this.tokenCounter = 1;

            // Reutilización directa de operadores ordenados en O(1)
            this.sortedOperators = this.config.sortedOperators;
        }

        isAtEnd() {
            return this.index >= this.length;
        }

        peek() {
            if (this.index >= this.length) return '\0';
            return this.source[this.index];
        }

        peekAhead(offset = 1) {
            const target = this.index + offset;
            if (target >= this.length) return '\0';
            return this.source[target];
        }

        advance() {
            if (this.index >= this.length) return '\0';
            const char = this.source[this.index++];
            if (char === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
            return char;
        }

        matches(str) {
            const len = str.length;
            if (this.index + len > this.length) return false;
            // Comparación de caracteres directa para cadenas cortas (más rápida que slice)
            if (len === 1) return this.source[this.index] === str;
            if (len === 2) return this.source[this.index] === str[0] && this.source[this.index + 1] === str[1];
            return this.source.startsWith(str, this.index);
        }

        addError(line, column, lexeme, message, suggestion = '', start = null, end = null) {
            const errStart = start !== null ? start : (this.index - lexeme.length);
            const errEnd = end !== null ? end : this.index;
            this.errors.push({
                id: this.errors.length + 1,
                line,
                column,
                lexeme,
                message,
                suggestion,
                start: errStart,
                end: errEnd,
                type: 'ERROR_LÉXICO'
            });
        }

        addToken(type, value, startLine, startCol, startIndex, endIndex) {
            this.tokens.push({
                id: this.tokenCounter++,
                type,
                value,
                line: startLine,
                column: startCol,
                start: startIndex,
                end: endIndex,
                length: value.length
            });
        }

        tokenize() {
            const len = this.length;
            while (this.index < len) {
                // 1. Espacios en blanco
                if (this.skipWhitespace()) {
                    continue;
                }

                const startLine = this.line;
                const startCol = this.column;
                const startIndex = this.index;
                const char = this.source[startIndex];

                // 2. Directivas de preprocesador en C
                if (this.config.preprocessor && char === '#' && this.isStartOfDirective()) {
                    this.scanPreprocessorDirective(startLine, startCol, startIndex);
                    continue;
                }

                // 3. Comentarios
                if (this.checkComment(startLine, startCol, startIndex)) {
                    continue;
                }

                // 4. Literales de carácter en C ('...')
                if (this.config.charLiteralCheck && char === "'") {
                    this.scanCharLiteral(startLine, startCol, startIndex);
                    continue;
                }

                // 5. Cadenas multilínea (Python '''/""" y JS `)
                if (this.checkMultilineString(startLine, startCol, startIndex)) {
                    continue;
                }

                // 6. Cadenas de una línea ('...' o "...")
                if (this.config.strings.singleLine.includes(char)) {
                    this.scanSingleLineString(char, startLine, startCol, startIndex);
                    continue;
                }

                // 7. Números (0-9)
                if (char >= '0' && char <= '9') {
                    this.scanNumber(startLine, startCol, startIndex);
                    continue;
                }

                // 8. Punto flotante (.5)
                if (char === '.' && this.isDigit(this.peekAhead(1))) {
                    this.scanNumber(startLine, startCol, startIndex);
                    continue;
                }

                // 9. Operadores con principio de máxima coincidencia (Maximal Munch)
                const matchedOperator = this.matchOperator();
                if (matchedOperator) {
                    const opLen = matchedOperator.length;
                    for (let i = 0; i < opLen; i++) this.advance();
                    this.addToken(
                        TOKEN_CATEGORIES.OPERATOR,
                        matchedOperator,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                    continue;
                }

                // 10. Delimitadores
                if (this.config.delimiters.has(char)) {
                    this.advance();
                    this.addToken(
                        TOKEN_CATEGORIES.DELIMITER,
                        char,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                    continue;
                }

                // 11. Identificadores y Palabras Reservadas
                if (this.isValidIdentifierStart(char)) {
                    this.scanIdentifierOrKeyword(startLine, startCol, startIndex);
                    continue;
                }

                // 12. Carácter fuera del alfabeto
                const offensiveChar = this.advance();
                let errorMessage = `Carácter fuera del alfabeto: '${offensiveChar}'.`;
                let suggestion = `Elimine o reemplace el símbolo '${offensiveChar}' por un elemento válido del lenguaje.`;

                if (offensiveChar === '@') {
                    errorMessage = `Error léxico: el símbolo '@' NO pertenece al alfabeto permitido para ${this.config.name}.`;
                    suggestion = 'En este subconjunto léxico didáctico, el carácter @ es ilegal.';
                } else if (offensiveChar === '$' && !this.config.allowDollarInIdent) {
                    errorMessage = `Carácter ilegal: el símbolo '$' no es válido en ${this.config.name} para nombres ni operadores.`;
                    suggestion = 'El carácter $ solo se permite en identificadores de lenguajes como JavaScript.';
                } else if (offensiveChar === '`' && this.config.id !== 'javascript') {
                    errorMessage = `Carácter ilegal: el acento grave (\`) no es un delimitador de cadena válido en ${this.config.name}.`;
                } else if (offensiveChar === '?') {
                    errorMessage = `Carácter fuera del alfabeto: '?' no forma parte de los operadores de ${this.config.name}.`;
                }

                this.addError(startLine, startCol, offensiveChar, errorMessage, suggestion, startIndex, this.index);
            }

            // 13. Detección didáctica de avisos sintácticos
            this.analyzeSyntacticNotices();

            return {
                tokens: this.tokens,
                errors: this.errors,
                syntacticNotices: this.syntacticNotices,
                isValidLexically: this.errors.length === 0
            };
        }

        skipWhitespace() {
            let skipped = false;
            while (this.index < this.length) {
                const char = this.source[this.index];
                if (char === ' ' || char === '\t' || char === '\r') {
                    this.index++;
                    this.column++;
                    skipped = true;
                } else if (char === '\n') {
                    this.index++;
                    this.line++;
                    this.column = 1;
                    skipped = true;
                } else {
                    break;
                }
            }
            return skipped;
        }

        isDigit(char) {
            return char >= '0' && char <= '9';
        }

        isOctalDigit(char) {
            return char >= '0' && char <= '7';
        }

        isHexDigit(char) {
            return (
                (char >= '0' && char <= '9') ||
                (char >= 'a' && char <= 'f') ||
                (char >= 'A' && char <= 'F')
            );
        }

        isAlpha(char) {
            return (
                (char >= 'a' && char <= 'z') ||
                (char >= 'A' && char <= 'Z') ||
                char === '_'
            );
        }

        isValidIdentifierStart(char) {
            return this.isAlpha(char) || (this.config.allowDollarInIdent && char === '$');
        }

        isValidIdentifierPart(char) {
            return this.isAlpha(char) || (char >= '0' && char <= '9') || (this.config.allowDollarInIdent && char === '$');
        }

        isStartOfDirective() {
            let i = this.index - 1;
            while (i >= 0) {
                const c = this.source[i];
                if (c === '\n') return true;
                if (c !== ' ' && c !== '\t' && c !== '\r') return false;
                i--;
            }
            return true;
        }

        scanPreprocessorDirective(startLine, startCol, startIndex) {
            while (this.index < this.length && this.source[this.index] !== '\n') {
                this.advance();
            }
            const lexeme = this.source.slice(startIndex, this.index);
            this.addToken(
                TOKEN_CATEGORIES.PREPROCESSOR,
                lexeme,
                startLine,
                startCol,
                startIndex,
                this.index
            );
        }

        checkComment(startLine, startCol, startIndex) {
            if (this.config.comments.line && this.matches(this.config.comments.line)) {
                while (this.index < this.length && this.source[this.index] !== '\n') {
                    this.advance();
                }
                const lexeme = this.source.slice(startIndex, this.index);
                this.addToken(
                    TOKEN_CATEGORIES.COMMENT,
                    lexeme,
                    startLine,
                    startCol,
                    startIndex,
                    this.index
                );
                return true;
            }

            if (this.config.comments.blockStart && this.matches(this.config.comments.blockStart)) {
                this.advance(); // '/'
                this.advance(); // '*'
                let closed = false;

                while (this.index < this.length) {
                    if (this.matches(this.config.comments.blockEnd)) {
                        this.advance(); // '*'
                        this.advance(); // '/'
                        closed = true;
                        break;
                    }
                    this.advance();
                }

                const lexeme = this.source.slice(startIndex, this.index);
                if (!closed) {
                    this.addError(
                        startLine,
                        startCol,
                        lexeme,
                        "Error léxico: comentario de bloque sin cerrar. Falta el delimitador '*/' antes del fin del archivo.",
                        "Agregue '*/' para cerrar el bloque de comentario.",
                        startIndex,
                        this.index
                    );
                } else {
                    this.addToken(
                        TOKEN_CATEGORIES.COMMENT,
                        lexeme,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                }
                return true;
            }

            return false;
        }

        checkMultilineString(startLine, startCol, startIndex) {
            const multi = this.config.strings.multiLine;
            if (!multi || multi.length === 0) return false;

            for (let d = 0; d < multi.length; d++) {
                const delimiter = multi[d];
                if (this.matches(delimiter)) {
                    const dLen = delimiter.length;
                    for (let i = 0; i < dLen; i++) this.advance();
                    let closed = false;

                    while (this.index < this.length) {
                        if (this.source[this.index] === '\\') {
                            this.advance();
                            if (this.index < this.length) this.advance();
                            continue;
                        }

                        if (this.matches(delimiter)) {
                            for (let i = 0; i < dLen; i++) this.advance();
                            closed = true;
                            break;
                        }
                        this.advance();
                    }

                    const lexeme = this.source.slice(startIndex, this.index);
                    if (!closed) {
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: cadena multilínea sin cerrar. Falta el delimitador de cierre '${delimiter}' antes del fin de archivo.`,
                            `Cierre la cadena con '${delimiter}'.`,
                            startIndex,
                            this.index
                        );
                    } else {
                        this.addToken(
                            TOKEN_CATEGORIES.STRING,
                            lexeme,
                            startLine,
                            startCol,
                            startIndex,
                            this.index
                        );
                    }
                    return true;
                }
            }
            return false;
        }

        scanSingleLineString(quoteChar, startLine, startCol, startIndex) {
            this.advance(); // Consumir comilla
            let closed = false;

            while (this.index < this.length) {
                const char = this.source[this.index];
                if (char === '\n') break;

                if (char === '\\') {
                    this.advance();
                    if (this.index < this.length && this.source[this.index] !== '\n') {
                        this.advance();
                    }
                    continue;
                }

                if (char === quoteChar) {
                    this.advance();
                    closed = true;
                    break;
                }

                this.advance();
            }

            const lexeme = this.source.slice(startIndex, this.index);

            if (!closed) {
                this.addError(
                    startLine,
                    startCol,
                    lexeme,
                    `Error léxico: cadena sin cerrar. Falta la comilla de cierre ('${quoteChar}') antes del fin de línea.`,
                    `Agregue la comilla de cierre '${quoteChar}' antes del salto de línea.`,
                    startIndex,
                    this.index
                );
            } else {
                this.addToken(
                    TOKEN_CATEGORIES.STRING,
                    lexeme,
                    startLine,
                    startCol,
                    startIndex,
                    this.index
                );
            }
        }

        scanCharLiteral(startLine, startCol, startIndex) {
            this.advance(); // Consumir comilla simple
            const contentChars = [];
            let closed = false;

            while (this.index < this.length) {
                const char = this.source[this.index];
                if (char === '\n') break;

                if (char === '\\') {
                    const escStart = this.index;
                    this.advance();
                    if (this.index < this.length && this.source[this.index] !== '\n') {
                        this.advance();
                    }
                    contentChars.push(this.source.slice(escStart, this.index));
                    continue;
                }

                if (char === "'") {
                    this.advance();
                    closed = true;
                    break;
                }

                contentChars.push(this.advance());
            }

            const lexeme = this.source.slice(startIndex, this.index);

            if (!closed) {
                this.addError(
                    startLine,
                    startCol,
                    lexeme,
                    "Error léxico: literal de carácter sin cerrar. Falta la comilla simple de cierre (').",
                    "Agregue la comilla simple de cierre antes del fin de línea.",
                    startIndex,
                    this.index
                );
                return;
            }

            if (contentChars.length === 0) {
                this.addError(
                    startLine,
                    startCol,
                    lexeme,
                    "Error léxico: literal de carácter inválido. En C un literal de carácter no puede estar vacío ('').",
                    "Especifique un carácter dentro de las comillas simples, por ejemplo 'a'.",
                    startIndex,
                    this.index
                );
                return;
            }

            if (contentChars.length > 1) {
                this.addError(
                    startLine,
                    startCol,
                    lexeme,
                    `Error léxico: literal de carácter inválido (${lexeme}). En C solo se admite un único carácter entre comillas simples; para múltiples caracteres use comillas dobles ("...").`,
                    `Cambie ${lexeme} por comillas dobles si se trata de una cadena.`,
                    startIndex,
                    this.index
                );
                return;
            }

            this.addToken(
                TOKEN_CATEGORIES.CHAR,
                lexeme,
                startLine,
                startCol,
                startIndex,
                this.index
            );
        }

        scanNumber(startLine, startCol, startIndex) {
            const firstChar = this.source[startIndex];

            // 1. Hexadecimal: 0x o 0X
            if (firstChar === '0') {
                const nextChar = this.peekAhead(1);
                if (nextChar === 'x' || nextChar === 'X') {
                    this.advance(); // '0'
                    this.advance(); // 'x'
                    let hexCount = 0;

                    while (this.index < this.length && this.isHexDigit(this.source[this.index])) {
                        this.advance();
                        hexCount++;
                    }

                    if (hexCount === 0) {
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: prefijo hexadecimal '${lexeme}' sin dígitos hexadecimales.`,
                            "Agregue al menos un dígito hexadecimal válido (0-9, a-f, A-F) después de '0x'.",
                            startIndex,
                            this.index
                        );
                        return;
                    }

                    if (this.index < this.length && this.isAlpha(this.source[this.index])) {
                        while (this.index < this.length && (this.isAlpha(this.source[this.index]) || this.isDigit(this.source[this.index]))) {
                            this.advance();
                        }
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: sufijo hexadecimal inválido en '${lexeme}'.`,
                            "Solo se admiten caracteres hexadecimales válidos.",
                            startIndex,
                            this.index
                        );
                        return;
                    }

                    const lexeme = this.source.slice(startIndex, this.index);
                    this.addToken(
                        TOKEN_CATEGORIES.INT_NUMBER,
                        lexeme,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                    return;
                }

                // 2. Binario: 0b o 0B
                if (nextChar === 'b' || nextChar === 'B') {
                    this.advance(); // '0'
                    this.advance(); // 'b'
                    let binCount = 0;

                    while (this.index < this.length && (this.source[this.index] === '0' || this.source[this.index] === '1')) {
                        this.advance();
                        binCount++;
                    }

                    if (binCount === 0) {
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: prefijo binario '${lexeme}' sin dígitos binarios.`,
                            "Agregue dígitos binarios (0 o 1) tras '0b'.",
                            startIndex,
                            this.index
                        );
                        return;
                    }

                    if (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                        while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                            this.advance();
                        }
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: dígito binario inválido en '${lexeme}'. Solo se admiten 0 y 1.`,
                            "Remueva los dígitos inválidos.",
                            startIndex,
                            this.index
                        );
                        return;
                    }

                    const lexeme = this.source.slice(startIndex, this.index);
                    this.addToken(
                        TOKEN_CATEGORIES.INT_NUMBER,
                        lexeme,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                    return;
                }

                // 3. Octal explícito: 0o o 0O
                if (nextChar === 'o' || nextChar === 'O') {
                    this.advance(); // '0'
                    this.advance(); // 'o'
                    let octCount = 0;

                    while (this.index < this.length && this.isOctalDigit(this.source[this.index])) {
                        this.advance();
                        octCount++;
                    }

                    if (octCount === 0) {
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: prefijo octal '${lexeme}' sin dígitos octales.`,
                            "Agregue al menos un dígito octal (0-7) tras '0o'.",
                            startIndex,
                            this.index
                        );
                        return;
                    }

                    const lexeme = this.source.slice(startIndex, this.index);
                    this.addToken(
                        TOKEN_CATEGORIES.INT_NUMBER,
                        lexeme,
                        startLine,
                        startCol,
                        startIndex,
                        this.index
                    );
                    return;
                }

                // 4. Caso Especial de C: Octal que inicia con 0 (08 es error léxico)
                if (this.config.numbers.cStyleOctal && this.isDigit(nextChar)) {
                    let isFloat = false;
                    let look = this.index + 1;
                    while (look < this.length && this.isDigit(this.source[look])) {
                        look++;
                    }
                    if (look < this.length && this.source[look] === '.') {
                        isFloat = true;
                    }

                    if (!isFloat) {
                        let hasInvalidOctalDigit = false;
                        while (this.index < this.length && this.isDigit(this.source[this.index])) {
                            const digit = this.advance();
                            if (digit === '8' || digit === '9') {
                                hasInvalidOctalDigit = true;
                            }
                        }

                        if (this.index < this.length && this.isAlpha(this.source[this.index])) {
                            while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                                this.advance();
                            }
                            const lexeme = this.source.slice(startIndex, this.index);
                            this.addError(
                                startLine,
                                startCol,
                                lexeme,
                                `Error léxico: identificador mal formado iniciando con dígitos ('${lexeme}').`,
                                "Los identificadores no pueden iniciar con dígitos.",
                                startIndex,
                                this.index
                            );
                            return;
                        }

                        const lexeme = this.source.slice(startIndex, this.index);
                        if (hasInvalidOctalDigit) {
                            this.addError(
                                startLine,
                                startCol,
                                lexeme,
                                `Error léxico: dígito no octal en literal '${lexeme}'. En C, un número entero que inicia con 0 es octal y solo admite dígitos del 0 al 7.`,
                                "Remueva los dígitos 8 o 9, o quite el cero inicial si deseaba un entero decimal.",
                                startIndex,
                                this.index
                            );
                            return;
                        }

                        this.addToken(
                            TOKEN_CATEGORIES.INT_NUMBER,
                            lexeme,
                            startLine,
                            startCol,
                            startIndex,
                            this.index
                        );
                        return;
                    }
                }

                // 5. Caso Especial de Python: Ceros a la izquierda no permitidos (ej: 007)
                if (!this.config.numbers.allowLeadingZeros && this.isDigit(nextChar)) {
                    let isFloat = false;
                    let look = this.index + 1;
                    while (look < this.length && this.isDigit(this.source[look])) {
                        look++;
                    }
                    if (look < this.length && this.source[look] === '.') {
                        isFloat = true;
                    }

                    if (!isFloat) {
                        while (this.index < this.length && this.isDigit(this.source[this.index])) {
                            this.advance();
                        }
                        if (this.index < this.length && this.isAlpha(this.source[this.index])) {
                            while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                                this.advance();
                            }
                        }

                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: ceros a la izquierda no permitidos en ${this.config.name} ('${lexeme}').`,
                            "En Python no se permiten ceros iniciales en enteros decimales. Para base octal use el prefijo '0o'.",
                            startIndex,
                            this.index
                        );
                        return;
                    }
                }
            }

            // 6. Dígitos enteros estándar
            while (this.index < this.length && this.isDigit(this.source[this.index])) {
                this.advance();
            }

            let isDecimal = false;

            // 7. Punto decimal
            if (this.index < this.length && this.source[this.index] === '.') {
                if (this.peekAhead(1) !== '.') {
                    isDecimal = true;
                    this.advance(); // Consumir '.'

                    while (this.index < this.length && this.isDigit(this.source[this.index])) {
                        this.advance();
                    }

                    // 8. Error: Múltiples puntos decimales (1.2.3)
                    if (this.index < this.length && this.source[this.index] === '.' && this.isDigit(this.peekAhead(1))) {
                        while (this.index < this.length && (this.isDigit(this.source[this.index]) || this.source[this.index] === '.' || this.isAlpha(this.source[this.index]))) {
                            this.advance();
                        }
                        const lexeme = this.source.slice(startIndex, this.index);
                        this.addError(
                            startLine,
                            startCol,
                            lexeme,
                            `Error léxico: número mal formado con múltiples puntos decimales ('${lexeme}').`,
                            "Un literal numérico solo puede contener un punto decimal.",
                            startIndex,
                            this.index
                        );
                        return;
                    }
                }
            }

            // 9. Notación Científica (1e5, 2.5e-3)
            if (this.index < this.length && (this.source[this.index] === 'e' || this.source[this.index] === 'E')) {
                this.advance(); // 'e' o 'E'
                isDecimal = true;

                if (this.index < this.length && (this.source[this.index] === '+' || this.source[this.index] === '-')) {
                    this.advance();
                }

                let expDigits = 0;
                while (this.index < this.length && this.isDigit(this.source[this.index])) {
                    this.advance();
                    expDigits++;
                }

                if (expDigits === 0) {
                    while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                        this.advance();
                    }
                    const lexeme = this.source.slice(startIndex, this.index);
                    this.addError(
                        startLine,
                        startCol,
                        lexeme,
                        `Error léxico: exponente incompleto en número ('${lexeme}'). Falta el exponente tras 'e'.`,
                        "Especifique uno o más dígitos tras el exponente (por ejemplo, 1e2).",
                        startIndex,
                        this.index
                    );
                    return;
                }
            }

            // 10. Error: Identificador que inicia con dígito (12abc)
            if (this.index < this.length && this.isAlpha(this.source[this.index])) {
                while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                    this.advance();
                }
                const lexeme = this.source.slice(startIndex, this.index);
                this.addError(
                    startLine,
                    startCol,
                    lexeme,
                    `Error léxico: identificador inválido que inicia con dígito ('${lexeme}').`,
                    "Los identificadores deben iniciar con una letra o guion bajo (_), nunca con un dígito.",
                    startIndex,
                    this.index
                );
                return;
            }

            const lexeme = this.source.slice(startIndex, this.index);
            this.addToken(
                isDecimal ? TOKEN_CATEGORIES.FLOAT_NUMBER : TOKEN_CATEGORIES.INT_NUMBER,
                lexeme,
                startLine,
                startCol,
                startIndex,
                this.index
            );
        }

        matchOperator() {
            const ops = this.sortedOperators;
            const opCount = ops.length;
            for (let i = 0; i < opCount; i++) {
                if (this.matches(ops[i])) {
                    return ops[i];
                }
            }
            return null;
        }

        scanIdentifierOrKeyword(startLine, startCol, startIndex) {
            while (this.index < this.length && this.isValidIdentifierPart(this.source[this.index])) {
                this.advance();
            }

            const lexeme = this.source.slice(startIndex, this.index);
            const isKeyword = this.config.keywords.has(lexeme);
            const tokenType = isKeyword ? TOKEN_CATEGORIES.KEYWORD : TOKEN_CATEGORIES.IDENTIFIER;

            this.addToken(
                tokenType,
                lexeme,
                startLine,
                startCol,
                startIndex,
                this.index
            );
        }

        analyzeSyntacticNotices() {
            const codeTokens = this.tokens.filter(t => t.type !== TOKEN_CATEGORIES.COMMENT);
            const count = codeTokens.length;

            for (let i = 0; i < count - 1; i++) {
                const current = codeTokens[i];
                const next = codeTokens[i + 1];

                if (current.type === TOKEN_CATEGORIES.OPERATOR && next.type === TOKEN_CATEGORIES.OPERATOR) {
                    const isUnary = (next.value === '+' || next.value === '-') &&
                                    (current.value === '=' || current.value === '+' || current.value === '-');

                    if (
                        (current.value === '+' && next.value === '*') ||
                        (current.value === '*' && next.value === '+') ||
                        (current.value === '+' && next.value === '/') ||
                        (current.value === '-' && next.value === '*') ||
                        (current.value === '*' && next.value === '/') ||
                        (current.value === '/' && next.value === '*') ||
                        (current.value === '%' && next.value === '*') ||
                        (!isUnary && ['+', '-', '*', '/', '%', '<=', '>=', '==', '!='].includes(current.value) &&
                         ['*', '/', '%', '<=', '>=', '==', '!='].includes(next.value))
                    ) {
                        this.syntacticNotices.push({
                            line: next.line,
                            column: next.column,
                            tokensInvolved: `'${current.value}' seguido de '${next.value}'`,
                            message: `Aviso sintáctico (NO léxico): Dos operadores consecutivos incompatibles ('${current.value}' y '${next.value}').`,
                            explanation: `Todos los tokens reconocidos son léxicamente VÁLIDOS de forma individual. Sin embargo, la estructura gramatical es incorrecta: dos operadores binarios contiguos violan las reglas sintácticas del lenguaje (falta un operando intermedio). El analizador sintáctico (parser) rechazaría esta expresión.`
                        });
                    }
                }
            }
        }
    }

    // =========================================================================
    // 4. EXPORTACIÓN UMD
    // =========================================================================

    const PBL_LexerModule = {
        TOKEN_CATEGORIES,
        PYTHON_CONFIG,
        JAVASCRIPT_CONFIG,
        C_CONFIG,
        LANGUAGE_REGISTRY,
        Lexer
    };

    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = PBL_LexerModule;
    }
    if (typeof window !== 'undefined') {
        window.PBL_Lexer = PBL_LexerModule;
    }
    global.PBL_Lexer = PBL_LexerModule;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
