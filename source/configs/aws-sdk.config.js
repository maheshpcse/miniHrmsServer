var moment = require('moment-timezone');
// const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const AWS = require('aws-sdk');

// Handling AWS Secret Manager (V3)
async function getSecretKeysFromAWSSDKV3() {
    const secret_name = "Aws.Mysql";

    const sManager = new AWS.SecretsManager({});

    const client = new SecretsManagerClient({
        region: "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        useDualstackEndpoint: false
    });

    const command = new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
    });

    let response;

    try {
        response = await client.send(command);
        console.log('AWS Client response isss:', response);
    } catch (error) {
        // For a list of exceptions thrown, see
        // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        console.log('AWS try catch error isss:', error);
        throw error;
    }

    const secret = response.SecretString;
    console.log('AWS secret isss:', secret);

    // Your code goes here
}
// End

// Handling AWS Secret Manager (V2)
async function getSecretKeysFromAWSSDKV2() {
    const secret_name = "Aws.Mysql";

    AWS.config.update({ region: 'us-east-1' });

    const client = new AWS.SecretsManager({
        region: "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });

    try {
        client.getSecretValue({
            SecretId: secret_name,
            // VersionId: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
            // VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
        }, async (err, data) => {
            if (err) {
                console.log('err in getSecretValue', err);
            } else {
                console.log('data in getSecretValue', data);
                const secret = JSON.parse(data['SecretString']);
                console.log('AWS secret isss:', secret);

                // Your code goes here
            }
        });
    } catch (error) {
        console.log('AWS try catch error isss:', error);
        throw error;
    }
}
// End

// getSecretKeysFromAWSSDKV3();
getSecretKeysFromAWSSDKV2();