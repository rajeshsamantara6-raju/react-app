import './App.css';
import { useEffect, useMemo, useRef, useState } from 'react';

const sampleJob = 'We are looking for a product designer to shape intuitive digital experiences. You will collaborate with product managers and engineers, lead user research, create wireframes and prototypes, and use Figma to deliver accessible solutions. Strong communication, interaction design, usability testing, and experience working in agile teams are important.';
const scoreWeights = [0.35, 0.25, 0.2, 0.1, 0.1];
const starterHistory = [
  { id: '1', title: 'Senior Product Designer', date: 'Oct 08, 2026', score: 82, file: 'Product designer resume.pdf' },
  { id: '2', title: 'UX Designer', date: 'Oct 04, 2026', score: 74, file: 'UX portfolio resume.docx' },
  { id: '3', title: 'Product Design Lead', date: 'Sep 28, 2026', score: 91, file: 'Design lead resume.pdf' },
];

function readHistory() {
  try { return JSON.parse(localStorage.getItem('resumeiq-history')) || starterHistory; }
  catch { return starterHistory; }
}

function analyzeText(resumeText, jobDescription) {
  const stop = new Set('the and for with you are our from your will this that have has into use using work working'.split(' '));
  const words = (text) => [...new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) || []).filter((word) => !stop.has(word)))];
  const resumeWords = new Set(words(resumeText));
  const jobWords = words(jobDescription);
  const matchedKeywords = jobWords.filter((word) => resumeWords.has(word));
  const missingKeywords = jobWords.filter((word) => !resumeWords.has(word));
  const keyword = Math.round(matchedKeywords.length / Math.max(1, jobWords.length) * 100);
  const hasSections = /experience|education|skills|summary|projects/i.test(resumeText);
  const hasContact = /@|\b(?:\+?\d[\d ()-]{7,}\d)\b/.test(resumeText);
  const structure = Math.min(100, (hasSections ? 70 : 35) + (hasContact ? 15 : 0) + (resumeText.length > 900 ? 15 : 0));
  const skills = Math.min(100, Math.round(keyword * 0.8 + (resumeWords.size > 30 ? 20 : 5)));
  const experience = Math.min(100, Math.round(keyword * 0.75 + (/\b(led|built|managed|created|improved|delivered)\b/i.test(resumeText) ? 25 : 10)));
  const sentences = Math.max(1, resumeText.split(/[.!?]/).length);
  const readability = Math.max(35, Math.min(98, Math.round(94 - Math.max(0, resumeText.split(/\s+/).length / sentences - 24))));
  const breakdown = [
    { name: 'Keyword match', score: keyword }, { name: 'Skills alignment', score: skills },
    { name: 'Experience relevance', score: experience }, { name: 'Resume structure', score: structure },
    { name: 'Readability', score: readability },
  ];
  return {
    overall: Math.round(breakdown.reduce((sum, item, index) => sum + item.score * scoreWeights[index], 0)),
    breakdown, matchedKeywords, missingKeywords, mode: 'demo',
    disclaimer: 'Demo analysis uses text-matching heuristics, not an employer ATS result. Screening systems and criteria vary.',
    recommendations: [
      ...(missingKeywords.length ? [{ title: 'Review missing job terms', detail: 'Consider adding relevant terms only where they truthfully describe your experience.' }] : []),
      ...(!hasSections ? [{ title: 'Make sections easy to scan', detail: 'Use clear headings such as Experience, Skills, and Education.' }] : []),
      ...(!hasContact ? [{ title: 'Check contact details', detail: 'Make sure your resume includes a professional email address and phone number.' }] : []),
    ],
  };
}

function ScoreRing({ score, small = false }) {
  return <div className={`score-ring ${small ? 'score-ring-small' : ''}`} style={{ '--score': `${score * 3.6}deg` }} aria-label={`Score ${score} out of 100`}><div><strong>{score}</strong><span>/ 100</span></div></div>;
}

function App() {
  const [view, setView] = useState('overview');
  const [history, setHistory] = useState(readHistory);
  const [dark, setDark] = useState(() => localStorage.getItem('resumeiq-theme') === 'dark');
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [expanded, setExpanded] = useState(-1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const inputRef = useRef(null);
  const endpoint = process.env.REACT_APP_CATALYST_FUNCTION_URL;

  useEffect(() => {
    localStorage.setItem('resumeiq-theme', dark ? 'dark' : 'light');
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  useEffect(() => { localStorage.setItem('resumeiq-history', JSON.stringify(history)); }, [history]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredHistory = useMemo(() => history.filter((item) => {
    const match = `${item.title} ${item.file}`.toLowerCase().includes(search.toLowerCase());
    return match && (filter === 'all' || (filter === 'strong' ? item.score >= 80 : item.score < 80));
  }), [filter, history, search]);
  const average = history.length ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length) : 0;

  function chooseFile(next) {
    setError('');
    if (!next) return;
    if (!/\.(pdf|docx)$/i.test(next.name)) return setError('Choose a PDF or DOCX file.');
    if (next.size > 10 * 1024 * 1024) return setError('File must be smaller than 10 MB.');
    setFile(next);
  }

  async function runAnalysis(event) {
    event.preventDefault();
    setError('');
    if (!file) return setError('Add your PDF or DOCX resume first.');
    if (resumeText.trim().length < 80) return setError('Paste at least 80 characters of resume text so the analysis uses your content.');
    if (jobDescription.trim().length < 80) return setError('Add a job description with at least 80 characters.');
    setBusy(true);
    try {
      let result;
      if (endpoint) {
        const response = await fetch(`${endpoint.replace(/\/$/, '')}/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText, jobDescription, jobTitle, company }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Analysis request failed.');
        result = payload;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 650));
        result = analyzeText(resumeText, jobDescription);
      }
      const entry = {
        id: `${Date.now()}`, title: jobTitle.trim() || 'Untitled role',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        score: result.overall, file: file.name,
      };
      setReport({ ...result, ...entry, company: company.trim() });
      setHistory((items) => [{ ...entry, file: 'Resume document' }, ...items]);
      setView('results');
    } catch (requestError) {
      setError(requestError.message || 'Could not reach the analysis function. Check its URL and try again.');
    } finally { setBusy(false); }
  }

  function newAnalysis() {
    setFile(null); setResumeText(''); setJobDescription(''); setJobTitle(''); setCompany(''); setError(''); setReport(null); setView('new');
  }

  function downloadReport() {
    const text = `ResumeIQ Analysis Report\nRole: ${report.title}\nDate: ${report.date}\nHeuristic score: ${report.overall}/100\n\n${report.disclaimer}\n\n${report.breakdown.map((item) => `${item.name}: ${item.score}/100`).join('\n')}\n\nMatched: ${report.matchedKeywords.join(', ')}\nMissing: ${report.missingKeywords.join(', ')}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = 'resumeiq-analysis-report.txt'; link.click(); URL.revokeObjectURL(url);
    setToast('Report downloaded');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); setToast('Copied to clipboard'); }
    catch { setToast('Clipboard access is unavailable in this browser'); }
  }

  function deleteEntry(id) {
    if (window.confirm('Delete this analysis from your browser history?')) {
      setHistory((items) => items.filter((item) => item.id !== id)); setToast('Analysis removed');
    }
  }

  const navigation = [['home', '⌂', 'Home'], ['overview', '◫', 'Overview'], ['new', '+', 'New analysis'], ['history', '↺', 'Analysis history']];
  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    {view !== 'home' && <aside className="sidebar">
      <button className="brand" aria-label="ResumeIQ home" onClick={() => setView('home')}><span className="brand-mark">r</span><span>resume<span className="brand-light">iq</span></span></button>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(([id, icon, label]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); setError(''); }}><span className="nav-icon">{icon}</span>{label}{id === 'new' && <span className="nav-plus">↗</span>}</button>)}</nav>
      <div className="sidebar-rule" /><div className="workspace-label">PREFERENCES</div>
      <button className="nav-item" onClick={() => setToast('Settings are coming soon')}><span className="nav-icon">⚙</span>Settings</button>
      <button className="nav-item" onClick={() => setToast('Contact hello@resumeiq.app for support')}><span className="nav-icon">?</span>Help & support</button>
      <div className="sidebar-bottom"><div className="privacy-note"><i />Resume text is not saved in history.</div><button className="profile-row" onClick={() => setDark((value) => !value)}><span className="avatar">JD</span><span className="profile-copy"><strong>Jordan Davis</strong><small>Personal workspace</small></span><span className="theme-switch">{dark ? '☼' : '◐'}</span></button></div>
    </aside>}
    <main className={`main-area ${view === 'home' ? 'landing-main' : ''}`}>
      {view !== 'home' && <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> {view === 'new' ? 'New analysis' : view === 'history' ? 'Analysis history' : view === 'results' ? 'Analysis report' : 'Overview'}</div><div className="topbar-actions"><span className={`mode-chip ${endpoint ? 'connected' : ''}`}><i />{endpoint ? 'Catalyst connected' : 'Demo mode'}</span><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle dark mode">{dark ? '☼' : '◐'}</button><span className="avatar mini-avatar">JD</span></div></header>}

      {view === 'home' && <div className="landing-page">
        <header className="landing-nav"><button className="landing-brand" aria-label="ResumeIQ home"><span className="brand-mark">r</span><span>resume<span className="brand-light">iq</span></span></button><nav aria-label="Landing navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></nav><div><button className="landing-signin" onClick={() => setView('overview')}>Explore workspace</button><button className="button button-primary" onClick={() => setView('new')}>Analyze my resume <span>↗</span></button></div></header>
        <section className="landing-hero"><div className="landing-hero-copy"><span className="landing-eyebrow"><i /> A MORE THOUGHTFUL JOB SEARCH</span><h1>Your resume<br />deserves to get <em>noticed.</em></h1><p>Compare your experience with the role you want. Find relevant language, spot gaps, and decide what to improve next.</p><div className="landing-actions"><button className="button button-primary" onClick={() => setView('new')}>Check my resume <span>↗</span></button><a className="landing-secondary" href="#features">Explore features <span>↓</span></a></div><div className="landing-trust"><span>◈</span> Your experience stays yours. No pass guarantees, no invented credentials.</div></div><div className="landing-visual"><div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" /><div className="landing-report"><div className="landing-report-top"><span><i /> RESUMEIQ <small>DEMO REPORT</small></span><span className="landing-report-menu">•••</span></div><div className="landing-report-role"><span>ROLE MATCH SNAPSHOT</span><strong>Product Designer</strong><small>Resume compared with a sample role</small></div><div className="landing-report-score"><ScoreRing score={78} small /><div><strong>Good alignment</strong><span>Room to improve</span><div className="landing-report-tags"><i>Keywords</i><i>Skills</i><i>Structure</i></div></div></div><div className="landing-report-lines"><span><i style={{ width: '78%' }} /></span><span><i style={{ width: '63%' }} /></span><span><i style={{ width: '88%' }} /></span></div><div className="landing-report-bottom">Illustrative analysis · not an ATS guarantee</div></div><div className="landing-float-note"><span>↗</span><div><strong>Useful signal</strong><small>Not a hiring promise</small></div></div></div></section>
        <section className="landing-trust-row"><span>BUILT FOR A MORE CLEAR-EYED SEARCH</span><i /><span>Practical feedback</span><i /><span>Truthful suggestions</span><i /><span>Private by design</span></section>
        <section className="landing-section landing-features" id="features"><div className="landing-section-heading"><span className="landing-eyebrow">A BETTER READ ON YOUR RESUME</span><h2>See the details behind the match.</h2><p>Focused tools to help your real experience come through clearly.</p></div><div className="landing-feature-grid"><article><span className="landing-feature-icon green">◎</span><h3>Compatibility snapshot</h3><p>Get a transparent text-based score with category detail, not a mysterious verdict.</p></article><article><span className="landing-feature-icon ochre">⌕</span><h3>Job description match</h3><p>Compare your resume language to the specific role you are targeting.</p></article><article><span className="landing-feature-icon blue">⌗</span><h3>Keyword gap analysis</h3><p>See shared terms and opportunities to highlight relevant experience truthfully.</p></article><article><span className="landing-feature-icon rose">▤</span><h3>Structure and readability</h3><p>Review practical formatting heuristics and improve scan-friendly structure.</p></article><article><span className="landing-feature-icon mint">◇</span><h3>Skills alignment</h3><p>Understand where demonstrated skills overlap with the job description.</p></article><article><span className="landing-feature-icon violet">↗</span><h3>Actionable next steps</h3><p>Get grounded suggestions without fabricated achievements or credentials.</p></article></div></section>
        <section className="landing-steps" id="how-it-works"><div className="landing-section-heading"><span className="landing-eyebrow">SIMPLE BY DESIGN</span><h2>Four steps to a clearer next move.</h2></div><div className="landing-step-row"><article><b>01</b><h3>Add your resume</h3><p>Choose a PDF or DOCX, then paste its text for analysis.</p></article><i>→</i><article><b>02</b><h3>Choose a target role</h3><p>Paste the job description you want to compare against.</p></article><i>→</i><article><b>03</b><h3>Review the analysis</h3><p>Explore the score, matched terms, and text-based feedback.</p></article><i>→</i><article><b>04</b><h3>Make it yours</h3><p>Decide which changes accurately reflect your experience.</p></article></div></section>
        <section className="landing-pricing" id="pricing"><div className="landing-section-heading"><span className="landing-eyebrow">STRAIGHTFORWARD START</span><h2>Useful from the first comparison.</h2><p>Try the demo today. No account or payment details needed.</p></div><div className="landing-price-grid"><article><span className="price-label">STARTER</span><h3>Explore the demo</h3><div className="price-amount">$0 <small>/ always</small></div><p>For a first look at resume-to-role alignment.</p><ul><li>Resume text comparison</li><li>Keyword match and gaps</li><li>Formatting heuristics</li><li>Browser-only history</li></ul><button className="button button-outline" onClick={() => setView('new')}>Start an analysis ↗</button></article><article className="price-featured"><span className="price-label">NEXT UP</span><h3>More ways to improve</h3><div className="price-amount">Planned</div><p>Future tools are not available in this demo.</p><ul><li>Secure account history</li><li>Document text extraction</li><li>AI-assisted suggestions</li><li>Exportable reports</li></ul><button className="button button-dark" onClick={() => setToast('The expanded plan is not available in this demo.')}>Not available yet</button></article></div></section>
        <section className="landing-faq"><div><span className="landing-eyebrow">GOOD TO KNOW</span><h2>Questions, answered.</h2><p>A useful tool should be clear about what it can and cannot tell you.</p></div><div className="faq-list"><details><summary>Does a high score guarantee I will pass an ATS?</summary><p>No. Employers use different systems and screening criteria. This score is a text-based heuristic, not a hiring prediction.</p></details><details><summary>Does ResumeIQ extract text from my PDF or DOCX?</summary><p>Not in this demo. Choose a file for validation and paste its text into the form to analyze it.</p></details><details><summary>Will it tell me to add skills I do not have?</summary><p>No. Missing terms are suggestions to review only when they accurately describe your real experience.</p></details><details><summary>Is my resume stored?</summary><p>Resume text and job descriptions are not saved. Browser history stores only the role, date, score, and a generic resume label.</p></details></div></section>
        <section className="landing-final-cta"><div><span className="landing-eyebrow">YOUR NEXT STEP STARTS WITH CLARITY</span><h2>Let your experience speak clearly.</h2><p>Compare your resume with the opportunity you have in mind.</p></div><button className="button button-light" onClick={() => setView('new')}>Analyze my resume <span>↗</span></button></section>
        <footer className="landing-footer"><button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="brand-mark">r</span><span>resume<span className="brand-light">iq</span></span></button><span>© 2026 ResumeIQ · Text-based demo analysis</span><div><button onClick={() => setToast('Resume text, job descriptions, and filenames are not stored in browser history.')}>Privacy</button><button onClick={() => setToast('Terms are being prepared for a future release.')}>Terms</button><button onClick={() => setToast('Contact hello@resumeiq.app')}>Contact</button><button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>About</button></div></footer>
      </div>}

      {view === 'overview' && <section className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><i /> YOUR CAREER, IN FOCUS</div><h1>Good morning, Jordan<span className="title-period">.</span></h1><p className="page-subtitle">A clearer view of how your experience meets the roles you want.</p></div><button className="button button-primary" onClick={() => setView('new')}>＋ Analyze a resume</button></div>
        <div className="stats-grid"><article className="stat-card"><div className="stat-top"><span>Latest match score</span><span className="stat-icon mint">◉</span></div><div className="stat-value">{history[0]?.score ?? '—'}<small>/100</small></div><div className="stat-foot"><i />Based on your latest analysis</div><div className="stat-sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div></article><article className="stat-card"><div className="stat-top"><span>Resumes analyzed</span><span className="stat-icon lilac">▤</span></div><div className="stat-value">{String(history.length).padStart(2, '0')}</div><div className="stat-foot">Across <strong>{new Set(history.map((item) => item.title)).size}</strong> target roles</div><div className="mini-bars">{[28, 48, 37, 65, 47, 76, 58, 82, 62, 95].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article><article className="stat-card"><div className="stat-top"><span>Average match</span><span className="stat-icon peach">↗</span></div><div className="stat-value">{average}<small>/100</small></div><div className="stat-foot">Your personal baseline</div><div className="stat-line"><i style={{ width: `${average}%` }} /></div></article></div>
        <div className="overview-grid"><section className="panel recent-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR PROGRESS</span><h2>Recent analyses</h2></div><button className="text-button" onClick={() => setView('history')}>View history ↗</button></div>{history.length ? <div className="analysis-list">{history.slice(0, 4).map((item, index) => <button className="analysis-row" key={item.id} onClick={() => { setReport(report?.id === item.id ? report : null); setView('history'); }}><span className={`file-icon file-${index % 3}`}>PDF</span><span className="analysis-name"><strong>{item.title}</strong><small>{item.file} <i>·</i> {item.date}</small></span><span className={`score-pill ${item.score >= 80 ? 'good' : 'medium'}`}>{item.score}</span><span className="row-arrow">↗</span></button>)}</div> : <div className="empty-state">No analyses yet. Start with a role that interests you.</div>}</section>
          <section className="panel checklist-panel"><div className="panel-heading"><div><span className="section-kicker">SMALL STEPS, BETTER SIGNAL</span><h2>Resume checklist</h2></div><span className="check-count">02 / 04</span></div><div className="check-list"><div className="check-row done"><span className="check-box">✓</span><span><strong>Use clear section headings</strong><small>Make your experience easy to scan</small></span></div><div className="check-row done"><span className="check-box">✓</span><span><strong>Keep contact details current</strong><small>Professional email and phone number</small></span></div><div className="check-row"><span className="check-box" /><span><strong>Show measurable outcomes</strong><small>Ground results in what you actually did</small></span></div><div className="check-row"><span className="check-box" /><span><strong>Tailor for each role</strong><small>Reflect relevant experience truthfully</small></span></div></div><button className="checklist-cta" onClick={() => setView('new')}>Review against a job description <span>→</span></button></section></div>
        <section className="panel feature-strip"><div className="feature-copy"><span className="section-kicker">BUILT FOR YOUR NEXT STEP</span><h2>Make your experience<br />easier to find.</h2><p>Compare your resume with the role, understand the gaps, and decide what to improve.</p><button className="button button-dark" onClick={() => setView('new')}>Start an analysis ↗</button></div><div className="feature-preview"><div className="preview-head"><span>ROLE ALIGNMENT</span><span>DEMO REPORT</span></div><div className="preview-content"><ScoreRing score={82} small /><div className="preview-breakdown"><span>Keyword match <b>Good</b></span><div className="preview-track"><i style={{ width: '74%' }} /></div><span>Skills overlap <b>Strong</b></span><div className="preview-track peach-track"><i style={{ width: '86%' }} /></div><span>Experience <b>Review</b></span><div className="preview-track blue-track"><i style={{ width: '62%' }} /></div></div></div><div className="preview-foot"><i />Illustrative results, not an ATS guarantee</div></div></section>
      </section>}

      {view === 'new' && <section className="page-content form-page"><div className="page-heading"><div><div className="eyebrow"><i /> ROLE-READY, NOT GUESSWORK</div><h1>New analysis<span className="title-period">.</span></h1><p className="page-subtitle">Compare your resume text with a specific job description.</p></div><span className="step-indicator"><b>01</b> / 02 &nbsp; Add your materials</span></div>
        <form className="analysis-form" onSubmit={runAnalysis}><div className="form-columns"><section className="form-panel"><div className="form-panel-title"><span className="step-number">01</span><div><h2>Your resume</h2><p>Choose a file and provide its text for analysis.</p></div></div><div className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} role="button" tabIndex="0" onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}><input ref={inputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(event) => chooseFile(event.target.files[0])} />{file ? <><span className="upload-symbol uploaded">✓</span><strong>{file.name}</strong><small>{(file.size / 1048576).toFixed(2)} MB · Ready to analyze</small><button type="button" className="remove-file" onClick={(event) => { event.stopPropagation(); setFile(null); }}>Remove file</button></> : <><span className="upload-symbol">↑</span><strong>Drop your resume here</strong><span className="upload-browse">or <b>browse files</b></span><small>PDF or DOCX · Max 10 MB</small></>}</div><label className="field-label" htmlFor="resume-text">Resume text <span>Required for text-based analysis</span></label><textarea id="resume-text" className="resume-textarea" value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder={'Paste the text from your resume here...\n\nYour resume content is analyzed for this request and is not saved in browser history.'} maxLength={12000} /><div className="field-foot"><span>Files stay on your device in demo mode.</span><span>{resumeText.length.toLocaleString()} / 12,000</span></div></section>
          <section className="form-panel"><div className="form-panel-title"><span className="step-number second">02</span><div><h2>The role</h2><p>Tell us what the employer is looking for.</p></div></div><div className="field-row"><label className="field-label" htmlFor="job-title">Job title <span>Required</span></label><input id="job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Senior Product Designer" maxLength={100} /></div><div className="field-row"><label className="field-label" htmlFor="company">Company <span>Optional</span></label><input id="company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. Acme Studio" maxLength={100} /></div><div className="field-row job-description-field"><div className="label-actions"><label className="field-label" htmlFor="job-description">Job description <span>Required</span></label><button type="button" className="text-button subtle" onClick={() => setJobDescription(sampleJob)}>Use sample</button></div><textarea id="job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the job description here..." maxLength={10000} /><div className="field-foot"><span>At least 80 characters</span><span>{jobDescription.length.toLocaleString()} / 10,000</span></div></div></section></div>{error && <div className="form-error" role="alert"><b>!</b>{error}</div>}<div className="form-submit-row"><p>◈ &nbsp;Heuristic feedback, not an employer ATS score.</p><button className="button button-primary analyze-button" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Analyzing your resume</> : <>Analyze my resume ↗</>}</button></div></form>
      </section>}

      {view === 'results' && report && <section className="page-content results-page"><div className="results-top"><div><div className="eyebrow"><i /> ANALYSIS REPORT <span className="demo-label">{report.mode === 'demo' ? 'BROWSER DEMO' : 'HEURISTIC'}</span></div><h1>{report.title}<span className="title-period">.</span></h1><p className="page-subtitle">{report.company ? `${report.company} · ` : ''}{report.file} <span>·</span> {report.date}</p></div><div className="result-actions"><button className="button button-outline" onClick={downloadReport}>↓ Download report</button><button className="button button-primary" onClick={newAnalysis}>＋ New analysis</button></div></div>
        <div className="result-hero panel"><div className="result-score"><ScoreRing score={report.overall} /><div><span className="score-caption">OVERALL MATCH</span><h2>{report.overall >= 80 ? 'Strong alignment' : report.overall >= 65 ? 'Good match' : 'Room to align'}</h2><p>Useful direction, not a pass/fail prediction.</p></div></div><div className="result-disclaimer"><span>i</span><p>{report.disclaimer}</p></div></div>
        <div className="results-grid"><section className="panel breakdown-panel"><div className="panel-heading"><div><span className="section-kicker">A CLOSER LOOK</span><h2>Score breakdown</h2></div><span className="demo-label">HEURISTIC</span></div><div className="breakdown-list">{report.breakdown.map((item, index) => <div className="breakdown-item" key={item.name}><div className="breakdown-label"><span className={`breakdown-icon bi-${index}`}>{['⌗', '◇', '↗', '▤', '◌'][index]}</span><strong>{item.name}</strong><b>{item.score}<small>/100</small></b></div><div className="score-track"><i style={{ width: `${item.score}%` }} /></div></div>)}</div></section>
          <section className="panel keyword-panel"><div className="panel-heading"><div><span className="section-kicker">ROLE LANGUAGE</span><h2>Keyword alignment</h2></div><span className="keyword-count">{report.matchedKeywords.length} matched</span></div><div className="coverage-line"><span>Coverage</span><strong>{report.matchedKeywords.length + report.missingKeywords.length ? Math.round(report.matchedKeywords.length / (report.matchedKeywords.length + report.missingKeywords.length) * 100) : 0}%</strong><div className="coverage-track"><i style={{ width: `${report.matchedKeywords.length + report.missingKeywords.length ? report.matchedKeywords.length / (report.matchedKeywords.length + report.missingKeywords.length) * 100 : 0}%` }} /></div></div><div className="keyword-groups"><div><div className="keyword-heading"><i className="green-dot" />Found in both</div><div className="keyword-tags">{report.matchedKeywords.length ? report.matchedKeywords.map((word) => <button className={`keyword-tag matched ${selectedKeyword === word ? 'selected' : ''}`} key={word} onClick={() => setSelectedKeyword(selectedKeyword === word ? '' : word)}>{word}</button>) : <small className="empty-keywords">No shared keywords found yet.</small>}</div></div><div><div className="keyword-heading"><i className="amber-dot" />In job description</div><div className="keyword-tags">{report.missingKeywords.length ? report.missingKeywords.map((word) => <button className={`keyword-tag missing ${selectedKeyword === word ? 'selected' : ''}`} key={word} onClick={() => setSelectedKeyword(selectedKeyword === word ? '' : word)}>{word}</button>) : <small className="empty-keywords">No gaps detected by this text match.</small>}</div></div></div>{selectedKeyword && <div className="keyword-detail"><strong>{selectedKeyword}</strong><span>{report.matchedKeywords.includes(selectedKeyword) ? 'This term appears in both texts. Make sure its context reflects your real work.' : 'This term appears in the job description. Add it only if it accurately describes your skills or experience.'}</span></div>}</section></div>
        <section className="panel recommendations-panel"><div className="panel-heading"><div><span className="section-kicker">NEXT BEST STEPS</span><h2>Improve your resume</h2></div><span className="demo-label">TEXT-BASED TIPS</span></div>{report.recommendations.length ? report.recommendations.map((item, index) => <div className="recommendation" key={item.title}><button className="recommendation-toggle" onClick={() => setExpanded(expanded === index ? -1 : index)} aria-expanded={expanded === index}><span className="recommendation-number">0{index + 1}</span><strong>{item.title}</strong><span className="severity">Suggestion</span><span className="expand-mark">{expanded === index ? '−' : '+'}</span></button>{expanded === index && <div className="recommendation-detail"><p>{item.detail}</p><p className="truth-note">Only include details that accurately reflect your experience. AI rewriting is not connected.</p><button className="text-button" onClick={() => copyText(item.detail)}>Copy suggestion</button></div>}</div>) : <div className="empty-state">No text-based suggestions for this comparison. Review the keyword groups for useful next steps.</div>}<div className="ai-note"><span>✳</span><p><strong>Illustrative guidance.</strong> No employers, qualifications, or achievements are generated or assumed.</p></div></section>
      </section>}

      {view === 'history' && <section className="page-content history-page"><div className="page-heading"><div><div className="eyebrow"><i /> YOUR WORK, IN ONE PLACE</div><h1>Analysis history<span className="title-period">.</span></h1><p className="page-subtitle">Past comparisons saved in this browser only.</p></div><button className="button button-primary" onClick={newAnalysis}>＋ New analysis</button></div><section className="panel history-panel"><div className="history-toolbar"><label className="search-box"><span>⌕</span><input aria-label="Search analyses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by role" /></label><select aria-label="Filter by score" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All scores</option><option value="strong">80 and above</option><option value="review">Below 80</option></select><span className="history-count">{filteredHistory.length} analyses</span></div>{filteredHistory.length ? <div className="table-wrap"><table><thead><tr><th>RESUME</th><th>TARGET ROLE</th><th>DATE</th><th>MATCH</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredHistory.map((item) => <tr key={item.id}><td><span className="table-file"><span className="file-icon">DOC</span>{item.file}</span></td><td>{item.title}</td><td>{item.date}</td><td><span className={`score-pill ${item.score >= 80 ? 'good' : 'medium'}`}>{item.score}</span></td><td className="table-actions"><button className="text-button" onClick={() => { if (report?.id === item.id) setView('results'); else setToast('This saved entry is a summary. Run a new analysis to view a full report.'); }}>View</button><button className="icon-button delete-button" aria-label={`Delete ${item.title}`} onClick={() => deleteEntry(item.id)}>×</button></td></tr>)}</tbody></table></div> : <div className="empty-state history-empty"><strong>No matching analyses</strong><small>Try a different search or filter.</small><button className="text-button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button></div>}<div className="history-privacy">◈ &nbsp;Only role, date, and score are saved with a generic resume label. Text and filenames are never stored.</div></section></section>}
      {view !== 'home' && <footer className="app-footer"><span>© 2026 ResumeIQ</span><span>Designed to support your next step, not predict an employer's decision.</span><button onClick={() => setToast('Resume content, job descriptions, and filenames are not stored in browser history.')}>Privacy</button></footer>}
    </main>{toast && <div className="toast" role="status">✓ &nbsp;{toast}</div>}
  </div>;
}

export default App;
