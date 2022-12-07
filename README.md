# SA Dashboard Backend

## Installation

```bash
$ npm install
```

## Running the app
1. Create the `application.env` file containing database info in an external directory
2. Set the `CONF_SA_API_PATH` environmental variable to it's directory
3. _(optional)_ Set the `CONF_MAINTAINER_MAP` for maintainer support
4. Run with an appropriate command:

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
