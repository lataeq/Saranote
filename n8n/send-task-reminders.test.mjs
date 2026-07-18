import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workflow = JSON.parse(await readFile(new URL("./send-task-reminders.json", import.meta.url), "utf8"));
const node = (name) => workflow.nodes.find((item) => item.name === name);
const run = (source, context) => vm.runInNewContext(`(() => { ${source}\n})()`, context);

test("schedules and groups due reminders by assignee", () => {
  const schedule = node("Weekday Schedule").parameters.rule.interval[0];
  assert.deepEqual(Array.from(schedule.triggerAtDay), [1, 2, 3, 4, 5]);
  assert.equal(schedule.triggerAtHour, 8);
  assert.equal(schedule.triggerAtMinute, 30);
  assert.equal(workflow.settings.timezone, "Asia/Bangkok");

  const request = node("Fetch Open Assignments").parameters;
  assert.match(request.url, /api\/automation\/tasks/);
  assert.equal(request.genericAuthType, "httpHeaderAuth");

  const reminders = run(node("Prepare Reminders").parameters.jsCode, {
    $json: {
      tasks: [
        {
          task: { title: "Fix <login>", dueAt: "2020-01-01T09:00:00.000Z", url: "https://saranote.example/work" },
          meeting: { title: "Weekly sync" },
          assignee: { name: "Nuttasit P", email: "p@example.com" },
        },
        {
          task: { title: "Write tests", dueAt: "2020-01-02T09:00:00.000Z", url: "https://saranote.example/work" },
          meeting: { title: "Weekly sync" },
          assignee: { name: "Nuttasit P", email: "P@example.com" },
        },
        {
          task: { title: "Future task", dueAt: "2100-01-01T09:00:00.000Z", url: "https://saranote.example/work" },
          meeting: { title: "Planning" },
          assignee: { name: "Nuttasit P", email: "p@example.com" },
        },
      ],
    },
  });

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].json.email, "p@example.com");
  assert.match(reminders[0].json.eventKey, /^task-reminder:\d{4}-\d{2}-\d{2}:p@example\.com$/);
  assert.match(reminders[0].json.subject, /2 งาน/);
  assert.match(reminders[0].json.html, /Fix &lt;login&gt;/);
  assert.match(reminders[0].json.html, /Write tests/);
  assert.doesNotMatch(reminders[0].json.html, /Future task/);
});

test("reserves each delivery before Gmail and records its result", () => {
  const reserve = node("Reserve Delivery");
  assert.equal(reserve.type, "n8n-nodes-base.postgres");
  assert.match(reserve.parameters.query, /ON CONFLICT \(event_key\) DO UPDATE/);
  assert.match(reserve.parameters.query, /status = 'failed'/);
  assert.match(reserve.parameters.options.queryReplacement, /\$json\.eventKey/);

  const decision = node("Is New Delivery");
  assert.equal(decision.parameters.conditions.conditions[0].leftValue, "={{ $json.reserved }}");
  assert.equal(decision.parameters.conditions.conditions[0].operator.type, "boolean");

  const gmail = node("Send Reminder with Gmail");
  assert.equal(gmail.onError, "continueErrorOutput");

  const result = node("Record Delivery Result");
  assert.match(result.parameters.query, /'sent' ELSE 'failed'/);
  assert.match(result.parameters.query, /error_message = NULLIF/);

  assert.equal(workflow.connections["Prepare Reminders"].main[0][0].node, "Reserve Delivery");
  assert.equal(workflow.connections["Reserve Delivery"].main[0][0].node, "Is New Delivery");
  assert.equal(workflow.connections["Is New Delivery"].main[0][0].node, "Send Reminder with Gmail");
  assert.equal(workflow.connections["Send Reminder with Gmail"].main[0][0].node, "Record Delivery Result");
  assert.equal(workflow.connections["Send Reminder with Gmail"].main[1][0].node, "Record Delivery Result");
});
