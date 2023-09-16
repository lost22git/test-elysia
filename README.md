# dev app

## install bun
```shell
rtx install bun

rtx use -g bun
```

## create test-elysia project
```shell
bun create elysia test-elysia

cd test-elysia
```

## install prisma
```shell
bun install prisma --save-dev 
```

### init prisma

```shell
bun x prisma init --datasource-provider sqlite
```

### edit `./prisma/schema.prisma` file

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Fighter {
  id         Int       @id @default(autoincrement())
  name       String    @unique
  skill      String
  created_at DateTime  @default(now())
  updated_at DateTime?

  @@map("fighter")
}
```

### edit .env file

```env
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="file:./fighter.db"
```

### sync schema to db and generate migrate scripts

```shell
bun x prisma migrate dev --name init-fighter-schema
```


### generate prisma client code

```shell
bun x prisma generate
```

### use PrismaClient in your ts code
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
```


# run app

```shell
bun src/index.ts
```
or

```shell
./deploy.sh
```
