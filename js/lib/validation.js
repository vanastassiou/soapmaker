/**
 * JSON Schema validation for data files
 * Uses Ajv loaded from CDN
 */

let ajvInstance = null;
let validators = {};

/**
 * Initialize Ajv and compile schemas
 * @param {Object} schemas - {fats: schema, glossary: schema, fattyAcids: schema, additives: schema}
 */
export function initValidation(schemas) {
    if (typeof Ajv === 'undefined') {
        throw new Error('Ajv library not loaded. Ensure CDN script is included before this module.');
    }

    ajvInstance = new Ajv({ allErrors: true, strict: false });

    validators = {
        fats: ajvInstance.compile(schemas.fats),
        glossary: ajvInstance.compile(schemas.glossary),
        fattyAcids: ajvInstance.compile(schemas.fattyAcids),
        additives: ajvInstance.compile(schemas.additives)
    };
}

/**
 * Validate data against schema
 * @param {string} schemaName - 'fats', 'glossary', 'fattyAcids', or 'additives'
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
 * @param {Object} data - {fats, glossary, fattyAcids, additives}
 * @throws {Error} If any validation fails
 */
export function validateAllStrict(data) {
    const results = {
        fats: validate('fats', data.fats),
        glossary: validate('glossary', data.glossary),
        fattyAcids: validate('fattyAcids', data.fattyAcids),
        additives: validate('additives', data.additives)
    };

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
