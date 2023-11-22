require('dotenv').config();
const Promise = require('bluebird');
const { objection } = require('objection');
const Knexx = require('../configs/knex.js');
const dbConfig = require('../configs/db.config.js');

// SELECT/READ data Stored Procedure
const selectDataSP = function (spName, inputParams, outputParams) {
    return new Promise((resolve, reject) => {
        let finalSP = `CALL ${spName}(${generateInputs(inputParams.length)})`;

        let mod = Knexx.knex.transaction(trx => {
            return Knexx.knex.raw(finalSP, inputParams);
        });
        mod.then(result => {
            if (result && result.length && result[0].length && result[0][0].length) {
                if (result[0][0].length > 1) {
                    resolve(result);
                } else {
                    resolve(result[0][0]);
                }
            } else {
                resolve([]);
            }
        }).catch(error => {
            reject(error);
        });

        // with mysql connection
        // dbConfig.connection.query(finalSP, inputParams, (error, results, fields) => {
        //     if (error) {
        //         reject(error);
        //     }
        //     results = results && results.length && results[0] ? results[0] : [];
        //     resolve(results);
        // });
    });
}

// INSERT/UPDATE data Stored Procedure
const insertOrUpdateDataSP = function (spName, inputParams, outputParams) {
    return new Promise((resolve, reject) => {
        let finalSP = `CALL ${spName}(${generateInputs(inputParams.length)})`;

        let mod = Knexx.knex.transaction(trx => {
            return Knexx.knex.raw(finalSP, inputParams);
        });
        mod.then(result => {
            result = result && result.length && result[0].length ? result[0][0] : [];
            resolve(result);
        }).catch(error => {
            reject(error);
        });

        // with mysql connection
        // dbConfig.connection.query(finalSP, inputParams, (error, results, fields) => {
        //     if (error) {
        //         reject(error);
        //     }
        //     results = results && results.length && results[0] ? results[0] : [];
        //     resolve(results);
        // });
    });
}

// generate Inputs
function generateInputs(num) {
    let array = [];
    for (let i = 0; i < num; i++) {
        array.push('?');
    }
    return array.join();
}

module.exports = {
    selectDataSP,
    insertOrUpdateDataSP
}