/**
 * JSON Schema validation for data files
 * Uses Ajv loaded from CDN
 */

let ajvInstance = null;
let validators = {};

/**
 * Check if validation should be skipped (production mode)
 * Skip validation on non-localhost hosts to reduce startup time
 * @returns {boolean} True if validation should be skipped
 */
export function shouldSkipValidation() {
    const host = window.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '';
}

/**
 * Initialize Ajv and compile schemas
 * @param {Object} schemas - Schema objects including commonDefinitions for shared refs
 */
export function initValidation(schemas) {
    if (typeof Ajv === 'undefined') {
        throw new Error('Ajv library not loaded. Ensure CDN script is included before this module.');
    }

    ajvInstance = new Ajv({ allErrors: true, strict: false });

    // Register common definitions schema first for cross-file $ref support
    if (schemas.commonDefinitions) {
        ajvInstance.addSchema(schemas.commonDefinitions, 'common-definitions.schema.json');
    }

    // Compile all provided schemas (core schemas at startup)
    for (const [name, schema] of Object.entries(schemas)) {
        if (name !== 'commonDefinitions' && schema) {
            validators[name] = ajvInstance.compile(schema);
        }
    }
}

/**
 * Add and compile a schema after initialization (for lazy-loaded data)
 * @param {string} name - Schema name (e.g., 'fragrances')
 * @param {Object} schema - JSON schema object
 */
export function addSchema(name, schema) {
    if (!ajvInstance) {
        throw new Error('Validation not initialized. Call initValidation first.');
    }
    validators[name] = ajvInstance.compile(schema);
}

/**
 * Validate data against schema
 * @param {string} schemaName - Schema name (e.g., 'fats', 'glossary', 'fragrances')
 * @param {Object} data - Data to validate
 * @returns {{valid: boolean, errors: Array|null}}
 */
export function validate(schemaName, data) {
    const validator = validators[schemaName];
    if (!validator) {
        throw new Error(`Unknown schema: ${schemaName}`);
    }

    const valid = validator(data);
    return {
        valid,
        errors: valid ? null : validator.errors
    };
}

/**
 * Format validation errors for display
 * @param {Array} errors - Ajv error array
 * @returns {string} Human-readable error message
 */
export function formatErrors(errors) {
    return errors.map(err => {
        const path = err.instancePath || 'root';
        return `  ${path}: ${err.message}`;
    }).join('\n');
}

/**
 * Validate all data files and throw on failure (strict mode)
 * Skips validation in production (non-localhost) for faster startup
 * @param {Object} data - All data objects to validate against their schemas
 * @throws {Error} If any validation fails
 */
export function validateAllStrict(data) {
    if (shouldSkipValidation()) {
        console.log('Skipping validation in production mode');
        return;
    }

    const results = {};
    for (const [name, dataset] of Object.entries(data)) {
        results[name] = validate(name, dataset);
    }

    const failures = Object.entries(results)
        .filter(([_, result]) => !result.valid);

    if (failures.length > 0) {
        const messages = failures.map(([name, result]) =>
            `${name}.json validation failed:\n${formatErrors(result.errors)}`
        );
        throw new Error(`Data validation failed:\n\n${messages.join('\n\n')}`);
    }

    console.log('All data files validated successfully');
}
