'use strict';
const { assertDatabaseTarget } = require('../source/configs/database-target');

const tables = require('../database/schema/tables.json');
const quote = value => '`' + value.replace(/`/g, '``') + '`';
const normalizeType = value => value.toLowerCase().replace(/\bint\(\d+\)/g, 'int');

// MySQL DDL commits implicitly. Validate all known tables before the first change.
exports.config = { transaction: false };
exports.up = async function (knex) {
    await assertDatabaseTarget(knex);
    const [columns] = await knex.raw('SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
    const [foreignKeys] = await knex.raw(`SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME,
        k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE
        FROM information_schema.KEY_COLUMN_USAGE k
        JOIN information_schema.REFERENTIAL_CONSTRAINTS r
          ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
          AND r.TABLE_NAME = k.TABLE_NAME
        WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`);
    const changes = [];
    const missing = [];
    for (const table of tables) {
        const current = columns.filter(c => c.TABLE_NAME === table.name);
        if (!current.length) { missing.push(table); continue; }
        const knownNames = table.columns.map(c => c.name);
        const legacyFirstName = table.name === 'employees' && current.some(c => c.COLUMN_NAME === 'fisrtName');
        if (legacyFirstName && current.some(c => c.COLUMN_NAME === 'firstName')) {
            throw new Error('employees has both firstName and fisrtName; reconcile them before migrating.');
        }
        for (const column of current) {
            if (!knownNames.includes(column.COLUMN_NAME) && !(legacyFirstName && column.COLUMN_NAME === 'fisrtName')) {
                throw new Error(`Unexpected column ${table.name}.${column.COLUMN_NAME}; review schema drift before migrating.`);
            }
        }
        for (const column of table.columns) {
            const name = legacyFirstName && column.name === 'firstName' ? 'fisrtName' : column.name;
            const old = current.find(c => c.COLUMN_NAME === name);
            if (!old) {
                if (table.name === 'employee_bank_details' && column.name === 'personalBanksInfo') {
                    changes.push(`ALTER TABLE ${quote(table.name)} ADD COLUMN ${quote(column.name)} ${column.definition} AFTER generalInfo`);
                    continue;
                }
                throw new Error(`Missing column ${table.name}.${column.name}; unsupported legacy schema.`);
            }
            const isApprover = table.name === 'employee_onboarding_details' && column.name === 'approvedBy';
            const expectedType = normalizeType(column.definition.split(' ')[0]);
            if (normalizeType(old.COLUMN_TYPE) !== expectedType && !(isApprover && old.COLUMN_TYPE === 'varchar(20)')) {
                throw new Error(`Unexpected type for ${table.name}.${name}: ${old.COLUMN_TYPE}.`);
            }
            const nullable = !/\bNOT NULL\b/i.test(column.definition);
            if (!isApprover && (old.IS_NULLABLE === 'YES') !== nullable) {
                throw new Error(`Unexpected nullability for ${table.name}.${name}.`);
            }
            if (legacyFirstName && column.name === 'firstName') {
                changes.push(`ALTER TABLE employees CHANGE COLUMN fisrtName firstName ${column.definition}`);
            }
            if (isApprover && (old.COLUMN_TYPE !== 'varchar(50)' || old.COLUMN_DEFAULT !== null || old.IS_NULLABLE !== 'YES')) {
                const refs = foreignKeys.filter(f => f.TABLE_NAME === table.name && f.COLUMN_NAME === name);
                const clauses = refs.map(f => 'DROP FOREIGN KEY ' + quote(f.CONSTRAINT_NAME));
                // Retain the source collation so an existing employees FK stays compatible.
                const collation = old.COLLATION_NAME ? ` CHARACTER SET ${old.CHARACTER_SET_NAME} COLLATE ${old.COLLATION_NAME}` : '';
                clauses.push('MODIFY COLUMN approvedBy varchar(50)' + collation + ' NULL DEFAULT NULL');
                clauses.push(...refs.map(f => `ADD CONSTRAINT ${quote(f.CONSTRAINT_NAME + "_v2")} FOREIGN KEY (approvedBy) REFERENCES ${quote(f.REFERENCED_TABLE_NAME)} (${quote(f.REFERENCED_COLUMN_NAME)}) ON UPDATE ${f.UPDATE_RULE} ON DELETE ${f.DELETE_RULE}`));
                changes.push(`ALTER TABLE ${quote(table.name)} ${clauses.join(', ')}`);
            }
        }
        const [indexRows] = await knex.raw('SHOW INDEX FROM ' + quote(table.name));
        const indexes = Object.values(indexRows.reduce((all, row) => {
            const index = all[row.Key_name] || (all[row.Key_name] = { name: row.Key_name, unique: !row.Non_unique, columns: [] });
            index.columns[row.Seq_in_index - 1] = row.Column_name;
            return all;
        }, {}));
        const attendance = ['employee_attendance_details', 'audit_employee_attendance'].includes(table.name);
        const obsolete = attendance ? indexes.filter(i => i.unique && i.name !== 'PRIMARY' && i.columns.join(',') === 'empId') : [];
        if (obsolete.length) {
            // Add the supporting FK index before removing the one-row-per-employee restriction.
            if (!indexes.some(i => !i.unique && i.columns[0] === 'empId')) {
                changes.push(`ALTER TABLE ${quote(table.name)} ADD KEY attendance_empId (empId), ${obsolete.map(i => 'DROP INDEX ' + quote(i.name)).join(', ')}`);
            } else changes.push(`ALTER TABLE ${quote(table.name)} ${obsolete.map(i => 'DROP INDEX ' + quote(i.name)).join(', ')}`);
        }
        for (const match of table.sql.matchAll(/^  (PRIMARY KEY|UNIQUE KEY `([^`]+)`|KEY `([^`]+)`) \(([^)]+)\)/gm)) {
            const keys = [...match[4].matchAll(/`([^`]+)`/g)].map(m => m[1]);
            const unique = !match[1].startsWith('KEY ');
            if (attendance && !unique && keys.join(',') === 'empId' && obsolete.length) continue;
            if (indexes.some(i => i.columns.join(',') === keys.join(',') && i.unique === unique)) continue;
            if (unique) {
                const [duplicates] = await knex.raw(`SELECT 1 FROM ${quote(table.name)} WHERE ${keys.map(k => quote(k) + ' IS NOT NULL').join(' AND ')} GROUP BY ${keys.map(quote).join(',')} HAVING COUNT(*) > 1 LIMIT 1`);
                if (duplicates.length) throw new Error(`Duplicate values prevent required index on ${table.name}(${keys.join(',')}).`);
            }
            const indexName = match[2] || match[3] || 'PRIMARY';
            if (indexes.some(i => i.name === indexName)) throw new Error(`Conflicting index ${table.name}.${indexName}.`);
            changes.push(`ALTER TABLE ${quote(table.name)} ADD ${match[0].trim()}`);
        }
        for (const match of table.sql.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)/g)) {
            const [, constraint, child, parent, parentColumn] = match;
            const parentExists = columns.some(c => c.TABLE_NAME === parent);
            const [orphans] = await knex.raw(parentExists
                ? `SELECT 1 FROM ${quote(table.name)} c LEFT JOIN ${quote(parent)} p ON c.${quote(child)} = p.${quote(parentColumn)} WHERE c.${quote(child)} IS NOT NULL AND p.${quote(parentColumn)} IS NULL LIMIT 1`
                : `SELECT 1 FROM ${quote(table.name)} WHERE ${quote(child)} IS NOT NULL LIMIT 1`);
            if (orphans.length) throw new Error(`Orphan reference in ${table.name}.${child}; repair data before migrating.`);
            if (!foreignKeys.some(f => f.TABLE_NAME === table.name && f.COLUMN_NAME === child && f.REFERENCED_TABLE_NAME === parent && f.REFERENCED_COLUMN_NAME === parentColumn)) {
                changes.push(`ALTER TABLE ${quote(table.name)} ADD ${match[0]}`);
            }
        }
    }
    // Parent first; missing child tables and known upgrades never delete existing rows.
    for (const table of missing) await knex.raw(table.sql);
    for (const sql of changes) await knex.raw(sql);
};

exports.down = async function () {
    throw new Error('Forward-only schema reconciliation: restore a reviewed backup instead of dropping HR records.');
};
