import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  Lightbulb,
  Link2,
  LockKeyhole,
  LoaderCircle,
  Plus,
  Radio,
  Sparkles,
  Users,
  X,
} from "lucide-react";

const colors = ["#5d65e8", "#24a88b", "#f0a43b", "#e36e80", "#4995d6"];

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function routeFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "join" && parts[1]) return { page: "join", code: parts[1] };
  if (parts[0] === "host" && parts[1]) return { page: "host", code: parts[1] };
  return { page: "dashboard" };
}

function go(path) {
  window.location.assign(path);
}

function createParticipantId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function getStoredValue(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeValue(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function App() {
  const route = useMemo(routeFromPath, []);
  if (route.page === "host") return <HostPage code={route.code} />;
  if (route.page === "join") return <ParticipantPage code={route.code} />;
  return <Dashboard />;
}

export default App;

function Sidebar({ active = "dashboard" }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="/">
        <span className="brand-mark"><Radio size={20} strokeWidth={2.5} /></span>
        <span>pulse<span className="brand-period">.</span></span>
      </a>
      <div className="workspace-switcher">
        <span className="workspace-avatar">S</span>
        <span className="workspace-copy"><strong>Studio workspace</strong><small>Free plan</small></span>
        <ChevronDown size={15} />
      </div>
      <span className="side-label">WORKSPACE</span>
      <nav className="side-nav">
        <a className={active === "dashboard" ? "side-link active" : "side-link"} href="/">
          <span className="nav-icon"><FileText size={17} /></span> My polls
          <span className="nav-badge">⌘ 1</span>
        </a>
        <a className="side-link" href="#templates" onClick={(event) => event.preventDefault()}>
          <span className="nav-icon"><Lightbulb size={17} /></span> Templates
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon"><CircleHelp size={17} /></div>
          <strong>Need a hand?</strong>
          <p>Find tips to make your next session a hit.</p>
          <a href="mailto:hello@pulse.local">Visit help center <ArrowUpRight size={13} /></a>
        </div>
        <div className="profile">
          <div className="profile-avatar">S</div>
          <div><strong>Sam Taylor</strong><small>sam@studio.co</small></div>
          <ChevronDown size={15} />
        </div>
      </div>
    </aside>
  );
}

function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setPolls(await request("/api/polls"));
      setError("");
    } catch (issue) {
      setError(issue.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPoll = async (payload) => {
    const poll = await request("/api/polls", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    go(`/host/${poll.code}`);
  };

  const livePolls = polls.filter((poll) => poll.status === "running").length;
  const totalParticipants = polls.reduce(
    (total, poll) => total + poll.participantCount,
    0,
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>My polls</strong></div>
          <div className="topbar-right">
            <span className="status-dot" /> All systems operational
            <span className="topbar-divider" />
            <button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button>
            <div className="mini-avatar">S</div>
          </div>
        </header>
        <section className="dashboard-page">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</div>
              <h1>Good afternoon, Sam <span className="wave">✳</span></h1>
              <p className="welcome-subtitle">Make your next meeting a little more interactive.</p>
            </div>
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={17} strokeWidth={2.5} /> Create a poll
            </button>
          </div>

          <div className="stats-row">
            <StatCard icon={<FileText size={17} />} label="Total polls" value={polls.length} note="Across your workspace" tone="violet" />
            <StatCard icon={<Radio size={17} />} label="Live right now" value={livePolls} note={livePolls ? "A poll is in progress" : "Nothing live at the moment"} tone="green" />
            <StatCard icon={<Users size={17} />} label="Total participants" value={totalParticipants} note="People have joined in" tone="amber" />
          </div>

          <div className="section-heading">
            <div><h2>Your polls</h2><span className="count-pill">{polls.length}</span></div>
            <button className="sort-button">Recently updated <ChevronDown size={15} /></button>
          </div>

          {error && <div className="error-banner">{error} <button onClick={refresh}>Try again</button></div>}
          {loading ? (
            <div className="loading-state"><LoaderCircle className="spin" size={22} /> Loading your polls…</div>
          ) : polls.length === 0 ? (
            <div className="empty-state">
              <div className="empty-illustration"><Sparkles size={27} /></div>
              <h3>Your next great conversation starts here</h3>
              <p>Create a poll, share the QR code, and see everyone’s answers come in.</p>
              <button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={17} /> Create your first poll</button>
            </div>
          ) : (
            <div className="poll-grid">
              {polls.map((poll, index) => <PollCard key={poll.code} poll={poll} index={index} />)}
              <button className="new-poll-card" onClick={() => setModalOpen(true)}>
                <span className="new-poll-plus"><Plus size={20} /></span><strong>Create another poll</strong><span>Start with a blank slate</span>
              </button>
            </div>
          )}

          <div className="bottom-tip"><span><Lightbulb size={16} /></span><p><strong>A little tip</strong> — People can join your poll just by scanning the QR code. No sign-up needed.</p><ArrowRight size={15} /></div>
        </section>
      </main>
      {modalOpen && <CreatePollModal onClose={() => setModalOpen(false)} onCreate={createPoll} />}
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }) {
  return <div className="stat-card">
    <div className="stat-top"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span><span className="stat-menu">···</span></div>
    <div className="stat-value">{value}</div><div className="stat-note">{note}</div>
  </div>;
}

function PollCard({ poll, index }) {
  const statusLabel = {
    draft: "Draft",
    running: "Live",
    results: "Results",
    completed: "Completed",
  }[poll.status];
  const question = poll.questions[poll.currentQuestionIndex];
  const palette = ["violet", "peach", "mint"];
  return <a className="poll-card" href={`/host/${poll.code}`}>
    <div className={`poll-card-art art-${palette[index % palette.length]}`}>
      <div className="art-shape shape-one" /><div className="art-shape shape-two" />
      <span className={`poll-status ${poll.status}`}><span />{statusLabel}</span>
      <span className="art-sparkle">✳</span>
      <span className="card-art-copy">{poll.questions.length}<small>questions</small></span>
    </div>
    <div className="poll-card-body">
      <div className="poll-card-title-row"><h3>{poll.title}</h3><span className="card-arrow"><ArrowUpRight size={16} /></span></div>
      <p>{question?.text || "No questions"}</p>
      <div className="poll-card-meta"><span><Users size={14} /> {poll.participantCount} joined</span><span className="meta-divider" /><span><Clock3 size={14} /> 30 sec / question</span></div>
    </div>
  </a>;
}

function CreatePollModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", "", "", "", ""] }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateQuestion = (questionIndex, key, value, optionIndex) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      if (key === "text") return { ...question, text: value };
      return { ...question, options: question.options.map((option, answerIndex) => answerIndex === optionIndex ? value : option) };
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim() || questions.some((question) => !question.text.trim() || question.options.some((option) => !option.trim()))) {
      setError("Add a poll title, every question, and all five answer options.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCreate({ title, questions });
    } catch (issue) {
      setError(issue.message);
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="create-modal" onSubmit={submit}>
      <div className="modal-header">
        <div><div className="modal-kicker"><span className="tiny-spark">✳</span> NEW POLL</div><h2>Let’s get people talking.</h2><p>Set up your questions. You can share your poll as soon as it’s ready.</p></div>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
      </div>
      <div className="form-scroll">
        <label className="field-label" htmlFor="poll-title">Poll name</label>
        <input id="poll-title" className="text-input" placeholder="e.g. Friday team check-in" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        {questions.map((question, questionIndex) => <section className="question-editor" key={questionIndex}>
          <div className="question-editor-head"><span className="question-number">Q{String(questionIndex + 1).padStart(2, "0")}</span><span>QUESTION {questionIndex + 1}</span></div>
          <input className="text-input question-input" aria-label={`Question ${questionIndex + 1}`} placeholder="What would you like to ask?" value={question.text} onChange={(event) => updateQuestion(questionIndex, "text", event.target.value)} />
          <div className="answer-label">ANSWER OPTIONS <span>5 options required</span></div>
          <div className="answer-editor-grid">
            {question.options.map((option, optionIndex) => <label className="answer-editor" key={optionIndex}>
              <span className="answer-letter" style={{ "--answer-color": colors[optionIndex] }}>{String.fromCharCode(65 + optionIndex)}</span>
              <input aria-label={`Question ${questionIndex + 1}, answer ${optionIndex + 1}`} placeholder={`Option ${optionIndex + 1}`} value={option} onChange={(event) => updateQuestion(questionIndex, "option", event.target.value, optionIndex)} />
            </label>)}
          </div>
        </section>)}
        <button type="button" className="add-question-button" onClick={() => setQuestions((current) => [...current, { text: "", options: ["", "", "", "", ""] }])}><Plus size={16} /> Add another question</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-footer"><span><Clock3 size={15} /> Each question runs for 30 seconds</span><div><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Create poll <ArrowRight size={15} /></button></div></div>
    </form>
  </div>;
}

function HostPage({ code }) {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [copied, setCopied] = useState(false);
  const [joinOrigin, setJoinOrigin] = useState(window.location.origin);
  const joinUrl = `${joinOrigin}/join/${code.toUpperCase()}`;

  useEffect(() => {
    request("/api/config")
      .then(({ publicUrl, lanAddress: address }) => {
        if (publicUrl) {
          setJoinOrigin(publicUrl);
          return;
        }
        const origin = new URL(window.location.origin);
        if (
          address &&
          (origin.hostname === "localhost" ||
            origin.hostname === "::1" ||
            origin.hostname.startsWith("127."))
        ) {
          origin.hostname = address;
        }
        setJoinOrigin(origin.origin);
      })
      .catch((issue) => setError(issue.message));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const current = await request(`/api/polls/${code}`);
      setPoll(current);
      setError("");
    } catch (issue) { setError(issue.message); }
  }, [code]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!poll?.endsAt) { setSeconds(30); return undefined; }
    const update = () => setSeconds(Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [poll?.endsAt]);

  const perform = async (action) => {
    setBusy(true);
    setError("");
    try {
      const updated = await request(`/api/polls/${code}/${action}`, { method: "POST" });
      setPoll(updated);
    } catch (issue) { setError(issue.message); await refresh(); }
    finally { setBusy(false); }
  };

  const duplicatePoll = async () => {
    setBusy(true);
    setError("");
    try {
      const copy = await request(`/api/polls/${code}/duplicate`, { method: "POST" });
      go(`/host/${copy.code}`);
    } catch (issue) {
      setError(issue.message);
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.createElement("textarea");
      input.value = joinUrl;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copiedToClipboard = document.execCommand("copy");
      input.remove();
      if (copiedToClipboard) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        setError("Could not copy the link. Select and copy the URL shown here.");
      }
    }
  };

  if (!poll && !error) return <CenteredState><LoaderCircle className="spin" size={23} /> Loading your poll…</CenteredState>;
  if (!poll) return <CenteredState><CircleHelp size={23} /><h2>We couldn’t find that poll</h2><p>{error}</p><a className="button button-primary" href="/">Back to dashboard</a></CenteredState>;

  const currentQuestion = poll.questions[poll.currentQuestionIndex];
  const isLive = poll.status === "running";
  const isResults = poll.status === "results";
  const isCompleted = poll.status === "completed";
  return <div className="app-shell">
    <Sidebar active="dashboard" />
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb"><a href="/">My polls</a><span className="crumb-slash">/</span><strong>{poll.title}</strong></div>
        <div className="topbar-right"><span className={`poll-status top-status ${poll.status}`}><span />{isLive ? "Live now" : isResults ? "Results" : isCompleted ? "Completed" : "Ready to start"}</span><span className="topbar-divider" /><button className="button button-quiet" onClick={duplicatePoll} disabled={busy}><Copy size={14} /> Reuse poll</button><button className="button button-quiet" onClick={() => go("/")}>Exit poll</button></div>
      </header>
      <section className="host-page">
        <div className="host-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> LIVE SESSION <span className="session-code">#{poll.code}</span></div><h1>{poll.title}</h1><p>{poll.questions.length} questions <span>·</span> 30 seconds each <span>·</span> No sign-up required</p></div>
          <div className="host-participant-pill"><Users size={17} /><strong>{poll.participantCount}</strong><span>joined</span></div>
        </div>
        {error && <div className="error-banner">{error}<button onClick={refresh}>Refresh</button></div>}
        <div className="host-layout">
          <section className="live-panel">
            {poll.status === "draft" ? <>
              <div className="panel-overline"><span className="soft-dot" /> READY WHEN YOU ARE</div>
              <div className="waiting-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><Radio size={28} /></div><span className="orbit-person person-a"><Users size={14} /></span><span className="orbit-person person-b"><Sparkles size={14} /></span><span className="orbit-person person-c"><Check size={14} /></span></div>
              <h2>Bring everyone into the conversation.</h2>
              <p className="live-description">Share your QR code to let people join. When you’re ready, start the first question and the 30-second timer will begin.</p>
              <div className="session-progress"><span>YOUR QUESTIONS</span><strong>{poll.questions.length} ready</strong><div className="progress-track"><span style={{ width: `${100 / poll.questions.length}%` }} /></div></div>
              <button className="button button-primary start-button" onClick={() => perform("start")} disabled={busy}><Radio size={17} /> {busy ? "Starting…" : "Start poll"} <ArrowRight size={16} /></button>
            </> : isCompleted ? <>
              <div className="panel-overline"><CheckCircle2 size={15} /> SESSION COMPLETE</div>
              <div className="complete-symbol"><Check size={27} /></div>
              <h2>That’s a wrap!</h2><p className="live-description">Everyone’s responses are in. Take a look at how the room voted.</p>
              <div className="final-summary"><strong>{poll.participantCount}</strong><span>people took part across {poll.questions.length} questions</span></div>
              <PollSummary questions={poll.questions} />
            </> : <>
              <div className="question-live-head">
                <div className="panel-overline">{isLive ? <><span className="live-pulse" /> QUESTION {String(poll.currentQuestionIndex + 1).padStart(2, "0")} <span className="of-label">/ {String(poll.questions.length).padStart(2, "0")}</span></> : <><CheckCircle2 size={15} /> QUESTION {String(poll.currentQuestionIndex + 1).padStart(2, "0")} RESULTS</>}</div>
                {isLive && <div className={`timer-ring ${seconds <= 10 ? "timer-warning" : ""}`}><span>{String(seconds).padStart(2, "0")}</span><small>SEC</small></div>}
              </div>
              <h2 className="live-question">{currentQuestion.text}</h2>
              {isLive ? <>
                <p className="live-description">{currentQuestion.totalVotes} of {poll.participantCount} {poll.participantCount === 1 ? "participant has" : "participants have"} answered so far. Results appear when the timer runs out.</p>
                <div className="live-answer-list">{currentQuestion.options.map((option, index) => <div className="live-answer-row" key={option}><span className="answer-letter" style={{ "--answer-color": colors[index] }}>{String.fromCharCode(65 + index)}</span><span>{option}</span><span className="hidden-count">—</span></div>)}</div>
                <div className="voting-note"><Users size={14} /> {currentQuestion.totalVotes} votes submitted <span>·</span><Clock3 size={14} /> {seconds}s remaining</div>
              </> : <>
                <p className="live-description">{currentQuestion.totalVotes} {currentQuestion.totalVotes === 1 ? "response" : "responses"} received</p>
                <ResultsList question={currentQuestion} />
                <button className="button button-primary start-button" onClick={() => perform("next")} disabled={busy}>{busy ? "Loading…" : poll.currentQuestionIndex + 1 === poll.questions.length ? "Finish poll" : "Next question"} <ArrowRight size={16} /></button>
              </>}
            </>}
          </section>
          <aside className="join-panel">
            <div className="join-card-head"><div><h3>Invite your audience</h3><p>Scan to join — no account needed.</p></div><span className="join-live-dot" /></div>
            <div className="qr-frame"><QRCodeSVG value={joinUrl} size={186} level="M" includeMargin bgColor="#ffffff" fgColor="#20223b" /></div>
            <div className="qr-caption"><span className="qr-spark">✳</span> SCAN TO JOIN YOUR POLL</div>
            <button className="copy-link-button" onClick={copyLink} aria-label={copied ? "Link copied" : "Copy join link"} title={copied ? "Copied!" : "Copy join link"}><Link2 size={15} /><span>{copied ? "Copied!" : joinUrl.replace(/^https?:\/\//, "")}</span>{copied ? <Check size={15} /> : <Copy size={14} />}</button>
            <div className="join-divider" />
            <div className="participants-heading"><span>PARTICIPANTS</span><strong>{poll.participantCount}</strong></div>
            <div className="participant-stack">
              {poll.participantCount ? <><div className="participant-faces">{Array.from({ length: Math.min(poll.participantCount, 5) }, (_, index) => <span className={`participant-face face-${index}`} key={index}>{["J", "M", "A", "K", "S"][index]}</span>)}</div><span className="joined-copy">{poll.participantCount > 5 ? `+${poll.participantCount - 5} ` : ""}in the room</span></> : <span className="waiting-copy"><span className="soft-dot" /> Waiting for people to join…</span>}
            </div>
            <div className="no-login-note"><CheckCircle2 size={15} /> Anonymous, no sign-up needed</div>
          </aside>
        </div>
        <div className="host-footer"><button className="back-link" onClick={() => go("/")}><ArrowLeft size={15} /> Back to all polls</button><span>Questions advance one at a time</span></div>
      </section>
    </main>
  </div>;
}

function ResultsList({ question }) {
  const max = Math.max(...question.counts, 1);
  return <div className="results-list">{question.options.map((option, index) => {
    const count = question.counts[index];
    const percent = question.totalVotes ? Math.round(count / question.totalVotes * 100) : 0;
    return <div className="result-row" key={option}>
      <div className="result-label"><span className="answer-letter" style={{ "--answer-color": colors[index] }}>{String.fromCharCode(65 + index)}</span><span>{option}</span><strong>{count}</strong><small>{percent}%</small></div>
      <div className="result-bar"><span style={{ width: `${count ? Math.max(count / max * 100, 4) : 0}%`, background: colors[index] }} /></div>
    </div>;
  })}</div>;
}

function PollSummary({ questions }) {
  return <section className="poll-summary">
    <div className="poll-summary-heading"><h3>Results summary</h3><span>{questions.length} questions</span></div>
    {questions.map((question, index) => <article className="summary-question" key={`${index}-${question.text}`}>
      <div className="summary-question-heading"><div><span className="question-number">Q{String(index + 1).padStart(2, "0")}</span><h4>{question.text}</h4></div><span>{question.totalVotes} {question.totalVotes === 1 ? "vote" : "votes"}</span></div>
      <ResultsList question={question} />
    </article>)}
  </section>;
}

function ParticipantPage({ code }) {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const latestPollRequest = useRef(0);
  const joinStarted = useRef(false);
  const nameStorageKey = `pulse-name-${code.toUpperCase()}`;
  const [firstName, setFirstName] = useState(() => getStoredValue(nameStorageKey) ?? "");
  const [participantId] = useState(() => {
    const storageKey = `pulse-participant-${code.toUpperCase()}`;
    let existing = getStoredValue(storageKey);
    if (!existing) {
      existing = createParticipantId();
      storeValue(storageKey, existing);
    }
    return existing;
  });

  const refresh = useCallback(async () => {
    const requestId = ++latestPollRequest.current;
    try {
      const current = await request(`/api/polls/${code}?participantId=${encodeURIComponent(participantId)}`);
      if (requestId !== latestPollRequest.current) return;
      setPoll(current);
      setError("");
      if (current.participantName) {
        setFirstName(current.participantName);
        setHasJoined(true);
      }
      const question = current.questions[current.currentQuestionIndex];
      const questionKey = `${current.code}:${current.currentQuestionIndex}`;
      setSelected((previous) => {
        if (previous?.questionKey !== questionKey) {
          return { questionKey, option: question?.selectedOption ?? null };
        }
        if (question?.selectedOption !== null && question?.selectedOption !== undefined) {
          return { questionKey, option: question.selectedOption };
        }
        return previous;
      });
    } catch (issue) {
      if (requestId === latestPollRequest.current) setError(issue.message);
    }
  }, [code, participantId]);

  const joinPoll = useCallback(async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName || joining || joinStarted.current) return;
    joinStarted.current = true;
    setJoining(true);
    setError("");
    try {
      const updated = await request(`/api/polls/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ participantId, firstName: trimmedName }),
      });
      latestPollRequest.current += 1;
      storeValue(nameStorageKey, trimmedName);
      setFirstName(trimmedName);
      setPoll(updated);
      setSelected({
        questionKey: `${updated.code}:${updated.currentQuestionIndex}`,
        option: updated.questions[updated.currentQuestionIndex]?.selectedOption ?? null,
      });
      setHasJoined(true);
    } catch (issue) {
      joinStarted.current = false;
      setError(issue.message);
    } finally {
      setJoining(false);
    }
  }, [code, joining, nameStorageKey, participantId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!poll?.endsAt) { setSeconds(30); return undefined; }
    const update = () => setSeconds(Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [poll?.endsAt]);

  const submitVote = async () => {
    if (selectedOption === null || submitting || seconds === 0) return;
    setSubmitting(true);
    try {
      const updated = await request(`/api/polls/${code}/vote`, {
        method: "POST",
        body: JSON.stringify({ participantId, optionIndex: selectedOption }),
      });
      latestPollRequest.current += 1;
      setPoll(updated);
      setError("");
    } catch (issue) { setError(issue.message); await refresh(); }
    finally { setSubmitting(false); }
  };

  if (error && !poll) return <main className="participant-shell">
    <header className="participant-header"><a className="brand participant-brand" href="/"><span className="brand-mark"><Radio size={19} strokeWidth={2.5} /></span><span>pulse<span className="brand-period">.</span></span></a></header>
    <section className="participant-card participant-error-card"><div className="waiting-icon"><CircleHelp size={25} /></div><h1>We can’t load this poll yet</h1><p>{error}</p><button className="button button-primary" onClick={refresh}>Try again</button></section>
  </main>;
  if (!poll) return <CenteredState><LoaderCircle className="spin" size={23} /> Joining the poll…</CenteredState>;

  const question = poll.questions[poll.currentQuestionIndex];
  const isLive = poll.status === "running";
  const hasVoted = question?.selectedOption !== null && question?.selectedOption !== undefined;
  const isFinished = poll.status === "completed";
  const isResults = poll.status === "results";
  const questionKey = `${poll.code}:${poll.currentQuestionIndex}`;
  const selectedOption = selected?.questionKey === questionKey ? selected.option : null;

  return <main className="participant-shell">
    <header className="participant-header"><a className="brand participant-brand" href="/"><span className="brand-mark"><Radio size={19} strokeWidth={2.5} /></span><span>pulse<span className="brand-period">.</span></span></a><span className="anonymous-badge"><span /> First name only</span></header>
    {error && <div className="participant-error">{error}</div>}
    <section className="participant-card">
      <div className="participant-card-top"><span className="participant-poll-title">{poll.title}</span><span className={`poll-status participant-status ${poll.status}`}><span />{isLive ? "LIVE" : isFinished ? "ENDED" : isResults ? "RESULTS" : "GETTING READY"}</span></div>
      {!hasJoined ? <form className="name-entry" onSubmit={(event) => { event.preventDefault(); joinPoll(firstName); }}>
        <div className="waiting-icon"><Users size={25} /></div>
        <div className="participant-eyebrow">WELCOME TO THE POLL</div>
        <h1>What should we call you?</h1>
        <p>Enter your first name to join in. No account needed.</p>
        <label className="name-entry-label" htmlFor="participant-first-name">FIRST NAME</label>
        <input id="participant-first-name" className="text-input name-entry-input" autoComplete="given-name" maxLength={40} placeholder="e.g. Alex" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <button className="button button-primary vote-button" disabled={!firstName.trim() || joining} type="submit">{joining ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} Join poll</button>
      </form> : poll.status === "draft" ? <div className="participant-waiting">
        <div className="waiting-icon"><Radio size={26} /></div><div className="participant-eyebrow">YOU’RE IN THE RIGHT PLACE</div><h1>You’re in!</h1><p>Hang tight — the host will start the first question in a moment.</p><div className="waiting-spinner"><span /><span /><span /></div>
      </div> : isFinished ? <div className="participant-waiting">
        <div className="waiting-icon finished"><CheckCircle2 size={28} /></div><div className="participant-eyebrow">POLL COMPLETE</div><h1>Thanks, {firstName}!</h1><p>Your answers have been recorded. You can close this page now.</p>
      </div> : <>
        <div className="participant-question-meta"><span>QUESTION {String(poll.currentQuestionIndex + 1).padStart(2, "0")} <span className="of-label">/ {String(poll.questions.length).padStart(2, "0")}</span></span>
          {isLive ? <div className={`participant-timer ${seconds <= 10 ? "timer-warning" : ""}`}><Clock3 size={14} /> 00:{String(seconds).padStart(2, "0")}</div> : <span className="results-pill"><CheckCircle2 size={14} /> RESULTS</span>}
        </div>
        <h1 className="participant-question">{question.text}</h1>
        {isLive ? <>
          {hasVoted ? <div className="vote-success"><CheckCircle2 size={19} /><div><strong>Your answer is in!</strong><span>Waiting for the next question…</span></div></div> : <>
            <p className="participant-instruction">Choose one answer below</p>
            <div className="participant-options">{question.options.map((option, index) => <button className={`participant-option ${selectedOption === index ? "selected" : ""}`} key={option} onClick={() => setSelected({ questionKey, option: index })}>
              <span className="answer-letter" style={{ "--answer-color": colors[index] }}>{String.fromCharCode(65 + index)}</span><span className="option-text">{option}</span><span className="option-radio">{selectedOption === index && <span />}</span>
            </button>)}</div>
            <button className="button button-primary vote-button" disabled={selectedOption === null || submitting || seconds === 0} onClick={submitVote}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Submit answer <ArrowRight size={15} /></button>
            <p className="vote-footnote"><span className="soft-dot" /> Your answer is private</p>
          </>}
        </> : <>
          <p className="participant-instruction">{question.totalVotes} {question.totalVotes === 1 ? "person has" : "people have"} answered</p>
          <ResultsList question={question} />
          <div className="participant-wait-next"><span className="soft-dot" /> Waiting for the next question…</div>
        </>}
      </>}
    </section>
    <footer className="participant-footer"><span>Powered by <strong>pulse<span className="brand-period">.</span></strong></span><span><LockIcon /> Your vote is private</span></footer>
  </main>;
}

function LockIcon() {
  return <LockKeyhole size={12} />;
}

function CenteredState({ children }) {
  return <div className="centered-state">{children}</div>;
}
