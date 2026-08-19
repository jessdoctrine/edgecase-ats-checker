"use client";

import { useMemo, useState } from "react";
import "./report.css";

const STOP = new Set("a an and are as at be by for from has have in into is it its of on or our that the their this to with will you your we they who using use preferred required including plus per years year".split(" "));
const LOW_VALUE = new Set("ability abilities applicant applicants candidate candidates company duties duty employer employment excellent ideal individual job jobs opportunity position qualifications qualified requirement requirements responsibilities responsibility responsible role roles team teams work working works help helps helped strong knowledge experience experienced support supporting supported various other good great must should ensure ensuring provide providing looking seeking include includes including day daily environment professional professionals successful success preferred required minimum related relevant".split(" "));
const ACTION = ["managed", "led", "built", "improved", "reduced", "increased", "trained", "operated", "coordinated", "maintained", "performed", "inspected", "supported", "delivered", "supervised", "created", "developed", "analyzed", "resolved", "monitored", "implemented", "prepared", "reviewed"];
const SECTIONS = ["experience", "skills", "education"];

function words(text: string) {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.]{1,}/g) || []).filter((word) => !STOP.has(word));
}

function cleanToken(token: string) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9+#.]+$/g, "");
}

function meaningful(token: string) {
  const word = cleanToken(token);
  return word.length > 2 && !STOP.has(word) && !LOW_VALUE.has(word) && !/^\d+$/.test(word);
}

function extractSignals(text: string) {
  const scores = new Map<string, number>();
  const rawLines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bodyLines = rawLines.length > 1 ? rawLines.slice(1) : rawLines;
  const lines = bodyLines.join("\n").split(/\n|[;.!?,:]/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const tokens = (line.match(/[A-Za-z][A-Za-z0-9+#.]{1,}/g) || []).map(cleanToken);
    tokens.forEach((token) => {
      if (meaningful(token)) scores.set(token, (scores.get(token) || 0) + 1);
    });
    for (const size of [2]) {
      for (let index = 0; index <= tokens.length - size; index++) {
        const group = tokens.slice(index, index + size);
        if (group.every(meaningful)) {
          const phrase = group.join(" ");
          scores.set(phrase, (scores.get(phrase) || 0) + 5);
        }
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || b[0].split(" ").length - a[0].split(" ").length);
  const selected: string[] = [];
  for (const [term] of ranked) {
    if (selected.some((chosen) => chosen.includes(term) || term.includes(chosen) && chosen.split(" ").length > 1)) continue;
    selected.push(term);
    if (selected.length === 28) break;
  }
  return selected;
}

function hasTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function listText(items: string[]) {
  if (!items.length) return "verified strengths";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function resumeLines(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => /^[-•*]/.test(line));
  const candidates = bullets.length ? bullets : lines.filter((line) => line.length >= 35 && line.length <= 220 && !/^(experience|skills|education|summary|objective)$/i.test(line));
  return candidates.map((line) => line.replace(/^[-•*]\s*/, "")).slice(0, 20);
}

function polishBullet(source: string) {
  let revised = source.trim().replace(/[.;,]+$/, "");
  revised = revised.replace(/^responsible for\s+/i, "Handled ").replace(/^duties included\s+/i, "Performed ").replace(/^helped (to )?/i, "Supported ");
  revised = revised.charAt(0).toUpperCase() + revised.slice(1);
  return `${revised}.`;
}

function makeSuggestions(resume: string, jobSignals: string[]) {
  return resumeLines(resume).map((source) => {
    const sourceWords = new Set(words(source));
    const signals = jobSignals.filter((term) => {
      const signalWords = term.split(" ").filter(meaningful);
      return signalWords.length > 0 && signalWords.every((word) => sourceWords.has(word) || sourceWords.has(`${word}s`) || sourceWords.has(word.replace(/s$/, "")));
    }).slice(0, 2);
    const action = ACTION.some((verb) => source.toLowerCase().includes(verb));
    const number = /\d/.test(source);
    const relevance = signals.length * 4 + (action ? 2 : 0) + (number ? 1 : 0);
    const note = signals.length
      ? `Connects directly to ${listText(signals)} in the target job.`
      : "Clarifies the verified duty. Add scope or a result only if you can support it.";
    return { source, revised: polishBullet(source), note, relevance };
  }).sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

export default function Home() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [ran, setRan] = useState(false);

  const report = useMemo(() => {
    const jobTerms = extractSignals(job);
    const matched = jobTerms.filter((term) => hasTerm(resume, term));
    const missing = jobTerms.filter((term) => !hasTerm(resume, term)).slice(0, 10);
    const keywordScore = jobTerms.length ? Math.round((matched.length / jobTerms.length) * 100) : 0;
    const foundSections = SECTIONS.filter((section) => new RegExp(`(^|\\n)\\s*${section}`, "i").test(resume));
    const bullets = resume.split("\n").filter((line) => /^\s*[-•*]/.test(line));
    const strongBullets = bullets.filter((line) => ACTION.some((verb) => line.toLowerCase().includes(verb)) && /\d/.test(line));
    const evidenceScore = bullets.length ? Math.min(100, Math.round((strongBullets.length / bullets.length) * 75) + 25) : 20;
    const hasContact = /[\w.+-]+@[\w.-]+\.\w{2,}|(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/.test(resume);
    const readableLines = resume.split("\n").filter(Boolean).filter((line) => line.length < 140).length;
    const allLines = resume.split("\n").filter(Boolean).length || 1;
    const formattingScore = Math.min(100, foundSections.length * 20 + (bullets.length >= 3 ? 20 : bullets.length * 5) + (hasContact ? 15 : 0) + (readableLines / allLines >= .8 ? 5 : 0));
    const contentScore = Math.round(keywordScore * .7 + evidenceScore * .3);
    const title = job.split("\n").find((line) => line.trim().length > 3 && line.trim().length < 80)?.trim() || "Target Role";
    const summaryTerms = matched.filter((term) => term.split(" ").length > 1).slice(0, 3);
    const fallbackTerms = matched.filter((term) => !summaryTerms.includes(term)).slice(0, 3 - summaryTerms.length);
    const summary = `Experienced professional with demonstrated strengths in ${listText([...summaryTerms, ...fallbackTerms])}. Brings practical, verified experience that aligns with the ${title} role, with a focus on clear execution, quality, and dependable results.`;
    const suggestions = makeSuggestions(resume, [...matched, ...missing]);
    return { matched, missing, keywordScore, formattingScore, evidenceScore, contentScore, foundSections, bullets, hasContact, title, summary, suggestions };
  }, [resume, job]);

  const analyze = () => {
    if (resume.trim().length > 60 && job.trim().length > 60) setRan(true);
  };

  return <main>
    <nav className="nav"><div className="brand"><span className="mark">E</span><span>EDGECASE <b>LABS</b></span></div><span className="privacy">Private browser analysis</span></nav>
    <section className="hero"><div className="eyebrow">RESUME SIGNAL ANALYZER · BETA</div><h1>Make your experience<br/><em>impossible to miss.</em></h1><p>Compare a resume to a real job description. Get clear content alignment, high value missing language, formatting checks, and grounded rewrite ideas without keyword stuffing.</p></section>
    <section className="workspace">
      <div className="inputCard"><div className="inputHead"><span>01</span><div><h2>Resume text</h2><p>Paste the full resume exactly as it appears.</p></div></div><textarea aria-label="Resume text" value={resume} onChange={(event) => { setResume(event.target.value); setRan(false); }} placeholder="Paste resume here…"/><small>{words(resume).length} words</small></div>
      <div className="inputCard"><div className="inputHead"><span>02</span><div><h2>Target job</h2><p>Paste the complete job listing, including requirements.</p></div></div><textarea aria-label="Job description" value={job} onChange={(event) => { setJob(event.target.value); setRan(false); }} placeholder="Paste job description here…"/><small>{words(job).length} words</small></div>
    </section>
    <div className="runRow"><button onClick={analyze} disabled={resume.trim().length <= 60 || job.trim().length <= 60}>Analyze match <span>→</span></button><p>No account required. Your text is not saved.</p></div>
    {ran && <section className="results" aria-live="polite">
      <div className="resultTop"><div className="scoreDial" style={{ "--score": `${report.contentScore * 3.6}deg` } as React.CSSProperties}><div><strong>{report.contentScore}</strong><small>/100</small></div></div><div><div className="eyebrow">CONTENT ALIGNMENT</div><h2>{report.title}</h2><p>This score measures relevant language and evidence only. Formatting readiness is reported separately and does not change this score.</p></div></div>
      <div className="scoreSplit"><div><h3>Content alignment</h3><Metric name="Relevant language" value={report.keywordScore}/><Metric name="Achievement evidence" value={report.evidenceScore}/></div><div className="readinessCard"><span>FORMATTING READINESS</span><strong>{report.formattingScore}%</strong><p>Basic headings, contact details, bullet structure, and readable line length.</p></div></div>
      <div className="reportGrid">
        <article><div className="kicker orange">HIGH VALUE GAPS</div><h3>Priority language to review</h3><p className="muted">Generic hiring words are filtered out. Add a term only when it truthfully describes the candidate’s experience.</p><div className="chips">{report.missing.length ? report.missing.map((term) => <span key={term}>{term}</span>) : <span className="good">Strong coverage</span>}</div></article>
        <article><div className="kicker">FORMATTING CHECK</div><h3>Formatting readiness</h3><ul>{SECTIONS.map((section) => <li key={section} className={report.foundSections.includes(section) ? "pass" : "warn"}><b>{report.foundSections.includes(section) ? "✓" : "!"}</b> {section[0].toUpperCase() + section.slice(1)} heading {report.foundSections.includes(section) ? "detected" : "not detected"}</li>)}<li className={report.bullets.length >= 3 ? "pass" : "warn"}><b>{report.bullets.length >= 3 ? "✓" : "!"}</b> {report.bullets.length} bullet lines detected</li><li className={report.hasContact ? "pass" : "warn"}><b>{report.hasContact ? "✓" : "!"}</b> Contact detail {report.hasContact ? "detected" : "not detected"}</li></ul></article>
        <article className="bulletCoach"><div className="kicker">GROUNDED BULLET COACH</div><h3>Suggestions based on this resume</h3>{report.suggestions.length ? report.suggestions.map((item, index) => <div className="bulletSuggestion" key={`${item.source}-${index}`}><p className="sourceLine"><span>Original</span>{item.source}</p><p className="suggestionLine"><span>Polished</span>{item.revised}</p><small>{item.note}</small></div>) : <p className="muted">Add a few experience bullets to receive grounded suggestions.</p>}<p className="muted">No metrics, credentials, or duties are invented.</p></article>
        <article><div className="kicker">TAILORED COPY</div><h3>Professional summary</h3><div className="copyBox">{report.summary}</div><p className="muted">This summary uses only language found in both the resume and target job.</p></article>
      </div>
    </section>}
    <section className="founder">
      <div className="founderPhoto"><img src="/founder.jpeg" alt="Founder of EdgeCase Labs" /></div>
      <div className="founderStory">
        <div className="eyebrow">THE HUMAN BEHIND THE ANALYSIS</div>
        <h2>Why EdgeCase Labs exists.</h2>
        <p className="founderLead">I’m a California data annotator and AI evaluator who believes automated scores should explain themselves.</p>
        <p>I’m heavily involved in the work behind AI, evaluating frontier models across text, image, video, and speech. My experience includes multimodal annotation, TTS and audio quality review, instruction following assessment, behavioral and bias checks, and adversarial prompt design, supported by a background in Information Systems.</p>
        <p>The idea for EdgeCase Labs clicked after I received outreach from a recruiter representing Apple that appeared to contain leftover AI template language. It made the hidden process feel suddenly visible. Candidate tracking, automated filtering, and labels such as “low effort” can influence how a person is viewed before their experience is fully considered by another human.</p>
        <p>I built this tool to make that process less opaque. EdgeCase Labs offers clear signals, grounded recommendations, and an honest explanation of what can be improved without pretending anyone can “beat” private hiring systems.</p>
        <div className="expertise"><span>Multimodal AI evaluation</span><span>Adversarial testing</span><span>Human focused analysis</span></div>
        <a className="contactLink" href="mailto:jess@edgecaselabs.info"><span>CONTACT</span>jess@edgecaselabs.info</a>
        <div className="founderTitle"><i></i><div><strong>Founder</strong><small>EDGECASE LABS</small></div></div>
      </div>
    </section>
    <footer><div className="brand"><span className="mark">E</span><span>EDGECASE LABS</span></div><p>Built to clarify fit, not game hiring systems.</p><a href="mailto:jess@edgecaselabs.info">jess@edgecaselabs.info</a></footer>
  </main>;
}

function Metric({ name, value }: { name: string; value: number }) {
  return <div className="metric"><div><span>{name}</span><b>{value}%</b></div><div className="bar"><i style={{ width: `${value}%` }}/></div></div>;
}
