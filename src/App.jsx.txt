import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ---------- static content ----------
const dayOfYear = (d = new Date()) => {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
};
const todayKey = () => new Date().toISOString().slice(0, 10);

const CHALLENGES = [
  "Drink your first glass of water before you check your phone.",
  "Take a 10-minute walk outside, no headphones.",
  "Write down three things you're proud of from this week.",
  "Stretch for 5 minutes before bed tonight.",
  "Send one message telling someone you appreciate them.",
  "Do one task you've been putting off, even for 10 minutes.",
  "Eat one meal today without a screen in front of you.",
  "Tidy one small corner of your space.",
  "Take a 20-minute break from all screens this afternoon.",
  "Write tomorrow's top 3 priorities before you go to sleep.",
  "Try a new stretch or breathing exercise for 5 minutes.",
  "Compliment yourself out loud once today.",
  "Go to bed 20 minutes earlier than usual.",
  "Batch-cook or prep one thing for tomorrow.",
];
const GOALS = [
  "Finish today feeling like you kept one promise to yourself.",
  "Protect one uninterrupted hour of focus.",
  "Leave your space a little better than you found it.",
  "Get outside at least once, even briefly.",
  "Move your body for at least 15 minutes.",
  "Hit your hydration target before dinner.",
  "Wrap up your top task before checking anything else.",
  "Have one real conversation, not just messages.",
  "Rest without guilt for at least 20 minutes.",
  "End the day with your phone away an hour before bed.",
];
const MEALS = [
  "Greek yogurt with berries, walnuts, and a drizzle of honey.",
  "Veggie-loaded stir fry with tofu or chicken over rice.",
  "Avocado toast with a fried egg and hot sauce.",
  "Lentil soup with crusty bread.",
  "Grilled salmon, roasted vegetables, and quinoa.",
  "Overnight oats with banana and peanut butter.",
  "Big salad with chickpeas, feta, and a lemon vinaigrette.",
  "Turkey or black bean chili.",
  "Stuffed sweet potato with black beans and salsa.",
  "Veggie omelet with a side of fruit.",
  "Whole grain pasta with tomato sauce and a side salad.",
  "Smoothie with spinach, frozen fruit, and protein of choice.",
  "Chicken or tofu tacos with slaw.",
  "Rice bowl with edamame, cucumber, and sesame dressing.",
];
const SKIN_RECIPES = {
  dry: { label: "Feeling dry or tight", name: "Honey + Milk Hydrating Mask", steps: "Mix 1 tbsp raw honey with 2 tbsp whole milk. Apply for 10–15 minutes, rinse with lukewarm water.", why: "Honey draws in and holds moisture, and the fats in milk help soften rough, tight patches." },
  tired: { label: "Looking tired or puffy", name: "Chilled Green Tea + Cucumber Compress", steps: "Steep green tea, chill it, soak two cotton pads, and rest them over your eyes/cheeks for 10 minutes.", why: "Cold temperature calms puffiness, and green tea's antioxidants help skin look less dull." },
  oily: { label: "Oily or breakout-prone today", name: "Yogurt + Oat Gentle Clarifying Mask", steps: "Mix 2 tbsp plain yogurt with 1 tbsp finely ground oats. Apply for 10 minutes, massage off gently, rinse.", why: "Lactic acid in yogurt gently exfoliates while oats calm irritation without over-drying skin." },
  dull: { label: "Dull, uneven tone", name: "Turmeric + Yogurt Brightening Treatment", steps: "Mix a small pinch of turmeric with 2 tbsp plain yogurt. Apply for 5–8 minutes only, then rinse well.", why: "Turmeric is a mild brightening agent and yogurt's lactic acid helps soften rough texture." },
  normal: { label: "Just want a refresh", name: "Oat + Honey Soothing Mask", steps: "Mix 2 tbsp cooked, cooled oats with 1 tsp honey. Apply for 10 minutes, rinse with warm water.", why: "A gentle, low-risk mask that softens and hydrates without targeting anything specific." },
};
const STUDY_TIPS = {
  math: ["Khan Academy for structured practice", "Work problems by hand before checking solutions", "Study in 25-min focused blocks — math rewards short, sharp reps"],
  coding: ["Build something small alongside any tutorial", "Use spaced repetition (Anki) for syntax you keep forgetting", "Rubber-duck debug out loud before searching for the error"],
  language: ["Anki or Duolingo for daily vocab reps", "Shadow native audio 10 minutes a day for pronunciation", "Consume content just above your comfort level"],
  writing: ["Outline before drafting — even 5 bullet points", "Read your draft out loud to catch awkward phrasing", "Separate drafting and editing into different sessions"],
  science: ["Draw the process from memory, then check it", "Teach the concept out loud to an imaginary student", "Study your hardest subject when your energy is highest"],
  default: ["Break material into the smallest testable chunks", "Use active recall over rereading", "Study your hardest subject when your energy is highest"],
};
const OUTFIT_RULES = [
  { match: ["gym", "workout", "exercise"], text: "Moisture-wicking layers you can shed — breathable top, leggings or shorts, broken-in shoes." },
  { match: ["meeting", "interview", "presentation"], text: "One polished anchor piece with something comfortable underneath — put-together, but forgettable to wear." },
  { match: ["study", "class", "school"], text: "Comfortable layers for any classroom temperature, plus one piece you actually like." },
  { match: ["date", "dinner", "going out"], text: "One deliberate detail — a color, texture, or accessory you feel good in." },
  { match: ["rain", "wet"], text: "Water-resistant outer layer and shoes that can handle puddles." },
  { match: ["cold", "winter", "snow"], text: "Layer thin-to-thick: base layer, insulation, wind/water-resistant shell." },
  { match: ["hot", "summer", "warm"], text: "Breathable natural fabrics, light colors, room to move." },
];

async function callClaude(messages, max_tokens = 500) {
  const res = await fetch("/.netlify/functions/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens }),
  });
  const data = await res.json();
  return (data.content || []).map((c) => c.text || "").join("\n").trim();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Auth screen ----------
function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { name, email, createdAt: Date.now() }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message.replace("Firebase: ", ""));
    }
    setBusy(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div style={{ textAlign: "center" }}>
          <div className="auth-logo">✨</div>
          <h1 className="auth-title serif">Glow Up</h1>
          <p className="auth-sub">Your daily wellness & planning companion</p>
        </div>
        {mode === "signup" && (
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What should I call you?" />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" type="password" />
        </div>
        <button className="btn-primary" disabled={busy || !email || !password || (mode === "signup" && !name)} onClick={submit}>
          {busy ? "One moment..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button className="link-toggle" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        {error && <p className="auth-error">{error}</p>}
        <p className="auth-note">Your data is tied to your real account now — it'll be there whenever you log back in.</p>
      </div>
    </div>
  );
}

// ---------- Main app ----------
function MainApp({ user }) {
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("moderate");
  const [climate, setClimate] = useState("mild");
  const [logged, setLogged] = useState(0);

  const [skinPick, setSkinPick] = useState(null);
  const [skinImage, setSkinImage] = useState(null);
  const [skinLoading, setSkinLoading] = useState(false);
  const [skinAIResult, setSkinAIResult] = useState(null);

  const [wakeTime, setWakeTime] = useState("07:00");
  const [taskInput, setTaskInput] = useState("");
  const [wakeForPlan, setWakeForPlan] = useState("07:00");
  const [schedule, setSchedule] = useState(null);

  const [subject, setSubject] = useState("");
  const [activityCtx, setActivityCtx] = useState("");
  const [styleImage, setStyleImage] = useState(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleAIResult, setStyleAIResult] = useState(null);

  const [reflection, setReflection] = useState("");
  const [debrief, setDebrief] = useState("");
  const [debriefLoading, setDebriefLoading] = useState(false);

  const [streak, setStreak] = useState(1);

  const doy = dayOfYear();
  const challenge = CHALLENGES[doy % CHALLENGES.length];
  const goal = GOALS[(doy + 3) % GOALS.length];
  const mealPick = MEALS[(doy + 6) % MEALS.length];

  const userRef = doc(db, "users", user.uid);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {};
      setProfile(data);
      setWeight(data.weight || "");
      setActivity(data.activity || "moderate");
      setClimate(data.climate || "mild");
      setLogged((data.hydrationLogs && data.hydrationLogs[todayKey()]) || 0);

      const last = data.streakLastDate;
      let count = data.streakCount || 1;
      if (last) {
        const diff = Math.round((new Date(todayKey()) - new Date(last)) / 86400000);
        if (diff === 1) count += 1;
        else if (diff > 1) count = 1;
      }
      setStreak(count);
      await setDoc(userRef, { streakCount: count, streakLastDate: todayKey() }, { merge: true });
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (fields) => setDoc(userRef, fields, { merge: true });

  const hydrationTarget = useMemo(() => {
    const w = Number(weight) || 140;
    let oz = w * 0.55;
    if (activity === "light") oz += 8;
    if (activity === "moderate") oz += 16;
    if (activity === "high") oz += 28;
    if (climate === "hot") oz += 16;
    if (climate === "humid") oz += 10;
    return Math.round(oz / 4) * 4;
  }, [weight, activity, climate]);

  const addWater = (oz) => {
    const next = logged + oz;
    setLogged(next);
    save({ [`hydrationLogs.${todayKey()}`]: next });
  };

  const sleepSuggestions = useMemo(() => {
    const [h, m] = wakeTime.split(":").map(Number);
    const wake = new Date();
    wake.setHours(h, m, 0, 0);
    return [6, 5, 4].map((c) => {
      const bed = new Date(wake.getTime() - (c * 90 + 15) * 60000);
      return { cycles: c, time: bed.toTimeString().slice(0, 5), hours: (c * 1.5).toFixed(1) };
    });
  }, [wakeTime]);

  const buildSchedule = () => {
    const tasks = taskInput.split("\n").map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) return;
    const [h, m] = wakeForPlan.split(":").map(Number);
    let cursor = new Date();
    cursor.setHours(h, m, 0, 0);
    const blocks = [];
    const push = (label, mins) => {
      const start = new Date(cursor);
      cursor = new Date(cursor.getTime() + mins * 60000);
      blocks.push({ label, start: start.toTimeString().slice(0, 5), end: cursor.toTimeString().slice(0, 5) });
    };
    push("Wake up & morning routine", 30);
    push("Breakfast", 20);
    tasks.forEach((t, i) => {
      const isDeepWork = i < 2;
      push(t, isDeepWork ? 90 : 45);
      if (i === Math.floor(tasks.length / 2) - 1) push("Lunch", 40);
      if (isDeepWork) push("Short break", 10);
    });
    push("Movement / exercise", 30);
    push("Dinner", 30);
    push("Wind down (no screens)", 30);
    setSchedule(blocks);
  };

  const matchedOutfit = useMemo(() => {
    const q = activityCtx.toLowerCase();
    const hit = OUTFIT_RULES.find((r) => r.match.some((m) => q.includes(m)));
    return hit ? hit.text : null;
  }, [activityCtx]);

  const matchedStudy = useMemo(() => {
    const q = subject.toLowerCase();
    if (/math|calc|algebra|stat/.test(q)) return STUDY_TIPS.math;
    if (/code|program|cs|software|dev/.test(q)) return STUDY_TIPS.coding;
    if (/language|spanish|french|japanese|mandarin|german/.test(q)) return STUDY_TIPS.language;
    if (/writ|essay|english|literature/.test(q)) return STUDY_TIPS.writing;
    if (/bio|chem|physic|science/.test(q)) return STUDY_TIPS.science;
    return subject ? STUDY_TIPS.default : null;
  }, [subject]);

  const handleSkinPhoto = async (file) => {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setSkinImage({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file) });
    setSkinAIResult(null);
  };

  const analyzeSkinPhoto = async () => {
    if (!skinImage) return;
    setSkinLoading(true);
    try {
      const text = await callClaude([
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: skinImage.mediaType, data: skinImage.base64 } },
            { type: "text", text: "You're a gentle skincare assistant. Look only at general skin texture and hydration cues (dryness, oiliness, tired/dull appearance, redness/breakouts). Do NOT comment on attractiveness, weight, facial features, age, or identity. Do NOT diagnose medical conditions. In 2 short sentences, describe the general skin state, then on its own final line write exactly one word from: dry, tired, oily, dull, normal." },
          ],
        },
      ], 400);
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const last = lines[lines.length - 1]?.toLowerCase();
      const key = Object.keys(SKIN_RECIPES).includes(last) ? last : "normal";
      setSkinAIResult({ summary: lines.slice(0, -1).join(" ") || text, key });
      setSkinPick(key);
    } catch (e) {
      setSkinAIResult({ summary: "Couldn't analyze that photo right now — try again in a moment." });
    }
    setSkinLoading(false);
  };

  const handleStylePhoto = async (file) => {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setStyleImage({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file) });
    setStyleAIResult(null);
  };

  const analyzeStylePhoto = async () => {
    if (!styleImage) return;
    setStyleLoading(true);
    try {
      const text = await callClaude([
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: styleImage.mediaType, data: styleImage.base64 } },
            { type: "text", text: "You're a friendly style assistant. Look only at clothing colors/style already visible and general coloring (skin tone, hair color) for color-matching. Do NOT comment on body size, weight, shape, or attractiveness — that's off limits. " + (activityCtx ? `Today's plan: ${activityCtx}. ` : "") + "In 2-3 short sentences, suggest colors or a style direction that would work well." },
          ],
        },
      ], 400);
      setStyleAIResult(text);
    } catch (e) {
      setStyleAIResult("Couldn't read that photo right now — try again in a moment.");
    }
    setStyleLoading(false);
  };

  const runDebrief = async () => {
    if (!reflection.trim()) return;
    setDebriefLoading(true);
    try {
      const text = await callClaude([
        {
          role: "user",
          content: "You are a warm, grounded evening reflection coach inside a wellness app called Glow Up. Respond in 3 short parts with plain sentence-case headers: what went well, one honest observation about friction (kind, not harsh), and one small concrete suggestion for tomorrow. Under 120 words, no bullet emojis, warm direct tone.\n\nHere is the user's recap of their day:\n\n" + reflection,
        },
      ], 600);
      setDebrief(text || "Couldn't generate a debrief right now.");
    } catch (e) {
      setDebrief("Something went wrong reaching the coach. Try again in a moment.");
    }
    setDebriefLoading(false);
  };

  if (!loaded) return <div className="auth-screen"><p style={{ color: "white" }}>Loading your glow...</p></div>;

  const TABS = [
    { id: "home", label: "Home" },
    { id: "hydrate", label: "Hydrate" },
    { id: "skin", label: "Skin" },
    { id: "plan", label: "Plan" },
    { id: "life", label: "Life" },
    { id: "reflect", label: "Reflect" },
  ];

  return (
    <div className="app-shell">
      <div className="app-header">
        <div>
          <p className="header-greet">Hey {(profile?.name || "there").split(" ")[0]},</p>
          <h1 className="header-title serif">good to see you</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="streak-pill">🔥 {streak}</div>
          <button onClick={() => signOut(auth)} style={{ background: "none", border: "none", color: "white", fontSize: 12, cursor: "pointer" }}>Log out</button>
        </div>
      </div>

      <div className="app-content">
        {tab === "home" && (
          <>
            <div className="card">
              <div className="eyebrow gold">Today's main goal</div>
              <p className="body-text serif" style={{ fontSize: 17 }}>{goal}</p>
            </div>
            <div className="card">
              <div className="eyebrow blue">Daily challenge</div>
              <p className="body-text">{challenge}</p>
            </div>
            <div className="stat-grid">
              <div className="mini-stat">
                <p className="label">Water today</p>
                <p className="value">{logged} oz</p>
                <p className="sub">of {hydrationTarget} oz</p>
              </div>
              <div className="mini-stat">
                <p className="label">Glow streak</p>
                <p className="value">{streak} day{streak === 1 ? "" : "s"}</p>
                <p className="sub">keep it going</p>
              </div>
            </div>
            <div className="card">
              <div className="eyebrow green">Today's nourish pick</div>
              <p className="body-text">{mealPick}</p>
            </div>
          </>
        )}

        {tab === "hydrate" && (
          <>
            <div className="card">
              <h2>Your intake target</h2>
              <div className="grid-3">
                <div>
                  <div className="small-label">Weight (lb)</div>
                  <input className="input" value={weight} onChange={(e) => { setWeight(e.target.value); save({ weight: e.target.value }); }} placeholder="140" />
                </div>
                <div>
                  <div className="small-label">Activity</div>
                  <select className="input" value={activity} onChange={(e) => { setActivity(e.target.value); save({ activity: e.target.value }); }}>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <div className="small-label">Climate</div>
                  <select className="input" value={climate} onChange={(e) => { setClimate(e.target.value); save({ climate: e.target.value }); }}>
                    <option value="mild">Mild</option>
                    <option value="hot">Hot</option>
                    <option value="humid">Humid</option>
                  </select>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 10 }}>Target: <b style={{ color: "#3A2C3E" }}>{hydrationTarget} oz</b> today</p>
            </div>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h2>Today's log</h2>
                <span className="hint">{logged} / {hydrationTarget} oz</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, (logged / hydrationTarget) * 100)}%` }} /></div>
              <div className="chip-row">
                {[8, 12, 16, 24].map((oz) => (
                  <button key={oz} className="chip" onClick={() => addWater(oz)}>+ {oz} oz</button>
                ))}
              </div>
              {logged < hydrationTarget * 0.5 && <p className="warn-text">You're behind pace for the day — a glass now keeps you on track.</p>}
            </div>
          </>
        )}

        {tab === "skin" && (
          <>
            <div className="card">
              <h2>Scan your skin</h2>
              <p className="hint">Take or upload a photo. It's sent once for analysis and isn't stored anywhere.</p>
              {skinImage && <img className="preview-img" src={skinImage.previewUrl} alt="preview" />}
              <label className="upload-btn">
                Take / upload photo
                <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={(e) => handleSkinPhoto(e.target.files?.[0])} />
              </label>
              {skinImage && <button className="action-btn" disabled={skinLoading} onClick={analyzeSkinPhoto}>{skinLoading ? "Analyzing..." : "Analyze my skin"}</button>}
              {skinAIResult && <p className="result-box">{skinAIResult.summary}</p>}
            </div>
            <div className="card">
              <h2>Or pick how it feels</h2>
              <p className="hint">No photo needed.</p>
              {Object.entries(SKIN_RECIPES).map(([key, r]) => (
                <button key={key} className={`pick-btn ${skinPick === key ? "active" : ""}`} onClick={() => setSkinPick(key)}>{r.label}</button>
              ))}
            </div>
            {skinPick && (
              <div className="card">
                <div className="eyebrow gold">Recipe for you</div>
                <h2 className="serif">{SKIN_RECIPES[skinPick].name}</h2>
                <p className="body-text">{SKIN_RECIPES[skinPick].steps}</p>
                <p className="hint" style={{ fontStyle: "italic", marginTop: 6 }}>{SKIN_RECIPES[skinPick].why}</p>
              </div>
            )}
          </>
        )}

        {tab === "plan" && (
          <>
            <div className="card">
              <h2>Sleep pacer</h2>
              <div className="small-label">What time do you want to wake up?</div>
              <input className="input" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
              <div style={{ marginTop: 10 }}>
                {sleepSuggestions.map((s) => (
                  <div key={s.cycles} className="time-block sleep"><span>Lights out by <b>{s.time}</b></span><span>{s.hours} hrs</span></div>
                ))}
              </div>
            </div>
            <div className="card">
              <h2>Time-block your day</h2>
              <div className="small-label">Wake time</div>
              <input className="input" type="time" value={wakeForPlan} onChange={(e) => setWakeForPlan(e.target.value)} />
              <div className="small-label" style={{ marginTop: 8 }}>Tasks (one per line)</div>
              <textarea className="input" rows={4} value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder={"Finish reading assignment\nGym\nProject work"} />
              <button className="action-btn" onClick={buildSchedule}>Build my schedule</button>
              {schedule && (
                <div style={{ marginTop: 10 }}>
                  {schedule.map((b, i) => (
                    <div key={i} className="time-block"><span>{b.label}</span><span>{b.start}–{b.end}</span></div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "life" && (
          <>
            <div className="card">
              <h2>Style coordinator</h2>
              <div className="small-label">What's the day/activity/weather?</div>
              <input className="input" value={activityCtx} onChange={(e) => setActivityCtx(e.target.value)} placeholder="e.g. gym then a rainy meeting" />
              {matchedOutfit && <p className="result-box">{matchedOutfit}</p>}
              <div className="divider">
                <p className="hint">Or show me what you're working with (an outfit or a mirror pic) for color/style matching:</p>
                {styleImage && <img className="preview-img" src={styleImage.previewUrl} alt="preview" />}
                <label className="upload-btn">
                  Take / upload photo
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleStylePhoto(e.target.files?.[0])} />
                </label>
                {styleImage && <button className="action-btn" disabled={styleLoading} onClick={analyzeStylePhoto}>{styleLoading ? "Looking..." : "Get style suggestions"}</button>}
                {styleAIResult && <p className="result-box">{styleAIResult}</p>}
              </div>
            </div>
            <div className="card">
              <div className="eyebrow blue">Academic advisor</div>
              <div className="small-label">What are you studying?</div>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. organic chemistry" />
              {matchedStudy && matchedStudy.map((tip, i) => <p key={i} className="result-box" style={{ background: "#EAF4FA", color: "#3A2C3E" }}>{tip}</p>)}
            </div>
          </>
        )}

        {tab === "reflect" && (
          <div className="card">
            <h2>Evening debrief</h2>
            <div className="small-label">How did today go?</div>
            <textarea className="input" rows={5} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Tell me what happened today..." />
            <button className="action-btn" disabled={debriefLoading || !reflection.trim()} onClick={runDebrief}>{debriefLoading ? "Thinking..." : "Get my debrief"}</button>
            {debrief && <p className="result-box">{debrief}</p>}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className="nav-btn" onClick={() => setTab(t.id)} style={{ color: tab === t.id ? "#C98A6B" : "#C9BEC7" }}>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="auth-screen"><p style={{ color: "white" }}>Loading...</p></div>;
  if (!user) return <AuthScreen />;
  return <MainApp user={user} />;
}
