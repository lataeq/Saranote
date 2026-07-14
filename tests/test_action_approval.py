import unittest

from src.automation.actions import prepare_action_payloads


class ActionApprovalTest(unittest.TestCase):
    def test_approved_action_becomes_n8n_ready_payload(self):
        evidence = {"source": "transcript", "timestamp": "transcript-04"}

        result = prepare_action_payloads(
            [
                {
                    "owner": "ฝ่ายดำเนินงาน",
                    "task": "ส่งเอกสารงบประมาณฉบับแก้ไข",
                    "deadline": "วันศุกร์",
                    "approved": True,
                    "evidence": evidence,
                }
            ]
        )

        self.assertEqual(result["blocked"], [])
        self.assertEqual(result["ready"][0]["event"], "meeting.action_assigned")
        self.assertEqual(result["ready"][0]["owner"], "ฝ่ายดำเนินงาน")
        self.assertEqual(result["ready"][0]["evidence"], evidence)

    def test_unapproved_action_is_blocked(self):
        result = prepare_action_payloads(
            [{"owner": "ฝ่ายดำเนินงาน", "task": "ส่งเอกสาร", "approved": False}]
        )

        self.assertEqual(result["ready"], [])
        self.assertEqual(result["blocked"][0]["reason"], "needs_approval")

    def test_truthy_string_does_not_bypass_approval(self):
        result = prepare_action_payloads(
            [{"owner": "ฝ่ายดำเนินงาน", "task": "ส่งเอกสาร", "approved": "true"}]
        )

        self.assertEqual(result["ready"], [])
        self.assertEqual(result["blocked"][0]["reason"], "needs_approval")

    def test_approved_action_without_owner_is_marked_unassigned(self):
        result = prepare_action_payloads(
            [{"owner": "", "task": "จัดทำสรุปการประชุม", "approved": True}]
        )

        self.assertEqual(result["ready"], [])
        self.assertEqual(result["blocked"][0]["owner"], "unassigned")
        self.assertEqual(result["blocked"][0]["reason"], "unassigned")


if __name__ == "__main__":
    unittest.main()
