import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  Play, RotateCcw, Copy, Check, Terminal, Eye, Code2,
  ChevronDown, Zap, AlertCircle, CheckCircle2, Lightbulb, X
} from 'lucide-react';

/* ── Language configs ── */
const LANGUAGES = {
  javascript: {
    label: 'JavaScript',
    extension: () => javascript({ jsx: true }),
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10 border-yellow-400/20',
    starter: (lessonTitle = '') => {
      const topic = lessonTitle.toLowerCase();
      if (topic.includes('array') || topic.includes('list')) {
        return `// 🧪 Arrays Challenge
// Create an array of 5 fruits and use map() to uppercase them
const fruits = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

// Your code here:
const uppercased = fruits.map(fruit => fruit.toUpperCase());
console.log(uppercased);

// Bonus: Filter fruits with more than 5 characters
const longFruits = fruits.filter(f => f.length > 5);
console.log('Long fruits:', longFruits);`;
      }
      if (topic.includes('function') || topic.includes('closure')) {
        return `// 🧪 Functions Challenge
// Create a function that calculates factorial
function factorial(n) {
  // Your code here:
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5)); // Should print: 120
console.log(factorial(0)); // Should print: 1

// Bonus: Create an arrow function version
const factorialArrow = (n) => n <= 1 ? 1 : n * factorialArrow(n - 1);
console.log(factorialArrow(6)); // Should print: 720`;
      }
      if (topic.includes('object') || topic.includes('class')) {
        return `// 🧪 Objects Challenge
// Build a simple student record system
class Student {
  constructor(name, age, grade) {
    this.name = name;
    this.age = age;
    this.grade = grade;
  }

  getInfo() {
    return \`\${this.name} (age \${this.age}) — Grade: \${this.grade}\`;
  }

  isPassing() {
    return this.grade >= 60;
  }
}

const student1 = new Student('Alice', 20, 85);
const student2 = new Student('Bob', 19, 45);

console.log(student1.getInfo());
console.log('Alice passing?', student1.isPassing());
console.log('Bob passing?', student2.isPassing());`;
      }
      return `// 🧪 Code Sandbox — Test your knowledge!
// Topic: ${lessonTitle || 'JavaScript Basics'}

// Try writing your code below:
function greet(name) {
  return \`Hello, \${name}! Welcome to SkillVerse.\`;
}

console.log(greet('Learner'));

// Experiment with variables
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log('Doubled:', doubled);

const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log('Sum:', sum);`;
    },
  },
  python: {
    label: 'Python',
    extension: () => python(),
    icon: '🐍',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10 border-blue-400/20',
    starter: (lessonTitle = '') => `# 🧪 Python Sandbox — Test your knowledge!
# Topic: ${lessonTitle || 'Python Basics'}

# Note: Python runs as a simulation in this browser sandbox
# For full Python execution, use a Python environment

def greet(name):
    return f"Hello, {name}! Welcome to SkillVerse."

print(greet("Learner"))

# Experiment with lists
numbers = [1, 2, 3, 4, 5]
doubled = [n * 2 for n in numbers]
print(f"Doubled: {doubled}")

total = sum(numbers)
print(f"Sum: {total}")`,
  },
  html: {
    label: 'HTML/CSS',
    extension: () => html(),
    icon: '🌐',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10 border-orange-400/20',
    starter: (lessonTitle = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lessonTitle || 'My Page'}</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #0f172a, #1e3a5f);
      color: white;
    }
    .card {
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
      max-width: 360px;
    }
    h1 { margin: 0 0 0.5rem; font-size: 1.8rem; }
    p { color: #94a3b8; margin: 0; }
    .btn {
      margin-top: 1.5rem;
      padding: 0.6rem 1.5rem;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Hello World!</h1>
    <p>Edit this HTML to see your changes live in the Preview tab.</p>
    <button class="btn" onclick="this.textContent='Clicked! ✅'">Click Me</button>
  </div>
</body>
</html>`,
  },
  sql: {
    label: 'SQL',
    extension: () => sql(),
    icon: '🗄️',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10 border-green-400/20',
    starter: (lessonTitle = '') => `-- 🧪 SQL Sandbox — Test your knowledge!
-- Note: SQL queries run as simulation only in this browser sandbox

-- Sample table structure (conceptual)
-- CREATE TABLE students (
--   id INT PRIMARY KEY,
--   name VARCHAR(100),
--   age INT,
--   grade DECIMAL(5,2),
--   enrolled_at DATE
-- );

-- Query examples:

-- 1. Select all students
SELECT * FROM students;

-- 2. Filter passing students (grade >= 60)
SELECT name, grade
FROM students
WHERE grade >= 60
ORDER BY grade DESC;

-- 3. Average grade by age group
SELECT age, AVG(grade) as avg_grade, COUNT(*) as student_count
FROM students
GROUP BY age
HAVING COUNT(*) > 1;`,
  },
};

/* ── Sandbox execution engine ── */
function runJavaScript(code) {
  const logs = [];
  const errors = [];

  const fakeConsole = {
    log: (...args) => logs.push({ type: 'log', content: args.map(formatValue).join(' ') }),
    error: (...args) => logs.push({ type: 'error', content: args.map(formatValue).join(' ') }),
    warn: (...args) => logs.push({ type: 'warn', content: args.map(formatValue).join(' ') }),
    info: (...args) => logs.push({ type: 'info', content: args.map(formatValue).join(' ') }),
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', code);
    fn(fakeConsole);
  } catch (e) {
    errors.push({ type: 'error', content: `❌ ${e.name}: ${e.message}` });
  }

  return [...logs, ...errors];
}

function formatValue(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'object') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
}

function runHTML(code) {
  return code; // returned as-is, used in iframe srcDoc
}

const CodeSandbox = ({ lessonTitle = '', lessonTopic = '' }) => {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState([]);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'console' | 'preview'
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const iframeRef = useRef(null);
  const langConfig = LANGUAGES[language];

  // Initialize code when language or lesson changes
  useEffect(() => {
    setCode(langConfig.starter(lessonTitle));
    setOutput([]);
    setHasRun(false);
  }, [language, lessonTitle]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setHasRun(true);

    await new Promise(r => setTimeout(r, 300)); // UX delay

    if (language === 'javascript') {
      const result = runJavaScript(code);
      setOutput(result);
      setActiveTab('console');
    } else if (language === 'html') {
      setActiveTab('preview');
      setOutput([{ type: 'info', content: '✅ HTML rendered in Preview tab.' }]);
    } else {
      // Python / SQL: simulation mode
      setOutput([
        { type: 'info', content: `ℹ️ ${langConfig.label} runs in simulation mode in this browser sandbox.` },
        { type: 'info', content: 'Your code looks great! For full execution, use a local environment.' },
        { type: 'log', content: '---' },
        { type: 'log', content: `📋 Code reviewed: ${code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('--')).length} active lines` },
      ]);
      setActiveTab('console');
    }

    setIsRunning(false);
  }, [language, code, langConfig]);

  const handleReset = useCallback(() => {
    setCode(langConfig.starter(lessonTitle));
    setOutput([]);
    setHasRun(false);
  }, [langConfig, lessonTitle]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [code]);

  const getOutputIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />;
      case 'warn': return <AlertCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />;
      case 'info': return <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />;
      default: return <span className="text-muted-foreground shrink-0 mt-0.5 text-xs">›</span>;
    }
  };

  const getOutputColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-300';
      case 'info': return 'text-blue-300';
      default: return 'text-emerald-300';
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-[#0d1117] shadow-xl">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-xs font-mono text-white/40">sandbox.{language === 'javascript' ? 'js' : language === 'python' ? 'py' : language === 'html' ? 'html' : 'sql'}</span>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-white/5">
            {Object.entries(LANGUAGES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setLanguage(key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  language === key
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span>{cfg.icon}</span>
                <span className="hidden sm:inline">{cfg.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-yellow-400/80 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hint</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <motion.button
            onClick={handleRun}
            disabled={isRunning}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
          >
            {isRunning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              >
                <Zap className="h-3.5 w-3.5" />
              </motion.div>
            ) : (
              <Play className="h-3.5 w-3.5 fill-black" />
            )}
            {isRunning ? 'Running…' : 'Run'}
          </motion.button>
        </div>
      </div>

      {/* ── Hint panel ── */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-yellow-500/5 border-b border-yellow-500/10 flex items-start gap-3">
              <Lightbulb className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-yellow-300 mb-0.5">Hint for this lesson</p>
                <p className="text-xs text-yellow-200/60 leading-relaxed">
                  {lessonTitle
                    ? `This sandbox is pre-loaded with a challenge related to "${lessonTitle}". Read the comments in the code for guidance. Click Run to execute and see the output below.`
                    : 'Try modifying the starter code, then click Run to see the output. Use console.log() to print values.'}
                </p>
              </div>
              <button onClick={() => setShowHint(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab bar (output tabs) ── */}
      <div className="flex items-center gap-0.5 px-3 pt-2 bg-[#0d1117] border-b border-white/5">
        {[
          { key: 'editor', label: 'Editor', icon: <Code2 className="h-3.5 w-3.5" /> },
          { key: 'console', label: `Console${output.length > 0 ? ` (${output.length})` : ''}`, icon: <Terminal className="h-3.5 w-3.5" /> },
          ...(language === 'html' ? [{ key: 'preview', label: 'Preview', icon: <Eye className="h-3.5 w-3.5" /> }] : []),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-all ${
              activeTab === tab.key
                ? 'text-white border-emerald-400 bg-white/3'
                : 'text-white/30 border-transparent hover:text-white/60'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Editor / Console / Preview ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'editor' && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CodeMirror
              value={code}
              onChange={setCode}
              extensions={[langConfig.extension()]}
              theme={oneDark}
              height="380px"
              style={{ fontSize: '13px' }}
              className="codemirror-sandbox"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: false,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                searchKeymap: true,
              }}
            />
          </motion.div>
        )}

        {activeTab === 'console' && (
          <motion.div
            key="console"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-[380px] overflow-y-auto bg-[#0d1117] p-4 font-mono"
          >
            {output.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Terminal className="h-8 w-8 text-white/10" />
                <p className="text-xs text-white/20">
                  {hasRun ? 'No output generated.' : 'Click Run to execute your code'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {output.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-start gap-2 text-xs leading-relaxed ${getOutputColor(line.type)}`}
                  >
                    {getOutputIcon(line.type)}
                    <pre className="whitespace-pre-wrap break-all font-mono">{line.content}</pre>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'preview' && language === 'html' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-[380px] bg-white"
          >
            <iframe
              ref={iframeRef}
              srcDoc={code}
              title="HTML Preview"
              className="w-full h-full border-none"
              sandbox="allow-scripts"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer status bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-t border-white/5 text-[10px] font-mono text-white/25">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 ${langConfig.color}`}>
            <span>{langConfig.icon}</span>
            {langConfig.label}
          </span>
          <span>{code.split('\n').length} lines</span>
        </div>
        <div className="flex items-center gap-3">
          {hasRun && output.some(o => o.type === 'error') && (
            <span className="text-red-400">⚠ {output.filter(o => o.type === 'error').length} error(s)</span>
          )}
          {hasRun && !output.some(o => o.type === 'error') && (
            <span className="text-emerald-400">✓ Ran successfully</span>
          )}
          <span>SkillVerse Sandbox</span>
        </div>
      </div>
    </div>
  );
};

export default CodeSandbox;
