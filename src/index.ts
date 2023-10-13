import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { PrismaClient } from "@prisma/client";
import { heapStats } from "bun:jsc";
import { generateHeapSnapshot } from "bun";

class Result<T> {
  data?: T;
  code: number;
  msg: string;

  constructor(data: T, code: number, msg: string) {
    this.data = data;
    this.code = code;
    this.msg = msg;
  }
}

function ok<T>(data?: T): Result<T> {
  return { data: data, code: 0, msg: "" };
}

function err<T>(code: number, msg: string): Result<T> {
  return { code: code, msg: msg };
}

type StartupInfo = {
  pid: number;
  port: number;
  reusePort: boolean;
  bunVersion: string;
};

const startup_info: StartupInfo = {
  pid: process.pid,
  port: 3000,
  reusePort: true,
  bunVersion: Bun.version,
};
console.log(`Startup info: ${JSON.stringify(startup_info)}`);


// ------ DB -----------------

const prisma = new PrismaClient({
  // log: ["query", "info", "warn", "error"]
  log: ["warn", "error"],
});

// 初始化数据
console.log("初始化数据, 开始");
await prisma.fighter.deleteMany({});
const initData = [
  { name: "隆", skill: ["波动拳"].join(",") },
  { name: "肯", skill: ["升龙拳"].join(",") },
];
await prisma.$transaction(
  initData.map((v) => prisma.fighter.create({ data: v }))
);
console.log("初始化数据，完成");


// ------ Model --------------

const name_pattern =
  "^[\u4E00-\u9FA5A-Za-z]([\u4E00-\u9FA5A-Za-z0-9_ -]*[\u4E00-\u9FA5A-Za-z0-9])?$";
const name_pattern_desc =
  "中文或英文开头，中文或英文或数字结尾，中间允许空格或 '-' 或 '_'";

const FighterCreate = t.Object({
  name: t.String({
    pattern: name_pattern,
    error: `name: 名称格式错误, 要求：${name_pattern_desc}`,
  }),
  skill: t.Array(
    t.String({
      pattern: name_pattern,
      error: `skill: 技能名称格式错误, 要求：${name_pattern_desc}`,
    })
  ),
});

const FighterEdit = t.Object({
  name: t.String(),
  skill: t.Array(
    t.String({
      pattern: name_pattern,
      error: `skill: 技能名称格式错误, 要求：${name_pattern_desc}`,
    })
  ),
});

// ------ Server -------------

const db = (app: Elysia) => app.state("db", prisma);

const app = new Elysia();
app
  .onStart(() => {
    console.log("server 启动中");
  })
  .onStop(async () => {
    console.log("server 已关闭");
    await prisma.$disconnect();
  })
  .use(
    swagger({
      path: "/about/api",
      exclude: ["/about/api", "/about/api/json"],
    })
  )
  .group("/baseline", (app) =>
    app.get("/text", () => "lost")
      .get("/json", () => ok("lost"))
  )
  .use(cors())
  .group("/about", (app) =>
    app
      .get(
        "",
        ({ request }) => {
          return ["/api", "/startupinfo", "/heapstats", "/heapdump"].map(
            (v) => request.url + v
          );
        },
        {
          detail: {
            summary: "查询 about 所有链接",
            tags: ["about"],
          },
        }
      )
      .get("/startupinfo", () => startup_info, {
        detail: {
          summary: "查询启动信息",
          tags: ["about"],
        },
      })
      .get("/heapstats", () => heapStats(), {
        detail: {
          summary: "查询 js heap stats",
          tags: ["about"],
        },
      })
      .get(
        "/heapdump",
        ({ set }) => {
          set.headers["Content-Disposition"] =
            'attachment; filename="heapdump.json"';
          return generateHeapSnapshot();
        },
        {
          detail: {
            summary: "下载 js heap dump 文件",
            tags: ["about"],
          },
        }
      )
  )
  .group("/fighter", (app) =>
    app
      .use(db)
      .get(
        "",
        async ({ store: { db } }) => {
          const all = await db.fighter.findMany();
          return ok(all);
        },
        {
          detail: {
            summary: "查询所有 fighter",
            tags: ["fighter"],
          },
        }
      )
      .get(
        "/:name",
        async ({ params, store: { db } }) => {
          const name = decodeURI(params.name);
          const found = await db.fighter.findUnique({ where: { name: name } });
          return ok(found);
        },
        {
          detail: {
            summary: "查询 fighter, by name",
            tags: ["fighter"],
          },
        }
      )
      .post(
        "",
        async ({ body, store: { db } }) => {
          const fighter_create = body;
          const fighter_inserted = await db.fighter.create({
            data: {
              name: fighter_create.name,
              skill: fighter_create.skill?.join(",") || "",
            },
          });
          return ok(fighter_inserted);
        },
        {
          type: "json",
          body: FighterCreate,
          detail: {
            summary: "新增一个 fighter",
            tags: ["fighter"],
          },
        }
      )
      .put(
        "",
        async ({ body, store: { db } }) => {
          const fighter_edit = body;
          const fighter_updated = await db.fighter.update({
            where: { name: fighter_edit.name },
            data: {
              skill: fighter_edit.skill?.join(",") || "",
              updated_at: new Date(),
            },
          });
          return ok(fighter_updated);
        },
        {
          type: "json",
          body: FighterEdit,
          detail: {
            summary: "编辑一个 fighter",
            tags: ["fighter"],
          },
        }
      )
      .delete(
        "/:name",
        async ({ params, store: { db } }) => {
          const name = decodeURI(params.name);
          const fighter_deleted = await db.fighter.delete({
            where: { name: name },
          });
          return ok(fighter_deleted);
        },
        {
          detail: {
            summary: "删除一个 fighter",
            tags: ["fighter"],
          },
        }
      )
  )
  .listen({ ...startup_info }, ({ hostname, port }) => {
    console.log(`Running at http://${hostname}:${port}`);
  });
