const https = require('https');
const process = require('process');
const fs = require('fs');
const path = require('path');
const { XrplAccount, XrplApi, EvernodeConstants, Defaults } = require('evernode-js-client');
const {Currencies} = require("./constants");

const TRUSTLINE_EVR_LIMIT = "9999999999999999e80";
const TOTAL_MINTED_EVRS = "99999999999";
const ACCOUNT_DIR = 'accounts'
const ACCOUNT_FILE = 'accounts.json';

const FAUCETS_URL = process.env.CONF_FAUCETS_URL || 'https://xahau-test.net/newcreds';
const RIPPLED_URL = process.env.CONF_RIPPLED_URL || 'wss://xahau-test.net';

const accounts = ["issuer", "foundation"];

const configTemplate = {
    issuer: {
        address: "",
        secret: ""
    },
    foundation: {
        address: "",
        secret: ""
    }
};

let xrplApi = null;

async function initEvernode() {
    Defaults.set({
        networkID: 21338
    });
    if (RIPPLED_URL)
        Defaults.set({
            rippledServer: RIPPLED_URL
        });
    // BEGIN - Connect to XRPL API
    xrplApi = new XrplApi();
    Defaults.set({
        xrplApi: xrplApi
    })
    await xrplApi.connect();
}

async function deinitEvernode() {
    if (xrplApi)
        await xrplApi.disconnect();
}

function httpPost(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'POST' }, (resp) => {
            let data = '';
            resp.on('data', (chunk) => data += chunk);
            resp.on('end', () => {
                if (resp.statusCode == 200)
                    resolve(data);
                else
                    reject(data);
            });
        })

        req.on("error", reject);
        req.on('timeout', () => reject('Request timed out.'))
        req.end()
    })
}

function logAccountDetails(config) {
    // BEGIN - Log Account Details
    console.log('\nAccount Details -------------------------------------------------------');

    for (const account of Object.entries(config).filter(e => accounts.includes(e[0]))) {
        // Convert snake_case to camelCase.
        console.log(`Account name :${account[0].toUpperCase()}`);
        console.log(`Address : ${account[1].address}`);
        console.log(`Secret : ${resolveSecret(account[1])}`);
        console.log('-----------------------------------------------------------------------');

    }
    // END - Log Account Details
}

async function createFromFaucet(accountName) {
    // BEGIN - Account Creation
    console.log('Started to create XAH Account');

    const resp = await httpPost(FAUCETS_URL);
    const json = JSON.parse(resp);
    console.log(`Created ${accountName} Account`);

    // Keep 10 seconds gap between two API calls.
    await new Promise(r => setTimeout(r, 10000));

    return { address: json.address, secret: json.secret };
}

async function createIssuerAndFoundationAccounts() {
    const accounts = ['issuer', 'foundation'];
    const accJson = {};
    for(const acc of accounts) {
        accJson[acc] = await createFromFaucet(acc);
    }

    if (!fs.existsSync(ACCOUNT_DIR))
        fs.mkdirSync(ACCOUNT_DIR, { recursive: true });
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    fs.writeFileSync(account_file, JSON.stringify(accJson, null, 4));
    return true;
}

async function prepareIssuer() {
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    const fileBuf = fs.readFileSync(account_file)
    const accJson = JSON.parse(fileBuf.toString());

    // Setup issuer from master or regular keys.
    const issuerAcc = new XrplAccount(accJson.issuer.address, accJson.issuer.secret, { xrplApi : xrplApi});
    await issuerAcc.setAccountFields({ Flags: { asfDefaultRipple: true } });

    console.log('Enabled Rippling in ISSUER Account');
    console.log("Issuer setup completed");
    return true;
}

async function prepareFoundationTrustLine() {
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    const fileBuf = fs.readFileSync(account_file)
    const accJson = JSON.parse(fileBuf.toString());

    const foundationAcc = new XrplAccount(accJson.foundation.address, accJson.foundation.secret, { xrplApi: xrplApi});
    const foundationLines = await foundationAcc.getTrustLines(EvernodeConstants.EVR, accJson.issuer.address);
    if (foundationLines.length === 0) {
        await foundationAcc.setTrustLine(Currencies.EVR, accJson.issuer.address, TRUSTLINE_EVR_LIMIT);
    }

    console.log("Trust Lines initiated for foundation account.");
}

async function createTrustLine(secret, currency = null, issuerAddress = null) {
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    const fileBuf = fs.readFileSync(account_file)
    const accJson = JSON.parse(fileBuf.toString());

    if(!currency && !issuerAddress) {
        currency = Currencies.EVR;
        issuerAddress = accJson.issuer.address;
    }

    const account = new XrplAccount(null, secret, { xrplApi: xrplApi});
    const trustLines = await account.getTrustLines(currency, issuerAddress);
    if (trustLines.length === 0) {
        await account.setTrustLine(currency,issuerAddress, TRUSTLINE_EVR_LIMIT);
    }
    console.log("Trust Lines initiated.");
}

async function issueMintedTokens() {
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    const fileBuf = fs.readFileSync(account_file)
    const accJson = JSON.parse(fileBuf.toString());

    const issuer = new XrplAccount(accJson.issuer.address, accJson.issuer.secret, { xrplApi: xrplApi});
    await issuer.makePayment(accJson.foundation.address, TOTAL_MINTED_EVRS, Currencies.EVR, accJson.issuer.address);

    console.log(`${TOTAL_MINTED_EVRS} EVRs were issued to  Foundation account.`);

}

async function fundMyWallet(recipientSecret, everAmount ) {
    const account_file = path.resolve(ACCOUNT_DIR, ACCOUNT_FILE)
    const fileBuf = fs.readFileSync(account_file)
    const accJson = JSON.parse(fileBuf.toString());

    const recipient = new XrplAccount(null, recipientSecret, { xrplApi: xrplApi});
    const trustLines = await recipient.getTrustLines(Currencies.EVR,  accJson.issuer.address);
    if (trustLines.length === 0) {
        await recipient.setTrustLine(Currencies.EVR,  accJson.issuer.address, TRUSTLINE_EVR_LIMIT);
    }


    const foundation = new XrplAccount(accJson.foundation.address, accJson.foundation.secret, { xrplApi: xrplApi});
    await foundation.makePayment(recipient.address, everAmount.toString(), Currencies.EVR,  accJson.issuer.address);
    console.log(`${everAmount} EVRs were issued from  Foundation account to ${recipient.address}.`);
}


async function main() {
    try {
        if(process.argv.length > 2) {
            if(process.argv[2] === '--createEVRaccounts') {
                await initEvernode();
                await createIssuerAndFoundationAccounts();
                await prepareIssuer();
                await prepareFoundationTrustLine();
                await issueMintedTokens();
                await deinitEvernode();
            }

            if(process.argv[2] === '--fundMe' && process.argv[3] && process.argv[4]) {
                await initEvernode();
                await fundMyWallet(process.argv[3], process.argv[4]);
                await deinitEvernode();
            }

            if(process.argv[2] === '--createTrustline' && process.argv[3]) {
                await initEvernode();
                await createTrustLine(process.argv[3]);
                await deinitEvernode();
            }
        }
    } catch (e) {
        console.log(e)
    }
}

main().catch((e) => { console.error(e); process.exit(1); });






