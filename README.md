## Clone the project and run `npm i` in the root folder.
==================================


# Commands
1. `node index.js --createEVRaccounts`

This creates two accounts as issuer and foundation in <i>accounts/accounts.json</i>. Foundation account holds 99999999999 EVR from the issuer address.
The file is the following format.
```
    {
    "issuer": {
        "address": "rQwnhceqeCkw7NJQEL5vXD2qEGo9rmzXY7",
        "secret": "shNr5KrD8A1HWR2XbCsL32M5fGT8Y"
    },
    "foundation": {
        "address": "rfLmhJqtCyEf7zvjG2iLi2PnHCPuAiAoFv",
        "secret": "shEsgBCMvJF3YKC8CseJtCE4T54KG"
    }
}
```

2. `node index.js --fundMe <secret> <amount> `

This command creates trustlines for the EVR of issuer address mentioned in accounts.json file,(if neccessary)  and fund the specified amount to the specified account from the foundation wallet.
Here, <secret> is the secret of your wallet that needs to be funded to. <amount> is number specifying the amount of EVR needed to be funded.

3. `node index.js --createTrustline <secret>`

This creates the trustline only (unless created) to receive EVR of the issuer. Provde your account's <secret> to create the trustline.

