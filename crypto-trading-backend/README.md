# Crypto Trading Backend

This is the backend service for the cryptocurrency trading application, built with NestJS and TypeScript.

## Description

The backend provides a robust API for cryptocurrency trading operations, including:
- Market data processing
- Trading engine operations
- Risk management
- Order execution
- Portfolio management
- Real-time data streaming

## Installation

```bash
$ npm install
```

## Running the app

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

## Environment Variables

Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL=postgresql://user:password@localhost:5432/crypto_trading
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key
```

## License

This project is licensed under the MIT License. 