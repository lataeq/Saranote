import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = JSON.parse(await readFile(new URL("./send-retention-notices.json", import.meta.url), "utf8"));
const node = (name) => workflow.nodes.find((item) => item.name === name);

test("sends daily retention notices only to the server-provided pilot mailbox", () => {
  const schedule = node("Daily Retention Schedule").parameters.rule.interval[0];
  assert.equal(schedule.field, "days");
  assert.equal(schedule.daysInterval, 1);
  assert.equal(workflow.settings.timezone, "Asia/Bangkok");

  const fetch = node("Fetch Retention Notices").parameters;
  assert.match(fetch.url, /api\/automation\/retention/);
  assert.equal(fetch.genericAuthType, "httpHeaderAuth");
  assert.equal(node("Split Notices").parameters.fieldToSplitOut, "notices");
  assert.equal(node("Send Retention Notice").parameters.sendTo, "={{ $json.email }}");
});

test("acknowledges a notice only after Gmail succeeds", () => {
  const gmail = node("Send Retention Notice");
  const acknowledge = node("Acknowledge Notice");
  assert.equal(gmail.onError, "continueErrorOutput");
  assert.equal(acknowledge.parameters.method, "POST");
  assert.match(acknowledge.parameters.url, /api\/automation\/retention/);
  assert.match(acknowledge.parameters.body, /meetingId/);
  assert.equal(workflow.connections["Send Retention Notice"].main[0][0].node, "Acknowledge Notice");
  assert.deepEqual(workflow.connections["Send Retention Notice"].main[1], []);
});
