import { Elysia } from "elysia";
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { PrismaClient } from '@prisma/client'
import { heapStats } from "bun:jsc";
import { generateHeapSnapshot } from "bun";

class Result<T>{
  data?: T;
  code: number;
  msg: string;

  constructor(data: T, code: number, msg: string) {
    this.data = data
    this.code = code
    this.msg = msg
  }
}

function ok<T>(data?: T): Result<T> {
  return { data: data, code: 0, msg: "" }
}

function err<T>(code: number, msg: string): Result<T> {
  return { code: code, msg: msg }
}


// class Fighter {
//   id: string;
//   name: string;
//   skill: string[];
//   created_at: Date;
//   updated_at?: Date;
//
//   constructor(
//     { id = crypto.randomUUID(), name, skill, created_at = new Date(), updated_at }:
//       { id?: string, name: string, skill: string[], created_at?: Date, updated_at?: Date }
//   ) {
//     this.id = id
//     this.name = name
//     this.skill = skill
//     this.created_at = created_at
//     this.updated_at = updated_at
//   }
// }

type FighterCreate = {
  name: string;
  skill: string[];
}

type FighterEdit = {
  name: string;
  skill: string[];
}

// function toFighter(a: FighterCreate): Fighter {
//   return new Fighter({ name: a.name, skill: a.skill })
// }

type StartupInfo = {
  pid: number;
  port: number;
  bun_version: string;
}

const startup_info: StartupInfo = { pid: process.pid, port: 3000, bun_version: Bun.version }
console.log(`Startup info: ${JSON.stringify(startup_info)}`)


const prisma = new PrismaClient({
  // log: ["query", "info", "warn", "error"]
  log: ["warn", "error"]
})

// 初始化数据
console.log("初始化数据, 开始")
await prisma.fighter.deleteMany({})
const initData = [
  { name: "隆", skill: ["波动拳"].join(",") },
  { name: "肯", skill: ["升龙拳"].join(",") }

]
for (const v of initData) {
  await prisma.fighter.create({
    data: v
  })
}
console.log("初始化数据，完成")


const db = (app: Elysia) => app.decorate("db", prisma)

new Elysia()
  .use(swagger())
  .use(cors())
  .group("/about", app =>
    app
      .get("", ({ request }) => {
        return [
          "/startupinfo",
          "/heapstats",
          "/heapdump"
        ].map(v => request.url + v)
      })
      .get("/startupinfo", () => startup_info)
      .get("/heapstats", () => heapStats())
      .get("/heapdump", async () => {
        const snapshot = generateHeapSnapshot();
        return new Response(
          JSON.stringify(snapshot, null, 2),
          {
            headers: {
              "Content-Disposition": 'attachment; filename="heapdump.json"'
            }
          }
        )
      })
  )
  .use(db)
  .group("/fighter", app =>
    app
      .get("", async () => {
        const all = await prisma.fighter.findMany()
        return ok(all)
      })
      .get("/:name", async ({ params, db }) => {
        const name = decodeURI(params.name)
        const found = await db.fighter.findUnique({ where: { name: name } })
        return ok(found)
      })
      .post("", async ({ request, db }) => {
        const fighter_create: FighterCreate = await request.json()
        if (fighter_create?.name === "" || fighter_create?.name === undefined) {
          throw new Error("VALIDATION")
        }
        const fighter_inserted = await db.fighter.create({
          data: {
            name: fighter_create.name,
            skill: fighter_create.skill?.join(",") || ""
          }
        })
        return ok(fighter_inserted)
      })
      .put("", async ({ request, db }) => {
        const fighter_edit: FighterEdit = await request.json()
        if (fighter_edit?.name === "" || fighter_edit?.name === undefined) {
          throw new Error("VALIDATION")
        }
        const fighter_updated = await db.fighter.update({
          where: { name: fighter_edit.name },
          data: { skill: fighter_edit.skill?.join(",") || "", updated_at: new Date() }
        })
        return ok(fighter_updated)
      })
      .delete("/:name", async ({ params, db }) => {
        const name = decodeURI(params.name)
        const fighter_deleted = await db.fighter.delete({ where: { name: name } })
        return ok(fighter_deleted)
      })
  )
  .listen(startup_info.port);


