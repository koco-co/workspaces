import { test } from "../../fixtures/step-screenshot";
import { ensureRuleTasks } from "./rule-task-helpers";
import { QUALITY_PROJECT_ID } from "./test-data";

test.use({ storageState: ".auth/session.json" });
test.setTimeout(600000);

test("tmp inspect quality report detail", async ({ page }) => {
  await ensureRuleTasks(page, ["task_15695_enum_pass"]);

  const taskApiSummary = await page.evaluate(async ({ projectId }) => {
    const post = async (path: string, body: unknown) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json;charset=UTF-8",
          "Accept-Language": "zh-CN",
          "X-Valid-Project-ID": String(projectId),
        },
        body: JSON.stringify(body),
      });
      return response.json();
    };

    const taskList = await post("/dassets/v1/valid/monitor/pageQuery", {
      pageIndex: 1,
      pageSize: 200,
    });
    const taskRow = (taskList?.data?.data ?? taskList?.data?.contentList ?? taskList?.data?.list ?? []).find(
      (item: { ruleName?: string; monitorName?: string; name?: string }) =>
        String(item?.ruleName ?? item?.monitorName ?? item?.name ?? "") === "task_15695_enum_pass",
    );

    return {
      taskList,
      taskDetail: taskRow?.id
        ? await post("/dassets/v1/valid/monitor/detail", {
            monitorId: taskRow.id,
          })
        : null,
    };
  }, { projectId: QUALITY_PROJECT_ID });

  console.log("TASK_LIST_API", JSON.stringify(taskApiSummary.taskList));
  console.log("TASK_DETAIL_API", JSON.stringify(taskApiSummary.taskDetail));

  const reportApiSummary = await page.evaluate(async ({ projectId }) => {
    const post = async (path: string, body: unknown) => {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json;charset=UTF-8",
          "Accept-Language": "zh-CN",
          "X-Valid-Project-ID": String(projectId),
        },
        body: JSON.stringify(body),
      });
      return response.json();
    };

    return {
      config: await post("/dassets/v1/valid/monitorReport/page", {
        current: 1,
        size: 20,
        reportName: "task_15695_enum_pass",
      }),
      generated: await post("/dassets/v1/valid/monitorReportRecord/pageList", {
        current: 1,
        size: 20,
        search: "task_15695_enum_pass",
      }),
    };
  }, { projectId: QUALITY_PROJECT_ID });

  console.log("CONFIG_REPORT_API", JSON.stringify(reportApiSummary.config));
  console.log("GENERATED_REPORT_API", JSON.stringify(reportApiSummary.generated));
});
