const { describe, it } = require("node:test")
const assert = require("node:assert")
const http = require("node:http")

// Helper function to query local Next.js server endpoints
function requestJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      let data = ""
      res.on("data", (chunk) => {
        data += chunk
      })
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          resolve({ status: res.statusCode, body: data })
        }
      })
    }).on("error", reject)
  })
}

function postJson(urlPath, payload, method = "POST") {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload)
    const req = http.request(
      `http://localhost:3000${urlPath}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(dataString),
        },
      },
      (res) => {
        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch (e) {
            resolve({ status: res.statusCode, body: data })
          }
        })
      }
    )
    req.on("error", reject)
    req.write(dataString)
    req.end()
  })
}

describe("Job Search Copilot - Version 1 Unit & Integration Test Suite", () => {
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
  let createdAppId = null
  let createdTaskId = null

  // 1. Applications Endpoint Tests
  describe("Applications API (/api/applications)", () => {
    it("GET without userId should return 400 Bad Request", async () => {
      const res = await requestJson("/api/applications")
      assert.strictEqual(res.status, 400)
      assert.ok(res.body.error)
    })

    it("GET with valid userId should return 200 and applications array", async () => {
      const res = await requestJson(`/api/applications?userId=${TEST_USER_ID}`)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.applications))
    })

    it("POST without required fields should return 400", async () => {
      const res = await postJson("/api/applications", { userId: TEST_USER_ID })
      assert.strictEqual(res.status, 400)
    })

    it("POST with valid job application should create record and return 200", async () => {
      const newApp = {
        userId: TEST_USER_ID,
        company_name: "Unit Test Inc",
        job_title: "Senior Automated Test Engineer",
        current_status: "APPLIED",
        location: "Remote",
        salary_min: 130000,
        salary_max: 160000,
      }
      const res = await postJson("/api/applications", newApp)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(res.body.application.id)
      assert.strictEqual(res.body.application.company_name, "Unit Test Inc")
      assert.strictEqual(res.body.application.current_status, "APPLIED")
      createdAppId = res.body.application.id
    })

    it("PATCH should advance application stage and log status transition", async () => {
      assert.ok(createdAppId, "Test requires createdAppId")
      const patchData = {
        id: createdAppId,
        userId: TEST_USER_ID,
        current_status: "INTERVIEW",
        notes: "Passed screening round",
      }
      const res = await postJson("/api/applications", patchData, "PATCH")
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.application.current_status, "INTERVIEW")
    })

    it("DELETE should remove test application cleanly", async () => {
      assert.ok(createdAppId, "Test requires createdAppId")
      const res = await new Promise((resolve, reject) => {
        const req = http.request(
          `http://localhost:3000/api/applications?id=${createdAppId}`,
          { method: "DELETE" },
          (r) => {
            let data = ""
            r.on("data", (chunk) => (data += chunk))
            r.on("end", () => resolve({ status: r.statusCode, body: JSON.parse(data) }))
          }
        )
        req.on("error", reject)
        req.end()
      })
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
    })
  })

  // 2. Metrics & Analytics API Tests
  describe("Metrics API (/api/metrics)", () => {
    it("GET without userId should return 400", async () => {
      const res = await requestJson("/api/metrics")
      assert.strictEqual(res.status, 400)
    })

    it("GET with userId should return computed pipeline metrics", async () => {
      const res = await requestJson(`/api/metrics?userId=${TEST_USER_ID}`)
      assert.strictEqual(res.status, 200)
      assert.ok(res.body.metrics)
      assert.strictEqual(typeof res.body.metrics.totalApplications, "number")
      assert.strictEqual(typeof res.body.metrics.interviewRate, "number")
      assert.strictEqual(typeof res.body.metrics.offerRate, "number")
      assert.strictEqual(typeof res.body.metrics.rejectionRate, "number")
    })
  })

  // 3. Job Suggestions API Tests
  describe("Suggestions API (/api/suggestions)", () => {
    it("GET without userId should return 400", async () => {
      const res = await requestJson("/api/suggestions")
      assert.strictEqual(res.status, 400)
    })

    it("GET with userId should return 200 and suggestions array", async () => {
      const res = await requestJson(`/api/suggestions?userId=${TEST_USER_ID}`)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.suggestions))
    })

    it("POST should convert a job suggestion to application", async () => {
      const mockSuggestion = {
        company_name: "Mock AI Corp",
        job_title: "Staff Platform Engineer",
        location: "San Francisco, CA",
        salary_min: 180000,
        salary_max: 220000,
        source_site: "LinkedIn",
        match_score: 92,
      }
      const res = await postJson("/api/suggestions", {
        userId: TEST_USER_ID,
        suggestion: mockSuggestion,
      })
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.application.company_name, "Mock AI Corp")
      assert.strictEqual(res.body.application.current_status, "APPLIED")

      // Clean up the converted application
      if (res.body.application.id) {
        await new Promise((resolve) => {
          const req = http.request(
            `http://localhost:3000/api/applications?id=${res.body.application.id}`,
            { method: "DELETE" },
            () => resolve()
          )
          req.end()
        })
      }
    })
  })

  // 4. Learning Tasks API Tests
  describe("Learning Tasks API (/api/learning-tasks)", () => {
    it("GET without userId should return 400", async () => {
      const res = await requestJson("/api/learning-tasks")
      assert.strictEqual(res.status, 400)
    })

    it("GET with userId should return 200 and tasks array", async () => {
      const res = await requestJson(`/api/learning-tasks?userId=${TEST_USER_ID}`)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.tasks))
    })

    it("POST should create a custom learning goal", async () => {
      const taskPayload = {
        userId: TEST_USER_ID,
        title: "Master Node.js Microservices",
        topic: "Backend Architecture",
        estimated_hours: 4,
        priority: "HIGH",
        resources: ["https://nodejs.org/docs"],
      }
      const res = await postJson("/api/learning-tasks", taskPayload)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.task.title, "Master Node.js Microservices")
      assert.strictEqual(res.body.task.completed, false)
      createdTaskId = res.body.task.id
    })

    it("PATCH should persist completed state in database", async () => {
      assert.ok(createdTaskId, "Test requires createdTaskId")
      const res = await postJson(
        "/api/learning-tasks",
        { id: createdTaskId, completed: true },
        "PATCH"
      )
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.strictEqual(res.body.task.completed, true)
      assert.ok(res.body.task.completed_at)
    })
  })

  // 5. Email & Gmail Integration Verification
  describe("Email Credentials API (/api/email/credentials)", () => {
    it("GET should retrieve the connected Gmail credential", async () => {
      const res = await requestJson(`/api/email/credentials?userId=${TEST_USER_ID}`)
      assert.strictEqual(res.status, 200)
      assert.strictEqual(res.body.success, true)
      assert.ok(Array.isArray(res.body.credentials))
      const gmail = res.body.credentials.find((c) => c.provider === "gmail")
      assert.ok(gmail, "Gmail credential must exist")
      assert.strictEqual(gmail.is_connected, true)
      assert.strictEqual(gmail.email_address, "ruthalaramesh.000@gmail.com")
    })
  })
})
