import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workflow = JSON.parse(await readFile(new URL("./send-meeting-summary-email.json", import.meta.url), "utf8"));
const code = (name) => workflow.nodes.find((node) => node.name === name).parameters.jsCode;
const run = (source, context) => vm.runInNewContext(`(() => { ${source}\n})()`, context);

test("builds one Gemini request and one email per participant", () => {
  const prepared = run(code("Prepare Gemini Request"), {
    $json: {
      body: {
        event: "meeting.summary_send_requested",
        requestedBy: { name: "Nuttasit T" },
        meeting: {
          title: "Weekly sync",
          heldAt: "2026-07-16T11:40:30.357Z",
          transcript: "นัทสิทธิ์พีเขียนยูนิเทสหน้าล็อกอีนภายในวันสุข",
          url: "http://localhost:3000/meetings/7",
        },
        recipients: [
          { name: "Nuttasit P", email: "p@example.com", spokenNames: ["นัทสิทธิ์พี"] },
          { name: "Nuttasit T", email: "t@example.com", spokenNames: ["นัทสิทธิ์ที"] },
        ],
      },
    },
  });

  assert.equal(prepared.length, 1);
  assert.match(prepared[0].json.prompt, /นัทสิทธิ์พีเขียนยูนิเทส/);
  assert.match(prepared[0].json.prompt, /Nuttasit P/);

  const emails = run(code("Build Emails"), {
    $json: {
      content: {
        parts: [{
          text: JSON.stringify({
            cleaned_transcript: "Nuttasit P เขียนยูนิเทสหน้าล็อกอินภายในวันศุกร์",
            decisions: [],
            risks: [],
            important_points: ["พัฒนาหน้าล็อกอิน"],
            follow_ups: [{ owner: "Nuttasit P", task: "เขียนยูนิเทสหน้าล็อกอิน", deadline: "วันศุกร์" }],
          }),
        }],
      },
    },
    $: () => ({ first: () => prepared[0] }),
  });

  assert.equal(emails.length, 2);
  assert.match(emails[0].json.subject, /Weekly sync/);
  assert.match(emails[0].json.html, /Nuttasit P: เขียนยูนิเทสหน้าล็อกอิน/);
  assert.match(emails[0].json.html, /บันทึกการประชุมฉบับแก้ไข/);
  assert.match(emails[0].json.html, /Nuttasit P เขียนยูนิเทสหน้าล็อกอินภายในวันศุกร์/);
  assert.equal(emails[1].json.email, "t@example.com");
});
