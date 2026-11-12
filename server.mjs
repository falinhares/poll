import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3001;
const polls = new Map();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, "data");
const pollsFile = path.join(dataDirectory, "polls.json");

function restorePolls() {
  if (!fs.existsSync(pollsFile)) return;
  const savedPolls = JSON.parse(fs.readFileSync(pollsFile, "utf8"));
  if (!Array.isArray(savedPolls)) {
    throw new Error(`Poll data at ${pollsFile} must contain an array.`);
  }
  for (const savedPoll of savedPolls) {
    polls.set(savedPoll.code, {
      ...savedPoll,
      participants: new Map(savedPoll.participants ?? []),
    });
  }
}

function persistPolls() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${pollsFile}.tmp`;
  const savedPolls = [...polls.values()].map((poll) => ({
    ...poll,
    participants: [...poll.participants],
  }));
  fs.writeFileSync(temporaryFile, JSON.stringify(savedPolls), "utf8");
  fs.renameSync(temporaryFile, pollsFile);
}

function lanAddress() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  return interfaces.find(
    (address) => address?.family === "IPv4" && !address.internal,
  )?.address;
}

restorePolls();

app.use(express.json({ limit: "100kb" }));

function publicPoll(poll, participantId) {
  return {
    code: poll.code,
    title: poll.title,
    status: poll.status,
    currentQuestionIndex: poll.currentQuestionIndex,
    endsAt: poll.endsAt,
    participantCount: poll.participants.size,
    participantName: participantId
      ? poll.participants.get(participantId) ?? null
      : null,
    questions: poll.questions.map((question) => ({
      text: question.text,
      options: question.options,
      counts: question.options.map(
        (_, optionIndex) =>
          Object.values(question.votes).filter((vote) => vote === optionIndex)
            .length,
      ),
      totalVotes: Object.keys(question.votes).length,
      selectedOption: participantId
        ? question.votes[participantId] ?? null
        : null,
    })),
  };
}

function createPoll(title, questions) {
  let code;
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (polls.has(code));

  const poll = {
    code,
    title,
    status: "draft",
    currentQuestionIndex: 0,
    endsAt: null,
    createdAt: Date.now(),
    questions: questions.map((question) => ({
      text: question.text,
      options: [...question.options],
      votes: {},
    })),
    participants: new Map(),
  };
  polls.set(code, poll);
  persistPolls();
  return poll;
}

function finishQuestionIfExpired(poll) {
  if (poll.status === "running" && Date.now() >= poll.endsAt) {
    poll.status = "results";
    poll.endsAt = null;
    persistPolls();
  }
}

function findPoll(req, res) {
  const poll = polls.get(req.params.code.toUpperCase());
  if (!poll) {
    res.status(404).json({ error: "Poll not found." });
    return null;
  }
  finishQuestionIfExpired(poll);
  return poll;
}

app.get("/api/polls", (_req, res) => {
  const results = [...polls.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((poll) => publicPoll(poll));
  res.json(results);
});

app.get("/api/config", (req, res) => {
  const configuredUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  res.json({
    publicUrl: configuredUrl || null,
    lanAddress: lanAddress() || null,
  });
});

app.post("/api/polls", (req, res) => {
  const { title, questions } = req.body ?? {};
  if (
    typeof title !== "string" ||
    !title.trim() ||
    !Array.isArray(questions) ||
    questions.length === 0 ||
    questions.some(
      (question) =>
        typeof question.text !== "string" ||
        !question.text.trim() ||
        !Array.isArray(question.options) ||
        question.options.length !== 5 ||
        question.options.some(
          (option) => typeof option !== "string" || !option.trim(),
        ),
    )
  ) {
    res.status(400).json({
      error: "Add a poll title and at least one question with five answers.",
    });
    return;
  }

  const poll = createPoll(
    title.trim(),
    questions.map((question) => ({
      text: question.text.trim(),
      options: question.options.map((option) => option.trim()),
    })),
  );
  res.status(201).json(publicPoll(poll));
});

app.post("/api/polls/:code/duplicate", (req, res) => {
  const sourcePoll = polls.get(req.params.code.toUpperCase());
  if (!sourcePoll) {
    res.status(404).json({ error: "Poll not found." });
    return;
  }
  const poll = createPoll(
    `${sourcePoll.title} (copy)`,
    sourcePoll.questions.map((question) => ({
      text: question.text,
      options: question.options,
    })),
  );
  res.status(201).json(publicPoll(poll));
});

app.get("/api/polls/:code", (req, res) => {
  const poll = findPoll(req, res);
  if (!poll) return;
  res.json(publicPoll(poll, req.query.participantId));
});

app.post("/api/polls/:code/join", (req, res) => {
  const poll = findPoll(req, res);
  if (!poll) return;
  const { participantId, firstName } = req.body ?? {};
  if (
    typeof participantId !== "string" ||
    !/^[a-f0-9-]{20,40}$/i.test(participantId)
  ) {
    res.status(400).json({ error: "A participant session is required." });
    return;
  }
  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    firstName.trim().length > 40
  ) {
    res.status(400).json({ error: "Enter your first name to join." });
    return;
  }
  poll.participants.set(participantId, firstName.trim());
  persistPolls();
  res.json(publicPoll(poll, participantId));
});

app.post("/api/polls/:code/start", (req, res) => {
  const poll = findPoll(req, res);
  if (!poll) return;
  if (poll.status !== "draft") {
    res.status(409).json({ error: "This poll has already started." });
    return;
  }
  poll.status = "running";
  poll.currentQuestionIndex = 0;
  poll.endsAt = Date.now() + 30_000;
  persistPolls();
  res.json(publicPoll(poll));
});

app.post("/api/polls/:code/next", (req, res) => {
  const poll = findPoll(req, res);
  if (!poll) return;
  if (poll.status !== "results") {
    res.status(409).json({ error: "The current question is still in progress." });
    return;
  }
  poll.currentQuestionIndex += 1;
  if (poll.currentQuestionIndex >= poll.questions.length) {
    poll.status = "completed";
    poll.endsAt = null;
  } else {
    poll.status = "running";
    poll.endsAt = Date.now() + 30_000;
  }
  persistPolls();
  res.json(publicPoll(poll));
});

app.post("/api/polls/:code/vote", (req, res) => {
  const poll = findPoll(req, res);
  if (!poll) return;
  const { participantId, optionIndex } = req.body ?? {};
  if (poll.status !== "running") {
    res.status(409).json({ error: "Voting is closed for this question." });
    return;
  }
  if (
    typeof participantId !== "string" ||
    !/^[a-f0-9-]{20,40}$/i.test(participantId)
  ) {
    res.status(400).json({ error: "A participant session is required." });
    return;
  }
  if (!poll.participants.has(participantId)) {
    res.status(403).json({ error: "Enter your first name before voting." });
    return;
  }
  const question = poll.questions[poll.currentQuestionIndex];
  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= question.options.length
  ) {
    res.status(400).json({ error: "Choose one of the available answers." });
    return;
  }
  if (question.votes[participantId] !== undefined) {
    res.status(409).json({ error: "Your answer has already been recorded." });
    return;
  }
  question.votes[participantId] = optionIndex;
  persistPolls();
  res.json(publicPoll(poll, participantId));
});

app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"), (error) => {
    if (error) next();
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Pulse server is listening on http://localhost:${port}`);
});
